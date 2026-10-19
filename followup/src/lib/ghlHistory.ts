import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { recordAudit } from "@/lib/audit";
import { DEAD_LEAD_ACTION, DEAD_LEAD_DEFAULT_DAYS } from "@/lib/automation";
import { isOptInMessage, isOptOutMessage } from "@/lib/optOutKeywords";
import { leadForContact } from "@/lib/ghlPoll";
import { ghlConversationMessages, ghlConversationsBefore, ghlDoNotDisturb, type GhlMessage } from "@/lib/crm/gohighlevel";
import { findOrCreateGhlConversation } from "@/lib/crm/ghlThreads";

/**
 * Wake up old customers on GoHighLevel (founder 2026-10-19: "build the wake up old customers for gohighlevel").
 *
 * A realtor's GoHighLevel holds months of conversations with people who asked about a home and went quiet. The
 * poller (src/lib/ghlPoll.ts) only reads what arrives after connecting, on purpose: connecting must never answer
 * an old conversation. This brings the old ones in as history, a few a day, so the welcome back FollowUp already
 * writes for a quiet customer (src/lib/automation.ts, the dead-lead rule) can be written for them too.
 *
 * What it never does:
 *  - send, draft or score anything itself. The messages are stored, and the hourly automation does the rest. A
 *    customer quiet past the welcome-back wait is cold, and a cold customer's message always waits for the owner
 *    (automation.ts `isCold`): the owner sees each one on Today and decides.
 *  - flood Today. At most WAKE_PER_DAY customers a day are brought back, most recent first, which is also the
 *    pace their welcome backs reach Today.
 *  - bring back a customer who said STOP (stored as opted out), is Do Not Disturb in GoHighLevel, said no, is
 *    marked won or lost, has FollowUp switched off, or already has a conversation in FollowUp.
 *  - count as new: every message is stored as "gohighlevel_history", which the poller's read-from point ignores,
 *    so bringing in an old message can never move it back in time and make it answer old conversations.
 *
 * Which conversations: their last message between the welcome-back wait (the owner's own setting, 45 days unless
 * changed) and HISTORY_MAX_DAYS ago, with at least one message from the customer. Newer ones are the owner's own
 * live conversations; older ones are too cold to write to out of the blue. Off when the owner turned the welcome
 * back off.
 */

export const GHL_HISTORY_SOURCE = "gohighlevel_history";

/** How far back customers are brought back: about six months. */
export const HISTORY_MAX_DAYS = 183;
/** Customers brought back per business per day: the pace their welcome backs reach Today. */
export const WAKE_PER_DAY = 10;
/** Messages read per conversation: enough to know what was said, not the whole history. */
const MESSAGES_PER_CONVERSATION = 30;
/** Conversations asked for per page. */
const PAGE_SIZE = 50;
/**
 * Conversations looked at per run. Each can cost three GoHighLevel requests (the contact, its messages, Do Not
 * Disturb), and a run comes every two minutes with the poll: a few at a time stays well inside GoHighLevel's
 * per-location limit and the cron's time.
 */
const LOOK_PER_RUN = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Where the last run stopped: the last-message date of the last conversation it looked at. */
async function cursorOf(businessId: string): Promise<Date | null> {
  const last = await prisma.auditEvent.findFirst({
    where: { businessId, action: "ghl.history_slice" },
    orderBy: { createdAt: "desc" },
    select: { meta: true },
  });
  const at = (last?.meta as { cursor?: unknown } | null)?.cursor;
  return typeof at === "string" && !Number.isNaN(Date.parse(at)) ? new Date(at) : null;
}

/**
 * The customer has told this business STOP on a text or WhatsApp, and not START since: kept as they left it.
 * `messages` oldest first.
 */
export function optedOutIn(messages: readonly GhlMessage[]): Date | null {
  let out: Date | null = null;
  for (const m of messages) {
    if (m.direction !== "inbound" || (m.channel !== "text" && m.channel !== "whatsapp")) continue;
    if (isOptOutMessage(m.body)) out = m.at;
    else if (isOptInMessage(m.body)) out = null;
  }
  return out;
}

export type WakeOutcome = "woken" | "opted_out" | "skipped";

