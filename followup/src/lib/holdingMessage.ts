/**
 * The "we got you" message (founder, 2026-09-26).
 *
 * On an account that sends by itself, a question about a price or a date
 * is still the owner's to answer: the risk check holds that draft and the
 * owner is told. If the owner hasn't answered 30 minutes later, the
 * customer gets ONE short message that says the question was seen and
 * promises nothing:
 *
 *   "Thanks for asking! Let me check and I'll send you the price soon."
 *
 * The owner's decision still waits in the queue with the real reply
 * already written. Asked what should happen at 30 minutes, the founder
 * chose this over leaving the customer in silence ("option 2").
 *
 * What it will never do, each one a rule below:
 *  - name a number, a day or a time. The lines are fixed text, translated
 *    into the customer's language and nothing else — never generated.
 *  - go to a tense conversation. The risk check's topic has to be "price"
 *    or "date"; "tense" and "other" get nothing automatic.
 *  - go out on an account that holds everything ("Assisted"), or is
 *    paused, or has no active billing. A holding message that waits for
 *    the owner's OK defeats itself.
 *  - go twice for the same message. Lead.holdingSentFor is the claim.
 *  - go if anything at all was sent after the customer's message — the
 *    instant "got your message" to a brand-new customer already did this
 *    job, and a second placeholder would just be noise.
 *  - reach back. The customer's message has to be newer than the moment
 *    the owner turned sending on, and no older than HOLDING_MAX_AGE_MS
 *    (inside Meta's 24-hour window, with room to spare).
 *
 * It is recorded as an ordinary automated send with trigger "holding",
 * which src/lib/notAnAnswer.ts lists beside the instant ack as "not an
 * answer": the held draft stays in the queue, Today still shows the
 * customer waiting on the owner, and no report counts it as a reply.
 */
import { prisma } from "@/lib/db";
import { localizeFixedText } from "@/lib/integrations/openai";
import { composeFollowUpEmail } from "@/lib/sender";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { requireActiveBilling } from "@/lib/billing";
import { greetingFirstName } from "@/lib/leadName";
import { leadLanguageOf } from "@/lib/leadLanguage";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { mapWithConcurrency } from "@/lib/concurrency";

export const HOLDING_TRIGGER = "holding";

/** How long a price or date question waits for the owner before the customer is told. */
export const HOLDING_DELAY_MS = 30 * 60_000;

/**
 * The oldest customer message it will cover. Twenty hours keeps every send
 * inside Meta's 24-hour reply window on Instagram, Messenger and WhatsApp
 * with room for a slow tick, and a "let me check" a day late is not a
 * holding message any more.
 */
export const HOLDING_MAX_AGE_MS = 20 * 3_600_000;

/** The topics that get a holding message. See Lead.suggestedRiskTopic. */
const HOLDING_TOPICS = ["price", "date"] as const;
type HoldingTopic = (typeof HOLDING_TOPICS)[number];

/**
 * The lines, in English, translated into the customer's language at send
 * time and not otherwise touched. Fixed on purpose: generated text is where
 * a number or a day could slip in.
 */
export const HOLDING_LINES: Record<HoldingTopic, string> = {
  price: "Thanks for asking! Let me check and I'll send you the price soon.",
  date: "Thanks! Let me check the calendar and I'll confirm a time with you soon.",
};

export function isHoldingTopic(topic: string | null | undefined): topic is HoldingTopic {
  return HOLDING_TOPICS.includes(topic as HoldingTopic);
}

export type HoldingResult = { checked: number; sent: number; skipped: string[] };

/**
 * One business's due holding messages. Everything that decides WHETHER a
 * lead gets one is in here, so the cron route stays a thin door.
 */
