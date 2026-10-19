import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { recordAudit } from "@/lib/audit";
import { createInboundMessageIfNew } from "@/lib/instagram";
import { isOptInMessage, isOptOutMessage } from "@/lib/optOutKeywords";
import { upsertCrmLead } from "@/lib/crmSync";
import { ghlContact, ghlConversationMessages, ghlConversationsSince, type GhlMessage } from "@/lib/crm/gohighlevel";
import { findOrCreateGhlConversation } from "@/lib/crm/ghlThreads";

/**
 * GoHighLevel's texts and emails, brought into FollowUp (GHL 2, founder 2026-10-16: "yes go ahead").
 *
 * A realtor on GoHighLevel already has their number, their email and their customers there. FollowUp reads what
 * customers write to them there, drafts the reply on Today, and the reply goes back through GoHighLevel
 * (src/lib/sending.ts → sendGhlMessage), from the same number or email the customer wrote to. Nothing new to set
 * up: the key from the connect window is enough.
 *
 * Read by asking, every two minutes (/api/cron/ghl-poll), the same way Instagram is (src/lib/instagramPoll.ts):
 * GoHighLevel's webhooks are signed for Marketplace apps, and a Private Integration key isn't one.
 *
 * What it does with each message:
 *  - From the customer: stored once (Message.externalId is GoHighLevel's message id), STOP/START honoured as on any
 *    text, then scored and drafted like any other customer. No instant "thanks, I'll get back to you": the owner's
 *    GoHighLevel may already send its own, and two would be the thing never to do.
 *  - From the business (the owner typing in GoHighLevel, or one of its own automations): stored as a reply that
 *    didn't go through FollowUp ("gohighlevel_direct"), so FollowUp sees the customer has been answered and doesn't
 *    answer again. FollowUp's own sends come back here too, and land on the row the send already wrote, by id.
 */

/** Conversations read per business per tick, and messages per conversation. */
const CONVERSATION_LIMIT = 25;
const MESSAGE_LIMIT = 20;

/** A business never read before starts this far back: connecting must not answer old conversations. */
const FIRST_RUN_LOOKBACK_MS = 15 * 60 * 1000;
/** However long the poller was down, it never reaches back further than a day. */
const MAX_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Re-read a little before the newest stored message; anything read twice is dropped by its id. */
const OVERLAP_MS = 2 * 60 * 1000;

/**
 * Where to start reading: the newest GoHighLevel message already stored for this business. Kept in the messages
 * themselves rather than a column, so nothing new is stored to know it.
 */
