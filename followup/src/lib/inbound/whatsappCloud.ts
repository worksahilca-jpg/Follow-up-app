import { prisma } from "@/lib/db";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { recordAudit } from "@/lib/audit";
import { findOrCreateConversation } from "@/lib/conversations";
import { captureDirectReply, createInboundMessageIfNew } from "@/lib/instagram";
import { findOrCreateLeadByPhone } from "@/lib/twilio";
import { isOptInMessage, isOptOutMessage } from "@/lib/optOutKeywords";
import { pickAssignee } from "@/lib/assignment";
import { judgeHistoryThread, knownOnAnotherChannel } from "@/lib/inbound/whatsappHistoryFilter";
// Named UiMessage locally: this file already has its own WaMessage (Meta's
// wire shape), and two things called Message in one file is how the wrong
// one gets used.
import type { Message as UiMessage } from "@/lib/types";

/**
 * Everything the WhatsApp Cloud API webhook does AFTER the signed envelope
 * is on disk in InboundWebhookEvent (src/app/api/whatsapp/webhook/route.ts)
 * — the same persist-first shape as the Twilio and Meta processors, so a
 * replay runs exactly the code the live delivery ran.
 *
 * Four webhook fields matter (research/integrations/2026-09-19-whatsapp-
 * coexistence.md), and each entry routes to the business whose
 * whatsappPhoneNumberId matches value.metadata.phone_number_id:
 *
 *  - `messages`            a customer wrote, or a status update for a
 *                          message FollowUp sent (sent/delivered/read/failed)
 *  - `smb_message_echoes`  the OWNER replied from the WhatsApp Business app
 *                          on their phone. Captured as a real outbound
 *                          message so FollowUp never replies on top of it and
 *                          the human-neglect rule sees the thread as answered
 *  - `history`             a one-time sync of past chats (up to 6 months)
 *                          when a number is first connected. Capture ONLY:
 *                          no acknowledgement, no drafts, no routing.
 *  - `smb_app_state_sync`  contacts and labels — nothing a lead needs; ignored
 *
 * Every write is idempotent on Message.externalId (Meta's "wamid"), which
 * is what makes Meta's redeliveries and our own replays harmless.
 *
 * No billing gate, on purpose — see the route. Capture is free; the
 * money-spending half pauses inside checkAiEligibility (@/lib/billing).
 */

/**
 * Threads older than this are not imported from the history sync. A chat
 * that went quiet three months ago is not a lead FollowUp should wake up
 * with "still interested?" the day the owner connects; the product's job
 * is the ones that are still warm. Founder can widen it.
 */
export const HISTORY_IMPORT_MAX_AGE_DAYS = 30;

/** One `changes[].value` as Meta posts it — only the keys this file reads, all optional and unverified until read. */
type ChangeValue = {
  metadata?: { phone_number_id?: unknown };
  contacts?: unknown;
  messages?: unknown;
  statuses?: unknown;
  message_echoes?: unknown;
  history?: unknown;
};

type WaMessage = {
  from?: unknown;
  id?: unknown;
  timestamp?: unknown;
  type?: unknown;
  text?: { body?: unknown };
  button?: { text?: unknown };
  interactive?: { button_reply?: { title?: unknown }; list_reply?: { title?: unknown } };
  [key: string]: unknown;
};

/**
 * What to store for one message, and what the person actually typed.
 * Same contract as messageContent() in src/lib/inbound/meta.ts: `body` is
 * what the thread shows, `ownWords` is the only thing the acknowledgement
 * may answer, and an attachment-only message is a real message rather than
 * a dropped lead. Null for things that are not a message at all (a
 * reaction, a system notice).
 */
export function whatsappMessageContent(message: unknown): { body: string; ownWords: string } | null {
  const m = (message ?? {}) as WaMessage;
  const type = typeof m.type === "string" ? m.type : "";
  if (type === "reaction" || type === "system" || type === "request_welcome") return null;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (type === "text") {
    const words = str(m.text?.body);
    return words ? { body: words, ownWords: words } : null;
  }
  // A tap on a template's quick-reply button, or an interactive reply —
  // the button's title is what they chose, so it reads as their words.
  if (type === "button") {
    const words = str(m.button?.text);
    return words ? { body: words, ownWords: words } : null;
  }
  if (type === "interactive") {
    const words = str(m.interactive?.button_reply?.title) || str(m.interactive?.list_reply?.title);
    return words ? { body: words, ownWords: words } : null;
  }
  if (type === "location") return { body: "[Shared a location]", ownWords: "" };
  if (type === "contacts") return { body: "[Shared a contact card]", ownWords: "" };

  // image, video, audio, document, sticker, unsupported, and anything Meta
  // adds later. A caption is the person's own words; the file itself is
  // noted, not fetched (Coexistence media is only available for 14 days,
  // and a photo of the broken thing is a perfectly ordinary first contact).
  const media = (m[type] ?? null) as { caption?: unknown } | null;
  const caption = str(media?.caption);
  if (caption) return { body: caption, ownWords: caption };
  return { body: `[Sent ${type ? `a ${type}` : "an attachment"} with no message text]`, ownWords: "" };
}