export async function runHoldingMessagesForBusiness(businessId: string, now: Date = new Date()): Promise<HoldingResult> {
  const result: HoldingResult = { checked: 0, sent: 0, skipped: [] };

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { holdAllForApproval: true, sendingPausedAt: true, autoSendAllowedAt: true },
  });
  // Automatic only: not holding, not paused, and sending was turned on at a
  // known moment (the "from now on" line every automated path respects).
  if (!business || business.holdAllForApproval || business.sendingPausedAt || !business.autoSendAllowedAt) return result;
  if (!(await requireActiveBilling(businessId))) return result;

  const newestAllowed = new Date(now.getTime() - HOLDING_DELAY_MS);
  const oldestAllowed = new Date(Math.max(now.getTime() - HOLDING_MAX_AGE_MS, business.autoSendAllowedAt.getTime()));
  if (oldestAllowed >= newestAllowed) return result;

  const candidates = await prisma.lead.findMany({
    where: {
      businessId,
      automationTier: { not: "OFF" },
      stage: { notIn: ["WON", "LOST"] },
      suggestedMessage: { not: null },
      suggestedRiskLevel: { in: ["medium", "high"] },
      suggestedRiskTopic: { in: [...HOLDING_TOPICS] },
      lastContacted: { gte: oldestAllowed },
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      suggestedRiskTopic: true,
      holdingSentFor: true,
      language: true,
      languageScript: true,
      languageRegister: true,
    },
  });
  if (candidates.length === 0) return result;

  // Only a draft that is actually waiting for the owner. A draft the owner
  // already sent, dismissed or answered some other way is not a decision
  // anyone is waiting on.
  const pending = new Set((await getPendingApprovals(businessId)).map((a) => a.leadId));

  for (const lead of candidates) {
    result.checked++;
    if (!pending.has(lead.id)) continue;
    const topic = lead.suggestedRiskTopic;
    if (!isHoldingTopic(topic)) continue;

    // The customer has to be the last one to have written, 30 minutes to
    // 20 hours ago, and nothing may have gone to them since — not even an
    // acknowledgement.
    const newest = await prisma.message.findFirst({
      where: { conversation: { leadId: lead.id } },
      orderBy: { sentAt: "desc" },
      select: { direction: true, sentAt: true, body: true },
    });
    if (!newest || newest.direction !== "inbound") continue;
    if (newest.sentAt > newestAllowed || newest.sentAt < oldestAllowed) continue;
    if (lead.holdingSentFor && lead.holdingSentFor >= newest.sentAt) continue;

    // The claim, before the send: two ticks racing on one lead cannot both
    // get past this.
    const claim = await prisma.lead.updateMany({
      where: {
        id: lead.id,
        OR: [{ holdingSentFor: null }, { holdingSentFor: { lt: newest.sentAt } }],
      },
      data: { holdingSentFor: newest.sentAt },
    });
    if (claim.count === 0) continue;

    const outcome = await sendHoldingMessage(lead, topic, newest.body);
    if (outcome.sent) {
      result.sent++;
    } else {
      // Released unless the send was parked for a retry (it is still going
      // out), so a later tick can try again.
      if (!outcome.queued) {
        await prisma.lead
          .updateMany({ where: { id: lead.id, holdingSentFor: newest.sentAt }, data: { holdingSentFor: lead.holdingSentFor } })
          .catch((e) => console.error(`Failed to release the holding claim for lead ${lead.id}:`, e));
      }
      result.skipped.push(`${lead.name}: ${outcome.reason}`);
    }
  }
  return result;
}

async function sendHoldingMessage(
  lead: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    language: string | null;
    languageScript: string | null;
    languageRegister: string | null;
  },
  topic: HoldingTopic,
  customerMessage: string
): Promise<{ sent: boolean; queued?: boolean; reason: string }> {
  const channel = await detectAutomatedReplyChannel(lead);
  if (!channel) return { sent: false, reason: "no channel to reply on" };

  const businessId = (await prisma.lead.findUnique({ where: { id: lead.id }, select: { businessId: true } }))?.businessId;
  if (!businessId) return { sent: false, reason: "lead not found" };

  const leadLanguage = leadLanguageOf(lead);
  const line = await localizeFixedText(HOLDING_LINES[topic], customerMessage, leadLanguage);
  const body =
    channel === "email"
      ? await composeFollowUpEmail(greetingFirstName(lead.name), businessId, line, {
          languageSample: customerMessage,
          leadLanguage,
        })
      : line;

  const result = await sendFollowUpToLead(lead.id, body, {
    automated: true,
    trigger: HOLDING_TRIGGER,
    channel,
    // Identifiers only, never message text (recordAudit's contract).
    extraAuditMeta: { topic },
  });
  if (result.success) return { sent: true, reason: "sent" };
  return { sent: false, queued: Boolean(result.queuedRetryAt), reason: result.message ?? "send failed" };
}

/**
 * Every business with a lead that could be due. Cheap when there is
 * nothing to do: one indexed query on the leads that carry a held price or
 * date draft and were written to recently.
 */
export async function runDueHoldingMessages(now: Date = new Date()): Promise<HoldingResult> {
  const due = await prisma.lead.findMany({
    where: {
      suggestedRiskTopic: { in: [...HOLDING_TOPICS] },
      suggestedMessage: { not: null },
      lastContacted: { gte: new Date(now.getTime() - HOLDING_MAX_AGE_MS) },
      business: { holdAllForApproval: false, sendingPausedAt: null },
    },
    select: { businessId: true },
    distinct: ["businessId"],
  });

  // One business failing must not cost every other business its messages.
  const results = await mapWithConcurrency(due, 3, async ({ businessId }) => {
    try {
      return await runHoldingMessagesForBusiness(businessId, now);
    } catch (err) {
      console.error(`Holding-message run failed for business ${businessId}:`, err);
      return { checked: 0, sent: 0, skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`] };
    }
  });

  const totals: HoldingResult = { checked: 0, sent: 0, skipped: [] };
  for (const r of results) {
    totals.checked += r.checked;
    totals.sent += r.sent;
    totals.skipped.push(...r.skipped);
  }
  return totals;
}