export async function ghlReadFrom(businessId: string, now: number): Promise<Date> {
  const newest = await prisma.message.findFirst({
    where: {
      conversation: { externalId: { startsWith: "ghl:" }, lead: { businessId } },
      // Old conversations brought back by the wake-up (src/lib/ghlHistory.ts) are not where reading got to.
      OR: [{ source: null }, { source: { not: "gohighlevel_history" } }],
    },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  const from = newest ? newest.sentAt.getTime() - OVERLAP_MS : now - FIRST_RUN_LOOKBACK_MS;
  return new Date(Math.max(from, now - MAX_LOOKBACK_MS));
}

/** The FollowUp customer for a GoHighLevel contact, brought in on the spot when the contact sync hasn't yet. */
export async function leadForContact(businessId: string, apiKey: string, contactId: string) {
  const key = { businessId_crmProvider_crmId: { businessId, crmProvider: "gohighlevel", crmId: contactId } };
  const existing = await prisma.lead.findUnique({ where: key });
  if (existing) return existing;
  const person = await ghlContact(apiKey, contactId);
  if (!person) return null;
  await upsertCrmLead(businessId, "gohighlevel", person);
  return prisma.lead.findUnique({ where: key });
}

export type GhlMessageOutcome = "new_inbound" | "new_outbound" | "already_had" | "no_customer";

export async function processGhlMessage(businessId: string, apiKey: string, m: GhlMessage): Promise<GhlMessageOutcome> {
  const lead = await leadForContact(businessId, apiKey, m.contactId);
  if (!lead) return "no_customer";
  const conversation = await findOrCreateGhlConversation(lead.id, m.conversationId, m.channel);

  if (m.direction === "outbound") {
    const had = await prisma.message.findUnique({ where: { externalId: m.id }, select: { id: true } });
    if (had) return "already_had";
    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "outbound", body: m.body, source: "gohighlevel_direct", externalId: m.id, sentAt: m.at },
      });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") return "already_had";
      throw err;
    }
    if (!lead.lastContacted || lead.lastContacted < m.at) {
      await prisma.lead.update({ where: { id: lead.id }, data: { lastContacted: m.at } }).catch(() => {});
    }
    return "new_outbound";
  }

  const isNew = await createInboundMessageIfNew(conversation.id, m.body, m.at, m.id);

  // STOP/START on a text or WhatsApp, before anything else, exactly as on Twilio (src/lib/inbound/twilioMessage.ts).
  // Facebook and Instagram STOPs are GoHighLevel's own to honour (its DND); FollowUp's Meta suppression is keyed
  // on Meta ids these customers don't have here.
  if (m.channel === "text" || m.channel === "whatsapp") {
    const optingOut = isOptOutMessage(m.body);
    const optingIn = isOptInMessage(m.body);
    if (optingOut || optingIn) {
      await prisma.lead.update({ where: { id: lead.id }, data: { optedOutAt: optingOut ? new Date() : null } });
      void recordAudit({ businessId, userId: null }, optingOut ? "lead.opt_out" : "lead.opt_in", {
        targetType: "lead",
        targetId: lead.id,
        meta: { channel: m.channel, via: "keyword", provider: "gohighlevel" },
      });
    }
  }
  if (!isNew) return "already_had";

  await prisma.lead.update({ where: { id: lead.id }, data: { lastContacted: m.at } }).catch(() => {});
  await scoreAndDraftForLead(lead.id);
  await checkRapidEngagement(lead.id);
  return "new_inbound";
}

export async function pollGoHighLevelForBusiness(
  businessId: string,
  now: number = Date.now()
): Promise<{ ok: boolean; inbound: number; outbound: number }> {
  const conn = await prisma.crmConnection.findUnique({ where: { businessId }, select: { provider: true, apiKey: true } });
  if (conn?.provider !== "gohighlevel" || !conn.apiKey) return { ok: true, inbound: 0, outbound: 0 };
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { subscriptionStatus: true } });
  if (!hasActiveAccess(business?.subscriptionStatus)) return { ok: true, inbound: 0, outbound: 0 };

  const since = await ghlReadFrom(businessId, now);
  let inbound = 0;
  let outbound = 0;
  const conversations = await ghlConversationsSince(conn.apiKey, since, CONVERSATION_LIMIT);
  const fresh: GhlMessage[] = [];
  for (const c of conversations) {
    const messages = await ghlConversationMessages(conn.apiKey, c.id, MESSAGE_LIMIT);
    fresh.push(...messages.filter((m) => m.at >= since));
  }
  // Oldest first, so a thread lands in the order it happened and the newest message is the one drafted for.
  fresh.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const m of fresh) {
    const outcome = await processGhlMessage(businessId, conn.apiKey, m);
    if (outcome === "new_inbound") inbound++;
    else if (outcome === "new_outbound") outbound++;
  }
  return { ok: true, inbound, outbound };
}

export async function pollGoHighLevelForAllBusinesses(): Promise<{ businesses: number; inbound: number; outbound: number; failed: number }> {
  const connections = await prisma.crmConnection.findMany({ where: { provider: "gohighlevel", apiKey: { not: null } }, select: { businessId: true } });
  let inbound = 0;
  let outbound = 0;
  let failed = 0;
  for (const { businessId } of connections) {
    try {
      const r = await pollGoHighLevelForBusiness(businessId);
      inbound += r.inbound;
      outbound += r.outbound;
    } catch (err) {
      failed++;
      console.error(`GoHighLevel poll failed for business ${businessId}:`, err instanceof Error ? err.message : err);
    }
  }
  return { businesses: connections.length, inbound, outbound, failed };
}