function whenSent(timestamp: unknown): Date {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

/** wa_id → profile name, from the `contacts` array Meta sends beside messages. */
function contactNames(value: { contacts?: unknown }): Map<string, string> {
  const names = new Map<string, string>();
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  for (const c of contacts) {
    const waId = (c as { wa_id?: unknown })?.wa_id;
    const name = (c as { profile?: { name?: unknown } })?.profile?.name;
    if (typeof waId === "string" && typeof name === "string" && name.trim()) names.set(waId, name.trim());
  }
  return names;
}

export async function processWhatsAppCloudEnvelope(payload: { object?: string; entry?: unknown }): Promise<void> {
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return;

  for (const entry of payload.entry) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const field: unknown = change?.field;
      const value = (change?.value ?? {}) as ChangeValue;
      const phoneNumberId = value.metadata?.phone_number_id;
      if (typeof phoneNumberId !== "string" || !phoneNumberId) continue;

      const business = await prisma.business.findUnique({
        where: { whatsappPhoneNumberId: phoneNumberId },
        select: { id: true },
      });
      if (!business) continue; // a number no business here has connected

      if (field === "messages") await handleMessages(business.id, value);
      else if (field === "smb_message_echoes") await handleEchoes(business.id, value);
      else if (field === "history") await handleHistory(business.id, value);
      // smb_app_state_sync and anything else: not lead traffic.
    }
  }
}

async function handleMessages(businessId: string, value: { messages?: unknown; statuses?: unknown; contacts?: unknown }): Promise<void> {
  const names = contactNames(value);

  for (const raw of Array.isArray(value.messages) ? value.messages : []) {
    const m = (raw ?? {}) as WaMessage;
    const from = typeof m.from === "string" ? m.from : "";
    const wamid = typeof m.id === "string" ? m.id : undefined;
    const content = whatsappMessageContent(m);
    if (!from || !content) continue;

    const sentAt = whenSent(m.timestamp);
    // "+" + wa_id: the same identity an SMS from that number would have, so
    // one person is one lead whichever way they wrote (see findOrCreateLeadByPhone).
    const lead = await findOrCreateLeadByPhone(businessId, `+${from}`, "WhatsApp", names.get(from));
    const conversation = await findOrCreateConversation(lead.id, "whatsapp");
    const isNew = await createInboundMessageIfNew(conversation.id, content.body, sentAt, wamid);

    // STOP/START before anything else touches this lead — the same rule,
    // and the same record (Lead.optedOutAt, shared with SMS), as the Twilio
    // path in src/lib/inbound/twilioMessage.ts. `ownWords`, never a
    // placeholder FollowUp wrote for an attachment.
    const optingOut = isOptOutMessage(content.ownWords);
    const optingIn = isOptInMessage(content.ownWords);
    if (optingOut || optingIn) {
      await prisma.lead.update({ where: { id: lead.id }, data: { optedOutAt: optingOut ? new Date() : null } });
      void recordAudit({ businessId, userId: null }, optingOut ? "lead.opt_out" : "lead.opt_in", {
        targetType: "lead",
        targetId: lead.id,
        meta: { channel: "whatsapp", via: "keyword" },
      });
    }

    // Meta redelivered it — recorded already, and consent above is settled
    // either way, so nothing below re-runs.
    //
    // This guard used to sit ABOVE the consent block, which meant a STOP
    // whose first processing failed after the message row was written was
    // skipped forever on every redelivery: "already recorded", opt-out
    // never applied, and someone who asked to be left alone kept getting
    // messages. Safe to repeat — the update is idempotent.
    if (!isNew) continue;

    if (!optingOut) {
      // Parked for the DM grace period (src/lib/acknowledge.ts) — the owner
      // gets ~2 minutes to answer from their own phone first, and with
      // Coexistence that reply arrives here as an echo and cancels the ack.
      await acknowledgeNewLead(lead.id, { channel: "whatsapp", inboundText: content.ownWords, inboundAt: sentAt });
    }
    await scoreAndDraftForLead(lead.id);
    await checkRapidEngagement(lead.id);
  }

  // Delivery outcomes for messages FollowUp sent. Same columns Twilio's
  // status callback writes, scoped to this business the same way — see
  // src/app/api/twilio/status/[secret]/route.ts for why the scope matters.
  // "failed" is what the rescue score reads as "Can't reach" (src/lib/rescue.ts).
  for (const raw of Array.isArray(value.statuses) ? value.statuses : []) {
    const s = (raw ?? {}) as { id?: unknown; status?: unknown; errors?: unknown };
    if (typeof s.id !== "string" || typeof s.status !== "string") continue;
    const firstError = Array.isArray(s.errors) ? (s.errors[0] as { code?: unknown; title?: unknown; message?: unknown } | undefined) : undefined;
    await prisma.message
      .updateMany({
        where: { externalId: s.id, conversation: { lead: { businessId } } },
        data: {
          deliveryStatus: s.status,
          deliveryErrorCode: firstError?.code !== undefined && firstError.code !== null ? String(firstError.code) : null,
          deliveryErrorMessage:
            typeof firstError?.message === "string" ? firstError.message : typeof firstError?.title === "string" ? firstError.title : null,
          deliveryUpdatedAt: new Date(),
        },
      })
      .catch((err) => {
        console.error(`Failed to record WhatsApp delivery status for ${s.id}:`, err);
      });
  }
}