/** One old conversation: its customer brought back with what was said, or left alone, and why. */
export async function wakeConversation(businessId: string, apiKey: string, row: { id: string; contactId: string }): Promise<WakeOutcome> {
  const lead = await leadForContact(businessId, apiKey, row.contactId);
  if (!lead) return "skipped";
  if (lead.optedOutAt || lead.saidNoAt || lead.stage === "WON" || lead.stage === "LOST" || lead.automationTier === "OFF") return "skipped";
  // Already talking in FollowUp (they wrote since connecting, or their inbox thread is here): not an old customer.
  const known = await prisma.message.count({ where: { conversation: { leadId: lead.id } } });
  if (known > 0) return "skipped";

  const messages = (await ghlConversationMessages(apiKey, row.id, MESSAGES_PER_CONVERSATION)).sort((a, b) => a.at.getTime() - b.at.getTime());
  // Only a conversation the customer took part in: an owner's message nobody answered is not one to come back to.
  if (!messages.some((m) => m.direction === "inbound")) return "skipped";
  const dnd = await ghlDoNotDisturb(apiKey, row.contactId);
  if (dnd) return "skipped";
  // GoHighLevel didn't say: stop this run here, and ask again next time, rather than guess.
  if (dnd === null) throw new Error("GoHighLevel didn't say whether a contact is Do Not Disturb");

  for (const m of messages) {
    const conversation = await findOrCreateGhlConversation(lead.id, row.id, m.channel);
    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: m.direction, body: m.body, source: GHL_HISTORY_SOURCE, externalId: m.id, sentAt: m.at },
      });
    } catch (err) {
      if (!(err && typeof err === "object" && "code" in err && err.code === "P2002")) throw err;
    }
  }

  const stop = optedOutIn(messages);
  const lastAt = messages[messages.length - 1].at;
  await prisma.lead.update({
    where: { id: lead.id },
    // The true last contact, which is what makes them quiet; the contact sync only knew when the contact was made.
    data: { lastContacted: lastAt, ...(stop ? { optedOutAt: stop } : {}) },
  });
  if (stop) return "opted_out";
  void recordAudit({ businessId, userId: null }, "ghl.history_woken", { targetType: "lead", targetId: lead.id, meta: { messages: messages.length } });
  return "woken";
}

/** One business's next few old customers. Safe to call every poll: it does nothing once today's are in. */
export async function wakeGhlHistoryForBusiness(businessId: string, now: number = Date.now()): Promise<{ woken: number; done: boolean }> {
  const conn = await prisma.crmConnection.findUnique({ where: { businessId }, select: { provider: true, apiKey: true } });
  if (conn?.provider !== "gohighlevel" || !conn.apiKey) return { woken: 0, done: false };
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { subscriptionStatus: true } });
  if (!hasActiveAccess(business?.subscriptionStatus)) return { woken: 0, done: false };

  if (await prisma.auditEvent.findFirst({ where: { businessId, action: "ghl.history_done" }, select: { id: true } })) return { woken: 0, done: true };
  const rule = await prisma.automation.findFirst({ where: { businessId, action: DEAD_LEAD_ACTION }, select: { enabled: true, triggerDays: true } });
  if (rule && !rule.enabled) return { woken: 0, done: false };

  const today = await prisma.auditEvent.count({ where: { businessId, action: "ghl.history_woken", createdAt: { gte: new Date(now - DAY_MS) } } });
  let room = WAKE_PER_DAY - today;
  if (room <= 0) return { woken: 0, done: false };

  const quietFrom = new Date(now - (rule?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS) * DAY_MS);
  const oldest = new Date(now - HISTORY_MAX_DAYS * DAY_MS);
  const stored = await cursorOf(businessId);
  let before = stored && stored < quietFrom ? stored : quietFrom;
  let woken = 0;
  let done = false;

  const { rows, full } = await ghlConversationsBefore(conn.apiKey, before, PAGE_SIZE);
  if (rows.length === 0) {
    // Nothing older: finished. Or a full page with nothing older than asked, which means the account didn't page
    // as asked; stopped too, rather than asking again every two minutes for nothing.
    done = true;
    if (full) console.warn(`GoHighLevel wake-up for business ${businessId}: conversation search did not page by date; stopped.`);
  }
  let looked = 0;
  for (const row of rows) {
    if (looked >= LOOK_PER_RUN || room <= 0) break;
    if (row.lastMessageAt < oldest) {
      done = true;
      break;
    }
    looked++;
    const outcome = await wakeConversation(businessId, conn.apiKey, row);
    before = row.lastMessageAt;
    if (outcome === "woken") {
      woken++;
      room--;
    }
  }
  // The last page, and every row on it looked at: nothing older is left.
  if (!full && looked === rows.length) done = true;

  await recordAudit({ businessId, userId: null }, "ghl.history_slice", { meta: { cursor: before.toISOString(), woken } });
  if (done) await recordAudit({ businessId, userId: null }, "ghl.history_done", { meta: { woken } });
  return { woken, done };
}

/** Every GoHighLevel business's next few old customers, after each poll (/api/cron/ghl-poll). */
export async function wakeGhlHistoryForAllBusinesses(): Promise<{ woken: number; failed: number }> {
  const connections = await prisma.crmConnection.findMany({ where: { provider: "gohighlevel", apiKey: { not: null } }, select: { businessId: true } });
  let woken = 0;
  let failed = 0;
  for (const { businessId } of connections) {
    try {
      woken += (await wakeGhlHistoryForBusiness(businessId)).woken;
    } catch (err) {
      failed++;
      console.error(`GoHighLevel wake-up failed for business ${businessId}:`, err instanceof Error ? err.message : err);
    }
  }
  return { woken, failed };
}