/**
 * The owner answered from their phone. Same treatment as a Meta echo on
 * Instagram/Messenger (src/lib/inbound/meta.ts): a real outbound Message,
 * source "whatsapp_direct", lastContacted bumped — so the neglect rule,
 * the pending acknowledgement and the drafts all see "already answered".
 */
async function handleEchoes(businessId: string, value: { message_echoes?: unknown; contacts?: unknown }): Promise<void> {
  const names = contactNames(value);
  for (const raw of Array.isArray(value.message_echoes) ? value.message_echoes : []) {
    const m = (raw ?? {}) as WaMessage & { to?: unknown };
    const to = typeof m.to === "string" ? m.to : "";
    const content = whatsappMessageContent(m);
    if (!to || !content) continue;
    const lead = await findOrCreateLeadByPhone(businessId, `+${to}`, "WhatsApp", names.get(to));
    const wamid = typeof m.id === "string" ? m.id : undefined;
    await captureDirectReply(lead.id, "whatsapp", content.body, "whatsapp_direct", wamid, whenSent(m.timestamp));
  }
}

/**
 * The one-time history sync after connecting. Capture only, and only the
 * threads that are still warm (HISTORY_IMPORT_MAX_AGE_DAYS):
 *
 *  - no acknowledgement — these people wrote weeks ago and may have been
 *    answered on the phone; "thanks for your message" now would be absurd;
 *  - no scoring or drafts — nothing here is a new enquiry; the hourly
 *    silence check will look at these threads like any other once they
 *    exist, which is the right amount of attention;
 *  - no source routing — a per-source rule that enrols new WhatsApp leads
 *    in a sequence must not fire a sequence at a month of old chats. So
 *    the lead is created here directly rather than through
 *    findOrCreateLeadByPhone, which routes on creation by design.
 *
 * Direction: Meta's `from` is the sender's wa_id; a thread is keyed by the
 * customer's wa_id, so a message from the thread id is theirs and anything
 * else is the owner's. Owner messages are stored with source
 * "whatsapp_direct", the same mark an echo gets.
 */
async function handleHistory(businessId: string, value: { history?: unknown; contacts?: unknown }): Promise<void> {
  const names = contactNames(value);
  const cutoff = Date.now() - HISTORY_IMPORT_MAX_AGE_DAYS * 24 * 60 * 60_000;
  // Who this number belongs to and what they do — the classifier's most
  // important input, fetched once for the whole import rather than per
  // thread (same as gmail.ts does for a sync run).
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { name: true, industry: true },
  });

  for (const chunk of Array.isArray(value.history) ? value.history : []) {
    const threads = Array.isArray((chunk as { threads?: unknown })?.threads) ? ((chunk as { threads: unknown[] }).threads) : [];
    for (const rawThread of threads) {
      const thread = (rawThread ?? {}) as { id?: unknown; messages?: unknown };
      const waId = typeof thread.id === "string" ? thread.id : "";
      const messages = (Array.isArray(thread.messages) ? thread.messages : []) as WaMessage[];
      if (!waId || messages.length === 0) continue;

      const newestAt = messages.reduce((max, m) => Math.max(max, whenSent(m.timestamp).getTime()), 0);
      if (newestAt < cutoff) continue;

      const phone = `+${waId}`;
      const contactName = names.get(waId);

      // Render the thread the way the classifier reads every other
      // channel's, so one definition of "customer" covers all of them.
      const transcript: UiMessage[] = messages
        .flatMap<UiMessage>((m) => {
          const content = whatsappMessageContent(m);
          if (!content) return [];
          return [
            {
              id: typeof m.id === "string" ? m.id : "",
              direction: m.from === waId ? "inbound" : "outbound",
              channel: "whatsapp",
              body: content.body,
              date: whenSent(m.timestamp).toISOString(),
              opened: false,
            },
          ];
        })
        // Oldest first: stage 1 reads the opening, stage 2 the newest.
        // Meta's ordering within a thread is not promised, and both stages
        // depend on which end they are reading.
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // The owner's own number carries their private life too — their
      // accountant, their supplier, their family. Importing every chat as
      // a lead put all of that in the pipeline, scored and drafted for.
      // Two looks before anything is set aside, and a refusal is recorded
      // where the owner can see it and undo it, never deleted.
      const verdict = await judgeHistoryThread(
        transcript,
        { name: contactName ?? "WhatsApp contact", phone },
        business ?? undefined,
        { knownOnAnotherChannel: await knownOnAnotherChannel(businessId, phone) }
      );

      if (!verdict.import) {
        // Not a lead — but never silently, and never destroyed. The same
        // record and the same one-tap restore the mailbox syncs use.
        await prisma.filteredEmail.upsert({
          where: { businessId_threadId: { businessId, threadId: `whatsapp:${waId}` } },
          update: {
            reason: verdict.reason,
            threadPayload: { phone, name: contactName ?? null, messages: transcript },
            lastMessageAt: new Date(newestAt),
          },
          create: {
            businessId,
            threadId: `whatsapp:${waId}`,
            provider: "whatsapp",
            senderName: contactName ?? phone,
            senderPhone: phone,
            reason: verdict.reason,
            // Kept so Restore can rebuild the conversation — Meta will not
            // hand this history over a second time.
            threadPayload: { phone, name: contactName ?? null, messages: transcript },
            lastMessageAt: new Date(newestAt),
          },
        });
        continue;
      }

      const lead = await findOrCreateHistoryLead(businessId, phone, contactName, new Date(newestAt));
      const conversation = await findOrCreateConversation(lead.id, "whatsapp");

      for (const m of messages) {
        const content = whatsappMessageContent(m);
        const wamid = typeof m.id === "string" ? m.id : undefined;
        if (!content || !wamid) continue;
        const inbound = m.from === waId;
        await prisma.message.upsert({
          where: { externalId: wamid },
          update: {},
          create: {
            conversationId: conversation.id,
            direction: inbound ? "inbound" : "outbound",
            body: content.body,
            externalId: wamid,
            sentAt: whenSent(m.timestamp),
            ...(inbound ? {} : { source: "whatsapp_direct" }),
          },
        });
      }
    }
  }
}

/**
 * "This WhatsApp chat WAS a customer after all" — the owner overruling
 * both stages of the import filter.
 *
 * Rebuilds the lead and its conversation from what the filtered row kept,
 * because Meta will not deliver that history again. Same posture as the
 * import it reverses: capture only. No acknowledgement (these people
 * wrote weeks ago), no source routing (a per-source rule must not fire a
 * sequence at an old chat). The caller scores it afterwards, exactly as
 * the mailbox restore does.
 */
export async function restoreWhatsAppHistoryThread(
  businessId: string,
  thread: { phone: string; name: string | null; messages: { direction: "inbound" | "outbound"; body: string; date: string; id: string }[] }
) {
  const newestAt = thread.messages.reduce(
    (max, m) => Math.max(max, new Date(m.date).getTime()),
    0
  );
  const lead = await findOrCreateHistoryLead(
    businessId,
    thread.phone,
    thread.name ?? undefined,
    new Date(newestAt || Date.now())
  );
  const conversation = await findOrCreateConversation(lead.id, "whatsapp");

  for (const m of thread.messages) {
    if (!m.id) continue;
    await prisma.message.upsert({
      where: { externalId: m.id },
      update: {},
      create: {
        conversationId: conversation.id,
        direction: m.direction,
        body: m.body,
        externalId: m.id,
        sentAt: new Date(m.date),
        ...(m.direction === "inbound" ? {} : { source: "whatsapp_direct" }),
      },
    });
  }
  return lead;
}

async function findOrCreateHistoryLead(businessId: string, phone: string, name: string | undefined, newestAt: Date) {
  const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
  if (existing) {
    // Only ever moves lastContacted forward; a lead the owner touched
    // yesterday is not "last contacted" three weeks ago because a sync
    // arrived.
    await prisma.lead.updateMany({ where: { id: existing.id, lastContacted: { lt: newestAt } }, data: { lastContacted: newestAt } });
    return existing;
  }
  try {
    return await prisma.lead.create({
      data: {
        businessId,
        name: name || phone,
        phone,
        source: "WhatsApp",
        stage: "NEW",
        lastContacted: newestAt,
        assignedToId: await pickAssignee(businessId),
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.lead.findFirst({ where: { businessId, phone } });
      if (winner) return winner;
    }
    throw err;
  }
}
