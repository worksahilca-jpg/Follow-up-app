/**
 * The actual auto-send job. Two gates both have to be open for a lead to
 * be CONSIDERED for an automated message:
 *   1. The business-level Automation row is enabled (Settings' "Auto
 *      follow-up on silence" toggle) — the master switch.
 *   2. That specific Lead's automationTier is not OFF. Since 2026-09-06
 *      (CEO decision, see schema.prisma's AutomationTier comment) a new
 *      lead starts on ASSISTED, not OFF — the per-lead selector on its
 *      detail page is how an owner dials a lead *down* to OFF or *up* to
 *      AUTONOMOUS, not an opt-in gate a lead starts behind.
 *
 * Which tier decides what happens next:
 *   - ASSISTED: the draft still passes assessSendRisk() (see openai.ts)
 *     first. "Opted in" means "send the safe stuff for me," not "send
 *     anything" — a draft that touches pricing/terms/commitments, or
 *     follows a conversation that's turned negative, is saved as the
 *     lead's suggestedMessage and left for manual approval instead, the
 *     same as any non-automated draft already is.
 *   - AUTONOMOUS: the risk check is skipped entirely and the draft is
 *     sent regardless of what it says. This is the one place in the app
 *     that sends without any review — real trust decision, opt-in per
 *     lead, never a default.
 *
 * Multi-tenant: runAutomationForBusiness() takes an explicit businessId —
 * the "Run automation check now" button in Settings only ever runs it for
 * the signed-in user's own business (see the API route). Nothing runs this
 * on a schedule by itself; runAutomationForAllBusinesses() is what a real
 * scheduler (e.g. Vercel Cron) would call once deployed, looping over
 * every business that has automation enabled.
 */

import { prisma } from "@/lib/db";
import { settledByTalk, lastInboundTime } from "@/lib/talked";
import { generateFollowUpMessage, assessSendRisk } from "@/lib/integrations/openai";
import { draftDm, readStoredQuickReplies } from "@/lib/dmDrafting";
import { conversationText } from "@/lib/dmDrafts";
import { ungroundedSpecifics } from "@/lib/grounding";
import { isExitPayload, toQuickReplies, type StoredQuickReplies } from "@/lib/quickReplies";
import { Prisma } from "@prisma/client";
import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import { sendFollowUpToLead, detectAutomatedReplyChannel } from "@/lib/sending";
import { requireActiveBilling, checkAiEligibility } from "@/lib/billing";
import { leadLanguageOf } from "@/lib/leadLanguage";
import { canSendOn, hasAnySendChannel } from "@/lib/sendChannels";
import { mapWithConcurrency } from "@/lib/concurrency";
import { flushHoldNotices, type HoldNotice } from "@/lib/holdNotices";
import { getVoiceSamples } from "@/lib/voice";
import { recordAudit } from "@/lib/audit";
import { isWithinSendWindow } from "@/lib/sendWindow";
import { isTransientError } from "@/lib/transientError";
import { greetingFirstName } from "@/lib/leadName";
import { isOptOutMessage, isOptInMessage } from "@/lib/optOutKeywords";
import { ackGracePeriodMs } from "@/lib/acknowledge";
import type { Message } from "@/lib/types";

export const UNANSWERED_ACTION = "unanswered_reply";
export const UNANSWERED_NAME = "Reply for me when I haven't";
export const UNANSWERED_DEFAULT_HOURS = 24;

// research/product/2026-09-09-followup-cadence-best-practices.md, §1:
// qualification odds fall off steepest in the first hours after a lead's
// FIRST real message — hour 3 of total silence on a brand-new lead is not
// equivalent to hour 24 of an established conversation going quiet, but
// findUnansweredLeads() used to treat them identically. Applies only when
// nothing substantive has gone out yet (the instant-ack template doesn't
// count — see the trigger check below); not user-configurable the way
// UNANSWERED_DEFAULT_HOURS is, at least for now, since it's meant to be a
// fixed safety net rather than another setting to tune.
export const UNANSWERED_FIRST_REPLY_HOURS = 3;

// Meta's 24-hour window and the 20-hour ceiling it forces on the unanswered
// rule live in @/lib/metaWindow — a leaf module with no imports, because
// Settings ("use client") has to show the owner the true number and this
// file pulls in Prisma. Re-exported here so nothing that already imports
// them from automation.ts has to move. The full reasoning is on the
// constants themselves.
import { META_DM_CHANNELS, META_DM_WINDOW_HOURS, META_HUMAN_AGENT_MAX_HOURS, UNANSWERED_META_DM_MAX_HOURS } from "@/lib/metaWindow";
export { META_DM_WINDOW_HOURS, UNANSWERED_META_DM_MAX_HOURS };
import { isInstagramLeadId, isMessengerLeadId } from "@/lib/instagramId";
import { HOLD_ALL_AUTOMATION_REASON, BACKLOG_BEFORE_PERMISSION_REASON, RISK_CHECK_FAILED_REASON, UNTOUCHED_LEAD_REASON, NEVER_WROTE_REASON, UNGROUNDED_DRAFT_REASONS } from "@/lib/holdReasons";

/**
 * How long this particular lead waits before the unanswered rule fires, in
 * hours. The one place that decision is made.
 *
 * A shared function rather than a shared constant because the rule now has
 * three inputs, and automationStatus.ts has to reach the same answer: it
 * renders the "Following up in Nh" badge, and its own header exists because
 * that badge silently disagreeing with the engine was already shipped once.
 * A ceiling applied in only one of the two would recreate exactly that bug —
 * the badge promising three more hours on a lead the cron is about to send.
 */
export function effectiveUnansweredHours(
  configuredHours: number,
  hasSubstantiveOutbound: boolean,
  channel: string | null | undefined
): number {
  // No substantive reply yet → the short first-reply safety net, which at 3
  // hours is already far inside any window and is never lengthened by the
  // ceiling below.
  const base = hasSubstantiveOutbound ? configuredHours : UNANSWERED_FIRST_REPLY_HOURS;
  if (channel && META_DM_CHANNELS.has(channel)) return Math.min(base, UNANSWERED_META_DM_MAX_HOURS);
  return base;
}

/**
 * This conversation happened BEFORE FollowUp ever saw it.
 *
 * Connecting Gmail imports three months of threads at once. Every
 * one of them arrives already silent, so the very next hourly tick
 * reads them as leads who went quiet and writes to all of them —
 * and none of those threads ever had a live moment under FollowUp's
 * watch. Whatever the owner already did about them (answered by
 * phone, met in person, lost the deal, decided not to bother) is
 * invisible here, so there is nothing to base a message on.
 *
 * What that actually produced, in the founder's own inbox on
 * 2026-09-09, on real people:
 *
 *   - An 84-day-old thread with a glass supplier: "We appreciate
 *     the clarity on the e-transfer process and will proceed
 *     accordingly." A payment commitment, in his voice, on a
 *     conversation from three months earlier.
 *   - A 50-day-old rental application, thanked as though it had
 *     just arrived.
 *   - A 38-day-old closed deal, congratulated again.
 *   - A 27-day-old cold pitch, answered "Thank you for your email".
 *
 * `isCold` (45 days) was meant to catch this and catches only some
 * of it — the 27-day one sailed straight through, and the threshold
 * was never the right question anyway. Age is a proxy. The real
 * property is whether FollowUp watched the silence happen or merely
 * inherited it, and `lastContacted < createdAt` says exactly that:
 * the newest message in the thread predates the lead row itself.
 *
 * Held, not dropped. Finding the follow-up nobody sent is the whole
 * product, so the draft is still written and still offered — the
 * owner just gets to see it first, which is the same call the
 * founder made for cold leads on 2026-09-15. Once anything happens
 * on the thread under FollowUp's watch, `lastContacted` moves past
 * `createdAt` and this stops applying forever after.
 */
export function isBackfilledThread(lead: { lastContacted: Date | null; createdAt: Date }): boolean {
  return !!lead.lastContacted && lead.lastContacted < lead.createdAt;
}

/**
 * "Nothing has happened on this lead since <cutoff>" — for a lead that
 * may never have had anything happen on it at all.
 *
 * `lastContacted` is null on every lead that arrived without a message:
 * typed into the manual form, imported from a CSV, logged after a phone
 * call. The eligibility queries below used to ask `lastContacted <=
 * cutoff` alone, and in SQL a comparison against NULL is NULL, not true
 * — so those leads matched nothing, ever. Not the silence check, not the
 * dead-lead sweep. They were filed and then left.
 *
 * Found in production on 2026-09-20: five leads on the founder's own
 * account, one of them sitting in NEGOTIATION since the first of the
 * month, none ever scored, drafted or followed up. "Never lose a lead
 * because nobody followed up" is the product, and the one kind of lead
 * an owner adds deliberately — because they care about it — was the kind
 * it ignored.
 *
 * `createdAt` is the honest fallback: for a lead nobody has contacted,
 * the clock starts when it was written down. Same substitution `isCold`
 * already makes a few hundred lines below.
 *
 * `notBefore` gives the half-open range (notBefore, cutoff], which is how
 * the silence query excludes leads that belong to the dead-lead sweep. It
 * replaced a separate `NOT: { lastContacted: { lte: deadCutoff } }`,
 * which would have been wrong the moment nulls were let in: `NOT (NULL <=
 * x OR …)` is NULL, and a row that evaluates to NULL is a row that does
 * not match.
 */
function quietSince(cutoff: Date, notBefore?: Date): Prisma.LeadWhereInput {
  const range = notBefore ? { lte: cutoff, gt: notBefore } : { lte: cutoff };
  return { OR: [{ lastContacted: range }, { lastContacted: null, createdAt: range }] };
}

export const DEAD_LEAD_ACTION = "dead_lead_reactivation";
export const DEAD_LEAD_NAME = "Reactivate cold leads";
// research/product/2026-09-09-followup-cadence-best-practices.md, §3: a
// lead a business has genuinely stopped chasing — not just a few days
// quiet, actually cold — needs a distinct campaign, not a longer version
// of the same silence trigger. 45 days is the low end of the 45-60-day
// range that research settled on; configurable 30-180 like triggerDays is
// for the main rule.
export const DEAD_LEAD_DEFAULT_DAYS = 45;

/* ------------------------------------------------------------------ *
 * The quiet-lead cadence — founder's follow-up strategy, 2026-09-25.
 * ------------------------------------------------------------------ */

// The reminder calendar lives in @/lib/reminderCadence (no server imports,
// so Settings can show the same days); re-exported here for existing callers.
import { SILENCE_DEFAULT_TRIGGER_DAYS, QUIET_REMINDER_DEFAULT_DAYS, quietReminderDays } from "@/lib/reminderCadence";
export { SILENCE_DEFAULT_TRIGGER_DAYS, QUIET_REMINDER_DEFAULT_DAYS, quietReminderDays };

/** Outbound messages this close to the previous counted one are the same touch (a split answer, a quick correction). */
const SAME_TOUCH_MS = 12 * 3_600_000;
const DAY_MS = 86_400_000;


/** One message as the cadence reads it — the shape both the engine (Prisma rows) and the badge (Message) reduce to. */
export type TimelineMessage = {
  direction: string;
  at: number; // ms since epoch
  trigger?: string | null;
  quickReplyPayload?: string | null;
};

function isAckMessage(m: { direction: string; trigger?: string | null }): boolean {
  return m.direction === "outbound" && m.trigger === "instant_ack";
}

/**
 * Has a welcome back already gone out since the customer last wrote?
 *
 * Read off the thread itself: an outbound message that followed at least
 * `deadLeadDays` of silence IS a reactivation, however it went out —
 * automatically, approved from Today, or typed by the owner after a long
 * gap. Reading a trigger column instead would miss the second and third,
 * and the second is the normal case on a holding account.
 *
 * Why it matters: research/product/2026-09-15-reaching-back-out-to-
 * ignored-leads.md §6.7 — one reactivation that goes unanswered is the
 * end; repeated attempts did worse than sending nothing in the largest
 * field experiment on file. Before this, the dead-lead rule fired again
 * every 45 days for as long as the lead existed.
 */
export function reactivationAlreadySent(messages: TimelineMessage[], deadLeadDays: number): boolean {
  const judged = messages.filter((m) => !isAckMessage(m)).sort((a, b) => a.at - b.at);
  let lastInbound = -1;
  judged.forEach((m, i) => {
    if (m.direction === "inbound") lastInbound = i;
  });
  for (let i = Math.max(1, lastInbound + 1); i < judged.length; i++) {
    if (judged[i].direction === "outbound" && judged[i].at - judged[i - 1].at >= deadLeadDays * DAY_MS) return true;
  }
  return false;
}

export type QuietReminderPlan = {
  /** 0-based index of the NEXT reminder; equal to the cadence length once it is finished. */
  step: number;
  /** When that reminder is due; null once the cadence is finished. */
  dueAt: Date | null;
};

/**
 * Where this lead is in the quiet-lead cadence — pure, so the engine and
 * the lead's status badge (src/lib/automationStatus.ts) cannot disagree
 * about it, which has shipped as a bug twice already for the unanswered
 * rule.
 *
 * Returns null when the customer spoke last: that lead is not quiet, a
 * reply is owed (the unanswered rule), or they tapped "Not now" and
 * nothing automatic goes to them at all. Either way the cadence has nothing
 * to say — "stop the moment they reply" is this line.
 *
 * Stateless on purpose. The step is COUNTED from the thread rather than
 * stored:
 *   - the anchor is our first message after their last one — the message
 *     they went quiet on (or, with no messages at all, `fallbackAnchorMs`,
 *     the lead's creation);
 *   - every later outbound touch counts, whoever sent it. A reminder the
 *     owner approved from Today is a "manual" send with no automation
 *     marker, and it must advance the cadence exactly like an automatic
 *     one — otherwise a holding account would get reminder 1 again three
 *     days after approving reminder 1. An owner's own nudge counts for the
 *     same reason: the customer does not care who pressed Send, only how
 *     many times they have been chased.
 * No column can drift from what the customer actually received, because
 * there is no column.
 *
 * Due at the later of the calendar day (anchor + days[step]) and the
 * default gap after the previous touch — so a reminder approved late
 * pushes the next one back instead of landing the day after it.
 */
export function quietReminderPlan(
  messages: TimelineMessage[],
  fallbackAnchorMs: number,
  triggerDays: number,
  deadLeadDays: number = DEAD_LEAD_DEFAULT_DAYS
): QuietReminderPlan | null {
  const days = quietReminderDays(triggerDays);
  const judged = messages.filter((m) => !isAckMessage(m)).sort((a, b) => a.at - b.at);
  const newest = judged[judged.length - 1];
  if (newest && newest.direction === "inbound") return null;

  // A welcome back went out after the cadence and nobody answered it: the
  // cadence does not start again on top of it (see reactivationAlreadySent).
  if (reactivationAlreadySent(messages, deadLeadDays)) return { step: days.length, dueAt: null };

  let lastInbound = -1;
  judged.forEach((m, i) => {
    if (m.direction === "inbound") lastInbound = i;
  });
  const ours = judged.slice(lastInbound + 1);
  const anchor = ours.length > 0 ? ours[0].at : fallbackAnchorMs;
  let touches = 0;
  let lastTouch = anchor;
  for (const m of ours.slice(1)) {
    if (m.at - lastTouch >= SAME_TOUCH_MS) {
      touches += 1;
      lastTouch = m.at;
    }
  }
  if (touches >= days.length) return { step: days.length, dueAt: null };
  const onCalendar = anchor + days[touches] * DAY_MS;
  const afterPrevious = touches === 0 ? onCalendar : lastTouch + (days[touches] - days[touches - 1]) * DAY_MS;
  return { step: touches, dueAt: new Date(Math.max(onCalendar, afterPrevious)) };
}

/**
 * The angle of each reminder, passed to the drafting prompt as its
 * messageHint — the same steering mechanism deadLeadMessageHint and
 * workflow steps use, deliberately not a second system prompt.
 *
 * Four different jobs, so no two read alike and none is "just checking
 * in" (founder, 2026-09-25; research 2026-09-09 §2 "each touch changing
 * the message angle"). The rules every one of them repeats rather than
 * assumes, per research 2026-09-15 §5:
 *   - no apology — the customer went quiet on US, nobody failed them, and
 *     an apology to someone unaware of any failure lowers trust (§1.2,
 *     Steer E);
 *   - no fact the conversation does not contain — the grounding check
 *     holds a draft that invents one anyway, but a hint that invites
 *     "offer a time slot" without this line would be inviting it;
 *   - never the words that signal nothing new to say.
 * Step 4 is research Steer D ("closing the file"): no question that needs
 * an answer, no deadline, nothing a person could read as pressure.
 */
export function quietReminderHint(step: number, daysQuiet: number): string {
  const number = Math.min(Math.max(step, 0), QUIET_REMINDER_DEFAULT_DAYS.length - 1) + 1;
  const angles = [
    "Angle for this one — a light nudge: remind them, in one short line and in their own terms, what they " +
      "asked about, and if the conversation already contains the answer, put that answer in front of them " +
      "again. End with one easy question.",
    "Angle for this one — something new and useful the earlier messages did not offer: another option that " +
      "fits what they described, an offer to find a time that suits them, or one relevant detail from this " +
      "conversation they may have missed. Do not restate the previous nudge. Do not name a specific day, time, " +
      "price or figure unless it already appears in the conversation.",
    "Angle for this one — one easy closing question and nothing else: ask whether they are still looking or " +
      "would rather you close this off, in a way that makes either answer feel completely fine. Two short " +
      "sentences at most.",
    "Angle for this one — the last message that will be sent about this. Two short sentences at most: say you " +
      "will leave it here for now, and that the door is open whenever they want to pick it back up. No question " +
      "that needs an answer, no deadline, no \"last chance\", nothing that reads as pressure.",
  ];
  return (
    `This is reminder ${number} of 4 to someone who went quiet after the last message here — nothing from them ` +
    `in about ${daysQuiet} days. ${angles[number - 1]} ` +
    "Do not apologise: they stopped replying, nobody let them down. Never write \"just checking in\", " +
    "\"circling back\", \"touching base\", \"following up\" or anything that means the same — every message must " +
    "give them a reason to read it. Do not repeat the wording or the angle of any earlier message in this " +
    "conversation. Never state a price, date, time or fact that is not already in the conversation."
  );
}

/* ------------------------------------------------------------------ *
 * A reply within five minutes — founder's follow-up strategy, 2026-09-25.
 * ------------------------------------------------------------------ */

/**
 * How recent a customer's message has to be for the fresh-reply worker to
 * treat it as "they just wrote" — and so answer it at any hour, outside
 * the send window. Same hour the instant acknowledgement uses for the same
 * question (STALE_AFTER_MS in acknowledge.ts): past it, the hourly
 * unanswered rule is the one that owns the lead.
 */
export const FRESH_REPLY_WINDOW_MS = 60 * 60_000;

/**
 * The shortest wait before the fresh-reply worker acts on a message,
 * on channels with no DM grace period (email, SMS, a web form).
 *
 * Long enough that the capture request that recorded the message has
 * finished what it does in-line — the instant acknowledgement decides (and
 * sends or holds) inside that same request, and scoring writes the draft —
 * so the worker finds a settled lead rather than racing the webhook into a
 * second reply. One minute, plus the worker's one-minute tick, keeps the
 * total well inside five.
 */
export const FRESH_REPLY_SETTLE_MS = 60_000;

/**
 * How long the worker waits for scoring's draft before writing one itself.
 * A capture path normally scores in-line within seconds; a sync that hit
 * its per-run scoring cap does not, and waiting for the next sync would
 * break the five-minute promise.
 */
export const FRESH_DRAFT_WAIT_MS = 2 * 60_000;

/** Nothing to answer: STOP/START are consent, handled by the capture path, never replied to by a draft. Exported for the status badge, which must agree. */
export function isConsentKeyword(body: string | null | undefined): boolean {
  return typeof body === "string" && (isOptOutMessage(body) || isOptInMessage(body));
}

/**
 * The newest customer message the fresh-reply worker should answer now,
 * or null. Pure, and exported so its rules can be pinned directly.
 *
 * Every refusal is a reason the lead is not this worker's to answer:
 *   - someone already answered (the last message, instant ack aside, is ours);
 *   - they tapped "Not now", or the message is a STOP/START keyword;
 *   - a voicemail or missed call — the call path has its own text-back,
 *     and a second automatic text two minutes later is the double reply;
 *   - older than FRESH_REPLY_WINDOW_MS — the hourly rule owns it;
 *   - younger than its channel's wait: the DM grace period on Instagram,
 *     Messenger and WhatsApp (DM_ACK_GRACE_PERIOD_MS — the owner's chance
 *     to answer first, and what batches three quick DMs into one reply),
 *     FRESH_REPLY_SETTLE_MS elsewhere;
 *   - the instant acknowledgement already answered THIS message — that was
 *     the reply within minutes, and a second automatic one straight after
 *     it is the "two slightly different replies" moment the grace period
 *     was built to prevent (acknowledge.ts). The fuller answer follows on
 *     the first-reply rule;
 *   - scoring's draft is not ready yet and FRESH_DRAFT_WAIT_MS has not
 *     passed — the next tick will find it ready rather than pay twice;
 *   - it was already handled: lastAutomationCheckedAt is at or after it.
 */
export function freshInboundToAnswer(
  lead: {
    suggestedDraftedFor: Date | null;
    lastAutomationCheckedAt: Date | null;
    talkedAt?: Date | null;
    conversations: { channel: string; messages: { direction: string; sentAt: Date; trigger: string | null; body: string; quickReplyPayload: string | null }[] }[];
  },
  nowMs: number
): Date | null {
  const all = lead.conversations.flatMap((c) => c.messages.map((m) => ({ ...m, channel: c.channel })));
  const judged = all.filter((m) => !isAckMessage(m));
  if (judged.length === 0) return null;
  const last = judged.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest));
  if (last.direction !== "inbound") return null;
  if (isExitPayload(last.quickReplyPayload) || isConsentKeyword(last.body)) return null;
  if (settledByTalk(lead.talkedAt, last.sentAt)) return null;
  if (last.channel === "call") return null;
  const age = nowMs - last.sentAt.getTime();
  if (age > FRESH_REPLY_WINDOW_MS) return null;
  const channelWait =
    last.channel === "instagram" || last.channel === "messenger" || last.channel === "whatsapp"
      ? Math.max(FRESH_REPLY_SETTLE_MS, ackGracePeriodMs(last.channel))
      : FRESH_REPLY_SETTLE_MS;
  if (age < channelWait) return null;
  if (all.some((m) => isAckMessage(m) && m.sentAt >= last.sentAt)) return null;
  const draftReady = lead.suggestedDraftedFor != null && lead.suggestedDraftedFor >= last.sentAt;
  if (!draftReady && age < FRESH_DRAFT_WAIT_MS) return null;
  if (lead.lastAutomationCheckedAt && lead.lastAutomationCheckedAt >= last.sentAt) return null;
  return last.sentAt;
}

/**
 * The narrow allowlist of failures worth retrying — moved to
 * src/lib/transientError.ts (a leaf module with no imports) now that the
 * outbound send queue needs the same judgement, and re-exported here so this
 * stays the name everything already imports. One classifier, one definition:
 * a second one would drift, and the whole reason this is an allowlist rather
 * than a denylist is that being generous costs real money (see that file).
 */
export { isTransientError };

interface AutomationResult {
  checked: number;
  unanswered: number; // of `checked`, how many were picked up because the LEAD wrote last and nobody answered
  reactivated: number; // of `checked`, how many were picked up because the lead has gone genuinely cold (DEAD_LEAD_ACTION)
  sent: number;
  held: number; // risk-gated: drafted and saved for manual approval instead of auto-sent
  // Instagram/Messenger leads whose 24-hour window has shut with nothing
  // from them: one message drafted for the OWNER to send under Meta's
  // human-agent allowance (days 2–7). Counted separately from `held`
  // because nothing was risk-gated — an automation simply may not send it.
  handedOff: number;
  // Outside the business's local send window (see sendWindow.ts) — not
  // sent this tick, not held for approval either, just retried on the
  // next in-window hourly tick. Distinct from `skipped`, which is a real
  // failure.
  deferred: number;
  // Not sent and not held for approval, for a reason that isn't "outside
  // the send window" (that's `deferred`) — a real failure (send errors,
  // exceptions) or a business rule that says this lead gets no AI
  // processing at all right now (Free tier's lead cap or channel
  // restriction, @/lib/billing).
  skipped: string[];
  heldReasons: string[]; // "{lead name}: {why it was held}", one per held lead
}

const EMPTY_RESULT: AutomationResult = {
  checked: 0,
  unanswered: 0,
  reactivated: 0,
  sent: 0,
  held: 0,
  handedOff: 0,
  deferred: 0,
  skipped: [],
  heldReasons: [],
};

/**
 * The messaging angle that makes a dead-lead reactivation actually work,
 * per the research's real-estate-vendor data (§3): name the actual
 * elapsed time in one sentence at most, then move on to something
 * concrete — never repeat "just checking in" or "circling back," the
 * single most-cited reason a reactivation-style message gets ignored.
 * Passed as generateFollowUpMessage()'s messageHint, the same steering
 * mechanism sequences.ts already uses per-step — this is deliberately
 * NOT a second system prompt, just a stronger steer on the existing one.
 *
 * `lastFrom` is who spoke last, and it decides the apology — the one part
 * of this message the research is clearest about
 * (research/product/2026-09-15-reaching-back-out-to-ignored-leads.md §1.2,
 * §5 Steer A/E, §7.1). An apology helps someone who already knows they
 * were failed and backfires on someone who does not, because the apology
 * itself manufactures the grievance. So:
 *   - "lead": they wrote and nobody here answered (reactivation.ts's
 *     COLD_UNANSWERED). They know. One warm apology, then the answer they
 *     were owed.
 *   - "business": we answered and THEY went quiet (COLD). Nobody failed
 *     them. No apology — the welcome back names the time, brings something
 *     new, and asks for little.
 * Until 2026-09-25 every message got the apology, which in practice meant
 * it went almost only to the second group: the dead-lead branch is
 * reached by leads whose last message is ours, and the reactivation batch
 * sends to COLD alone. The research's §7.1 flagged exactly that.
 */
export function deadLeadMessageHint(daysSinceContact: number, lastFrom: "lead" | "business" = "business"): string {
  return (
    `This lead has gone genuinely cold — nobody, on either side, has said anything in about ${daysSinceContact} ` +
    "days. This is a reactivation message, not a routine follow-up: name that actual elapsed time plainly " +
    "(e.g. \"it's been about a month since we last talked about...\"), in one sentence at most, then move on. " +
    "Never fall back to a vague \"just checking in\" or \"circling back\" — research on real reactivation " +
    "campaigns found that's the single most-cited reason this kind of message gets ignored, since it signals " +
    "nothing new to offer. Lead with something concrete and useful instead: reference a specific detail from " +
    "what they were originally interested in, not a generic status question. " +
    // What makes this message land as a belated reply rather than an
    // unsolicited approach — founder's call, 2026-09-15, and the reasoning
    // is worth keeping: the recipient has to recognise, in the first line,
    // which conversation this continues. One who does reads it as overdue
    // courtesy. One who doesn't is being emailed by a stranger about
    // nothing in particular, months later, which is the definition of the
    // thing people report as spam.
    //
    // This is also what makes the absence of an unsubscribe line defensible
    // rather than merely convenient: the message is a continuation of a
    // conversation the recipient took part in. If this instruction is ever
    // dropped, that stops being true, and the decision to omit the
    // unsubscribe should be revisited at the same time. (Only the apology
    // was split out on 2026-09-25; the recognition line stays for both.)
    (lastFrom === "lead"
      ? "Two things must be unmistakable. First, that THEY got in touch originally — say so plainly, in their " +
        "own terms (\"you got in touch about...\", \"you asked us about...\"), so there is no moment where they " +
        "wonder who this is or why they are hearing from you. Second, acknowledge honestly that they never got a " +
        "proper reply — one short, unfussy line, no grovelling and no excuses (\"sorry we never came back to you " +
        "on this\"), and never a second apology later in the message. Then actually answer what they asked, as " +
        "far as this conversation allows, and ask one clear question about whether they still need it. The whole " +
        "message should read like a person who just found this in their inbox and felt bad about it, because " +
        "that is exactly what happened."
      : "Make it unmistakable, in the first line, which conversation this continues — in their own terms if they " +
        "got in touch first (\"you asked us about...\") — so there is no moment where they wonder who this is. " +
        "Do not apologise and do not say they never heard back: they did, and then went quiet, and an apology to " +
        "someone nobody let down reads as a confession of a failure they never noticed. Bring them something they " +
        "did not have last time — another way you could help with what they wanted, or a detail from this " +
        "conversation that still matters — without stating any price, date or fact the conversation does not " +
        "contain, and ask for little: one easy question they can answer in a few words, or ignore at no cost.")
  );
}

/**
 * The human-neglect trigger — PRODUCT_DIRECTION.md main goal, point 2. The
 * silence window above catches a lead that went quiet on US; this catches
 * the opposite and worse case: the lead wrote, and the owner never came
 * back. "Neglected" = the newest message on the lead is INBOUND and older
 * than the business's unanswered-reply window. Such a lead is fed through
 * the same draft → risk gate → send/hold path as a silent one, and the
 * owner is told either way (a held draft is a reply waiting for one click).
 */
async function findUnansweredLeads(businessId: string, hours: number, recheckCutoff: Date) {
  // Captured once so every lead in the batch is judged against the same
  // instant rather than a clock that moves as the filter runs.
  const nowMs = Date.now();
  const cutoff = new Date(nowMs - hours * 60 * 60 * 1000);
  const firstReplyCutoff = new Date(nowMs - UNANSWERED_FIRST_REPLY_HOURS * 60 * 60 * 1000);
  // The DB-level filter has to be broad enough to catch both cases the
  // per-lead check below distinguishes — an established conversation
  // silent past the full `hours` window, and a lead's still-unanswered
  // FIRST message silent past the much shorter UNANSWERED_FIRST_REPLY_HOURS
  // window — so it uses whichever cutoff is more recent (further hours
  // means a smaller/older Date, so the later Date is the broader filter,
  // catching more candidates than either threshold alone would).
  // The Meta ceiling (effectiveUnansweredHours) needs no widening here: it
  // only ever SHORTENS a wait, and this filter is already at least as broad
  // as the 3-hour first-reply cutoff, which catches everything a 20-hour
  // threshold could.
  const queryCutoff = firstReplyCutoff > cutoff ? firstReplyCutoff : cutoff;
  const candidates = await prisma.lead.findMany({
    where: {
      businessId,
      automationTier: { not: "OFF" },
      stage: { notIn: ["WON", "LOST"] },
      // The owner's workflow owns an enrolled lead (enrollLead sets the
      // tier OFF, which already excludes it; this holds even if someone
      // later flips the tier back on from the lead's page).
      sequenceId: null,
      OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
      conversations: { some: { messages: { some: { direction: "inbound", sentAt: { lte: queryCutoff } } } } },
    },
    include: {
      conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } },
    },
  });
  // The query finds "has an old-enough inbound"; only "the LAST message is
  // that inbound, AND it's old enough by the threshold THIS lead actually
  // gets" counts — if anyone has replied since, it's not neglected.
  return candidates.filter((lead) => {
    const all = lead.conversations.flatMap((c) => c.messages);
    // The instant acknowledgement is boilerplate everyone gets, not a
    // reply. For "did anyone answer this lead" it is transparent: the
    // judgment runs over everything else. Before Message.trigger existed
    // the ack was an ordinary outbound row, so a lead who wrote once and
    // got the ack read as "answered" here and was never selected — the
    // 3-hour first-reply rule and the 20-hour Meta ceiling only ever fired
    // if the lead wrote a SECOND time (audit 2026-09-16, F2). The old
    // FollowUp-row exclusion sat below the direction check that had
    // already thrown the lead out, so it never got the chance to help.
    const isAck = (m: { direction: string; trigger: string | null }) => m.direction === "outbound" && m.trigger === "instant_ack";
    const judged = all.filter((m) => !isAck(m));
    if (judged.length === 0) return false;
    const last = judged.reduce((latest, m) => (m.sentAt > latest.sentAt ? m : latest));
    if (last.direction !== "inbound") return false;
    // A tap on the honest-no chip ("Not now", "Leave it") is the lead
    // answering "leave me", and it stops every further automatic message —
    // the one guarantee the reply-button strategy rests on (buttons research
    // §5.1, "reset-farming"). It is still an inbound row, so the lead is
    // not "unanswered": they were answered, and they declined. Anything they
    // TYPE later is a newer inbound and everything restarts.
    if (isExitPayload(last.quickReplyPayload)) return false;
    // A bare STOP or START is consent, recorded by the capture path — not
    // a question. Holding a drafted "reply" to someone's STOP in Approvals
    // invites the one message that must never be sent.
    if (isConsentKeyword(last.body)) return false;
    // "We talked" (src/lib/talked.ts): the owner answered this message in
    // person or on a call, where FollowUp cannot see it.
    if (settledByTalk(lead.talkedAt, last.sentAt)) return false;
    // A lead with no substantive outbound reply yet gets the shorter
    // first-reply threshold; everyone already in a real back-and-forth
    // keeps the business's normal unanswered-reply window. "Substantive"
    // is any outbound that is not the ack. That deliberately includes an
    // owner's reply synced from Gmail/Outlook — which has no FollowUp row,
    // no `source` and no trigger — and a Meta echo (`source` set). "Has a
    // FollowUp row" was never a safe test for that reason: a lead the owner
    // answered from their mail app would have looked untouched.
    const hasSubstantiveOutbound = all.some((m) => m.direction === "outbound" && !isAck(m));
    // Channel is read off the conversation `last` belongs to rather than via
    // detectAutomatedReplyChannel(), which would be a query per candidate
    // lead. That function's first and strongest rule is the channel the last
    // inbound arrived on, which is exactly this value. Where the two could
    // diverge it resolves to email, which has no window — so the worst case
    // is a send four hours early on a channel that did not need it.
    const lastChannel = lead.conversations.find((c) => c.messages.some((m) => m.id === last.id))?.channel;
    const thresholdHours = effectiveUnansweredHours(hours, hasSubstantiveOutbound, lastChannel);
    return last.sentAt <= new Date(nowMs - thresholdHours * 60 * 60 * 1000);
  });
}

/**
 * The fresh-reply worker's candidates: the leads it was handed, narrowed
 * to those with a customer message to answer right now
 * (freshInboundToAnswer), minus any already sitting on Today for that same
 * message — the instant acknowledgement holds a brand-new lead's first
 * reply on a holding account (acknowledge.ts), and a second hold for the
 * same message would be a second notification about one thing.
 *
 * Returns the message time per lead as well, because that is what the
 * claim is keyed on (see the claim in runAutomationForBusiness).
 */
async function findFreshUnansweredLeads(businessId: string, leadIds: string[]) {
  if (leadIds.length === 0) return { leads: [], inboundAt: new Map<string, Date>() };
  const nowMs = Date.now();
  const candidates = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      businessId,
      automationTier: { not: "OFF" },
      stage: { notIn: ["WON", "LOST"] },
      sequenceId: null,
      // An acknowledgement still inside its DM grace period (or being sent
      // right now) decides this lead first; the next tick sees the result.
      ackDueAt: null,
    },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });
  const inboundAt = new Map<string, Date>();
  for (const lead of candidates) {
    const at = freshInboundToAnswer(lead, nowMs);
    if (at) inboundAt.set(lead.id, at);
  }
  if (inboundAt.size === 0) return { leads: [], inboundAt };

  const earliest = new Date(Math.min(...[...inboundAt.values()].map((d) => d.getTime())));
  const holds = await prisma.auditEvent.findMany({
    where: { businessId, action: "ai.hold", targetType: "lead", targetId: { in: [...inboundAt.keys()] }, createdAt: { gte: earliest } },
    select: { targetId: true, createdAt: true },
  });
  for (const hold of holds) {
    const at = hold.targetId ? inboundAt.get(hold.targetId) : undefined;
    if (at && hold.createdAt >= at) inboundAt.delete(hold.targetId!);
  }
  return { leads: candidates.filter((l) => inboundAt.has(l.id)), inboundAt };
}

function hoursAgo(date: Date): number {
  return Math.max(1, Math.round((Date.now() - date.getTime()) / 3_600_000));
}

/**
 * "3 minutes" or "5h" — how long a customer has been waiting, for the
 * notification that says so. hoursAgo alone rounds everything under an
 * hour UP to "1h", which was harmless while the unanswered rule never
 * looked at a message younger than three hours; the fresh-reply worker
 * acts on messages a few minutes old, and "wrote 1h ago" about a message
 * from two minutes ago is simply untrue.
 */
function waitedFor(date: Date): string {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 60) {
    const m = Math.max(1, minutes);
    return `${m} minute${m === 1 ? "" : "s"}`;
  }
  return `${hoursAgo(date)}h`;
}

type LeadOutcome =
  | { kind: "sent" }
  | { kind: "held"; note: string }
  | { kind: "skipped"; note: string }
  // Another concurrent run (the hourly cron, a manual "run now" click, or an
  // overlapping cron tick — see the claim below) already handled this lead
  // for this eligibility window. Not a failure, just nothing left to do.
  | { kind: "claimed" }
  // Outside the business's local send window (sendWindow.ts) — see that
  // module's own doc comment for why this gates the send, not eligibility.
  | { kind: "deferred" };

export async function runAutomationForBusiness(
  businessId: string,
  /**
   * `freshLeadIds`: run ONLY the reply-within-five-minutes pass, for these
   * leads — what the once-a-minute worker (runFreshRepliesForAllBusinesses)
   * calls. Every guard below applies exactly as it does hourly: the master
   * switch, billing, the connected channel, the Meta window, the hold
   * setting, the backlog and Auto permissions, the risk check, the shape
   * checks, the caps and the claim. What differs is WHEN a lead qualifies
   * (minutes after it wrote, not hours) and that the reply is not held back
   * by the send window — the customer is awake, they just wrote.
   */
  options: { freshLeadIds?: string[] } = {}
): Promise<AutomationResult> {
  const fresh = options.freshLeadIds !== undefined;
  const automation = await prisma.automation.findFirst({
    where: { businessId, action: "auto_send" },
  });
  if (!automation || !automation.enabled) {
    return EMPTY_RESULT;
  }

  // Automated sending is a paid feature like everything else that costs
  // money to run — a business that lapsed or never subscribed shouldn't
  // keep getting free automated sends just because the toggle was left on
  // from before. The manual "Run automation check now" button already
  // goes through requireActiveBilling() at the route level; this check
  // makes the cron-driven path (which calls this function directly, for
  // every business, with no route-level gate of its own) honor the same
  // rule.
  if (!(await requireActiveBilling(businessId))) {
    return EMPTY_RESULT;
  }

  // Nothing connected, nothing to send with: no drafting either. A
  // disconnected account used to keep being drafted for every day (see
  // hasAnySendChannel for the real case behind this). Read fresh on every
  // run, so reconnecting resumes it without anyone doing anything.
  if (!(await hasAnySendChannel(businessId))) {
    return EMPTY_RESULT;
  }

  // The quiet-lead cadence (quietReminderPlan). The query below only has to
  // be broad enough to include every lead that COULD be due — the plan
  // itself decides who is — so it asks for leads quiet at least as long as
  // the shortest wait anywhere in the cadence: reminder 1's delay, or the
  // smallest gap between two reminders, whichever is less.
  const triggerDays = automation.triggerDays;
  const reminderDays = quietReminderDays(triggerDays);
  const shortestWaitDays = Math.min(reminderDays[0], ...reminderDays.slice(1).map((d, i) => d - reminderDays[i]));
  const cutoff = new Date(Date.now() - shortestWaitDays * 24 * 60 * 60 * 1000);
  // Runs hourly (vercel.json). A lead this pass sends to gets a new
  // lastContacted and drops out of the window on its own; a lead it holds
  // for approval does not, so it's excluded from re-assessment for most of
  // a day via lastAutomationCheckedAt (see schema.prisma).
  const recheckCutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);

  const unansweredRule = await prisma.automation.findFirst({ where: { businessId, action: UNANSWERED_ACTION } });
  const unansweredEnabled = unansweredRule?.enabled ?? true; // on by default, like everything else here
  const unansweredHours = unansweredRule?.triggerHours ?? UNANSWERED_DEFAULT_HOURS;
  // A reply within minutes IS "Reply for me when I haven't", just sooner —
  // an owner who switched that off has said FollowUp should not answer for
  // them, and the fast pass honours it the same way the hourly one does.
  if (fresh && !unansweredEnabled) return EMPTY_RESULT;

  // Fetched once for the whole run, not per lead — every lead in this
  // batch belongs to the same business, so the send-window check below
  // always resolves against the same timezone.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { timezone: true, tier: true, holdAllForApproval: true, autonomousAllowed: true, autonomousAllowedAt: true, autoSendAllowedAt: true },
  });
  const timezone = business?.timezone ?? "America/New_York";
  const tier = (business?.tier ?? "plus") as "free" | "plus" | "pro";
  // Nothing automated leaves this account unreviewed — see the column's
  // comment in schema.prisma. It overrides both the per-lead tier and the
  // risk verdict below: every draft goes to the approval queue instead.
  const holdAll = business?.holdAllForApproval ?? false;
  /**
   * Has this account permitted unreviewed sending at all?
   *
   * Gating only the act of SETTING a lead to Auto would have left every
   * account that already had Auto leads exactly as it was — the setting
   * would be decoration for precisely the people it most needs to
   * protect. So the send path asks too: without permission, an
   * AUTONOMOUS lead is treated as ASSISTED, which means it still gets a
   * draft and still goes to the approval queue. Nothing is lost, and
   * nothing goes out unread on an account that never said it could.
   */
  const autonomousAllowed = business?.autonomousAllowed ?? false;
  /**
   * WHEN it was permitted — and the word doing the work is "after".
   *
   * Founder, 2026-09-23: Auto must "send messages after the user turns it
   * on". Without this the grant is a blast: every lead that went quiet
   * while the permission was off is already past its silence threshold,
   * so the first tick after the switch finds the whole back catalogue
   * eligible at once and sends all of it, unread, in the owner's name.
   * They pressed one button meaning "from now on" and got "and also
   * everything since".
   *
   * Null while the permission is off, which makes the comparison below
   * refuse everything — the safe direction.
   */
  const autonomousAllowedAt = business?.autonomousAllowedAt ?? null;
  /**
   * When "send on my behalf" was granted — the same line as
   * autonomousAllowedAt, for the switch with the wider blast radius.
   *
   * Every draft in the approval queue becomes sendable the instant the
   * hold lifts, and the queue is exactly where a holding account's whole
   * history piles up. Without this, turning it on releases weeks of
   * drafts on the next tick, about conversations that ended long ago.
   *
   * Null does NOT mean "no permission" here, unlike the autonomous pair.
   * An account whose hold was lifted before this column existed has no
   * stamp, and reading that as "all backlog" would silently freeze a
   * working account. The guard applies only where a grant was recorded.
   */
  const autoSendAllowedAt = business?.autoSendAllowedAt ?? null;

  const deadLeadRule = await prisma.automation.findFirst({ where: { businessId, action: DEAD_LEAD_ACTION } });
  const deadLeadEnabled = deadLeadRule?.enabled ?? true; // on by default, like everything else here
  const deadLeadDays = deadLeadRule?.triggerDays ?? DEAD_LEAD_DEFAULT_DAYS;
  const deadCutoff = new Date(Date.now() - deadLeadDays * 24 * 60 * 60 * 1000);

  // The fresh pass looks at nothing but the leads it was handed: no quiet
  // leads, no cold ones — those are FollowUp reaching out, and they stay on
  // the hourly tick and inside the send window.
  const freshFound = fresh ? await findFreshUnansweredLeads(businessId, options.freshLeadIds ?? []) : null;
  if (freshFound && freshFound.leads.length === 0) return EMPTY_RESULT;

  const [quietCandidates, deadCandidates, voiceSamples, unanswered] = await Promise.all([
    fresh
      ? Promise.resolve([])
      : prisma.lead.findMany({
      where: {
        businessId,
        automationTier: { not: "OFF" },
        stage: { notIn: ["WON", "LOST"] },
        // The owner's workflow wins: a lead enrolled in one gets none of the
        // default reminders on top (founder, 2026-09-25). enrollLead already
        // sets such a lead to OFF; this holds even if the tier is flipped
        // back on from the lead's page while it is still enrolled.
        sequenceId: null,
        // A lead past the dead-lead threshold exits the normal silence
        // cadence entirely — it belongs to the `deadLeads` query below
        // instead, with its own messaging. Passed as the lower bound of a
        // range rather than the separate `NOT` it used to be, and only
        // while that rule is enabled: disabled means "no dead-lead rule,"
        // not "these leads vanish from the normal cadence too."
        //
        // Inside AND because the OR below is already spoken for. Two `OR`
        // keys in one object is not a conjunction, it is the second one
        // silently winning.
        AND: [quietSince(cutoff, deadLeadEnabled ? deadCutoff : undefined)],
        OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
      },
      include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
    }),
    deadLeadEnabled && !fresh
      ? prisma.lead.findMany({
          where: {
            businessId,
            automationTier: { not: "OFF" },
            stage: { notIn: ["WON", "LOST"] },
            sequenceId: null,
            AND: [quietSince(deadCutoff)],
            OR: [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
          },
          include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
        })
      : Promise.resolve([]),
    // Same voice sample set for every lead in this business — fetched once
    // up front rather than inside the per-lead loop below.
    getVoiceSamples(businessId),
    freshFound
      ? Promise.resolve(freshFound.leads)
      : unansweredEnabled
        ? findUnansweredLeads(businessId, unansweredHours, recheckCutoff)
        : Promise.resolve([]),
  ]);

  const nowMs = Date.now();
  const timelineOf = (l: { conversations: { messages: { direction: string; sentAt: Date; trigger: string | null; quickReplyPayload: string | null }[] }[] }): TimelineMessage[] =>
    l.conversations.flatMap((c) =>
      c.messages.map((m) => ({ direction: m.direction, at: m.sentAt.getTime(), trigger: m.trigger, quickReplyPayload: m.quickReplyPayload }))
    );

  // Only the quiet leads whose next reminder is actually due, and which
  // reminder it is. A lead whose four reminders have all gone out drops
  // out here and stays out until it either writes (the unanswered rule) or
  // reaches the dead-lead threshold (the welcome back).
  const reminderStepById = new Map<string, number>();
  // "We talked" finishes the check-ins until they write again, and the
  // welcome back with them (src/lib/talked.ts).
  const talkedOut = (l: { talkedAt: Date | null; conversations: { messages: { direction: string; sentAt: Date }[] }[] }) =>
    settledByTalk(l.talkedAt, lastInboundTime(l.conversations.flatMap((c) => c.messages)));
  const silent = quietCandidates.filter((l) => {
    if (talkedOut(l)) return false;
    const plan = quietReminderPlan(timelineOf(l), (l.lastContacted ?? l.createdAt ?? new Date(nowMs)).getTime(), triggerDays, deadLeadDays);
    if (!plan?.dueAt || plan.dueAt.getTime() > nowMs) return false;
    reminderStepById.set(l.id, plan.step);
    return true;
  });
  // One welcome back per silence, not one every 45 days forever.
  const deadLeads = deadCandidates.filter((l) => !talkedOut(l) && !reactivationAlreadySent(timelineOf(l), deadLeadDays));

  // Merge in priority order — unanswered (the lead wrote and got ignored)
  // is the most urgent, dead-lead reactivation is a deliberate exit from
  // the normal cadence, silent is everything else. One row per lead: a
  // dead lead that's ALSO unanswered gets the unanswered framing, not a
  // double-send — the human-neglect case is the more urgent one to name.
  const unansweredIds = new Set(unanswered.map((l) => l.id));
  const deadIds = new Set(deadLeads.filter((l) => !unansweredIds.has(l.id)).map((l) => l.id));
  const eligible = [
    ...unanswered,
    ...deadLeads.filter((l) => deadIds.has(l.id)),
    ...silent.filter((l) => !unansweredIds.has(l.id) && !deadIds.has(l.id)),
  ];

  // Every held draft's "this is waiting for you" notification, gathered
  // rather than written as it happens, so the flush below can see how many
  // there were. The loop is concurrent but single-threaded — push is safe.
  const heldNotices: HoldNotice[] = [];

  // Kept modest (vs. the 5 used for sync/cleanup) — this loop calls Gmail's
  // send API per lead, which has its own tighter per-account send quota,
  // not just a "how fast can we finish" budget.
  const outcomes = await mapWithConcurrency(eligible, 3, async (lead): Promise<LeadOutcome> => {
    try {
      // Atomic check-and-claim, same shape as claimLead()/acknowledgeNewLead()/
      // checkRapidEngagement() elsewhere in this codebase — a plain update
      // here always succeeds regardless of who else is touching this row,
      // which let the hourly cron and a manual "Run automation check now"
      // click (or two overlapping cron ticks) both see the same lead as
      // eligible and both draft-and-send it, unreviewed, for an AUTONOMOUS
      // lead. Re-using the same OR clause the eligibility query above used
      // means only the first caller to land here wins; everyone else's
      // WHERE matches zero rows once this commits.
      //
      // The fresh pass claims against the MESSAGE rather than against the
      // 20-hour recheck: "nobody has looked at this lead since this message
      // arrived". A lead the hourly run held this morning must still be
      // answerable the minute it writes again this afternoon — the 20-hour
      // clause would have made it wait until tomorrow — and two fresh ticks
      // racing each other still cannot both win, because the winner's stamp
      // is newer than the message.
      const freshInboundAt = freshFound?.inboundAt.get(lead.id);
      const claim = await prisma.lead.updateMany({
        where: {
          id: lead.id,
          OR: freshInboundAt
            ? [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: freshInboundAt } }]
            : [{ lastAutomationCheckedAt: null }, { lastAutomationCheckedAt: { lt: recheckCutoff } }],
        },
        data: { lastAutomationCheckedAt: new Date() },
      });
      if (claim.count === 0) return { kind: "claimed" };

      // The send window used to be checked HERE, before any drafting, so a
      // message that arrived at 9pm was not even drafted until 8am — on a
      // holding account, the owner opened Today in the evening and found
      // nothing waiting. Founder's follow-up strategy, 2026-09-25: drafting
      // and holding happen at any hour; only the send waits. The check now
      // sits just before sendFollowUpToLead, below every hold decision.

      // Free tier's AI processing pause (@/lib/billing) applies here too,
      // not just at initial capture (scoring.ts) — otherwise a lead that
      // never got scored because it was over cap or on a disallowed
      // channel would still get a fresh draft (and possibly an autonomous
      // send) the moment it went silent, defeating the whole point of the
      // pause. Kept claimed (not released like the send-window case below)
      // so it's naturally rechecked in ~20h via recheckCutoff rather than
      // every single hourly tick — this isn't transient the way "outside
      // business hours" is.
      // Named distinctly from the outer `eligible` (the batch array this
      // closure iterates, declared above) — same name, different thing,
      // and shadowing it here was a latent footgun for a future edit
      // inside this closure.
      //
      // Now runs on every tier, not just Free: Plus's 1,500/mo and Pro's
      // 10,000/mo ceilings were published and unenforced, so a paid account
      // had no upper bound on AI processing at all.
      const aiEligible = await checkAiEligibility(businessId, lead, tier);
      if (!aiEligible.ok) {
        // Same reasoning as scoring.ts's copy of this gate: the run's
        // `skipped` list is a developer's summary, seen by nobody who
        // owns the lead. Without this write, a lead first captured while
        // eligible and only later refused (the account lapsed, the
        // monthly cap was crossed) keeps a stale "Following up soon"
        // badge forever, because scoring.ts never runs on it again.
        await prisma.lead.updateMany({ where: { id: lead.id }, data: { aiPausedReason: aiEligible.ownerMessage } });
        return { kind: "skipped", note: `${lead.name}: ${aiEligible.reason}` };
      }

      const conversation: Message[] = lead.conversations.flatMap((c) =>
        c.messages.map((m) => ({
          id: m.id,
          direction: m.direction as Message["direction"],
          channel: c.channel as Message["channel"],
          body: m.body,
          date: m.sentAt.toISOString(),
          opened: m.opened,
          source: m.source ?? undefined,
          trigger: m.trigger ?? undefined,
          quickReplyPayload: m.quickReplyPayload ?? undefined,
        }))
      );

      const isDeadLead = deadIds.has(lead.id);

      // Is this lead ACTUALLY past the dead-lead threshold — asked directly,
      // rather than inferred from which framing won the merge above?
      //
      // The two are not the same question, and treating them as one was a
      // real hole. `deadIds` deliberately subtracts the unanswered set
      // (see its construction above) so that a lead who is both cold AND
      // unanswered gets the better, more urgent framing and only one
      // message. That's right for framing. But `isDeadLead` was also what
      // the mandatory human hold below keyed on — so the very act of
      // choosing the kinder wording switched the approval requirement off.
      //
      // The lead it let through is the worst one to get wrong: someone who
      // wrote in, was never answered, and has been waiting 45+ days. On a
      // business's first sync the imported back catalogue is full of
      // exactly that shape, so it fired within the first hourly tick after
      // signup. src/lib/reactivation.ts classifies that same population as
      // COLD_UNANSWERED and refuses to bulk-message them at all — they are
      // owed an answer, not a "still interested?" — so the two subsystems
      // were reaching opposite conclusions about the same person.
      //
      // Deliberately NOT scoped to `deadLeadEnabled`, unlike the
      // `deadLeads` query it otherwise mirrors.
      //
      // "Reactivate cold leads" is a MESSAGING-CAMPAIGN toggle: it decides
      // whether FollowUp goes looking for the back catalogue at all. This
      // is a SAFETY hold: it decides whether a human sees a message before
      // it goes to someone who has been silent for months. Tying the second
      // to the first meant switching the campaign OFF also switched the
      // protection off — cold leads fell through to the `silent` bucket
      // (line ~294 only excludes them while the rule is enabled) and
      // auto-sent unreviewed on a low-risk verdict. A safety property that
      // a settings toggle can quietly disable is not a safety property.
      //
      // `lastContacted ?? createdAt` rather than a null check: a lead with
      // no recorded contact is not evidence of recency. Falling back to the
      // null branch would have made an ancient lead with a missing
      // timestamp the one kind that could still auto-send.
      const coldReference = lead.lastContacted ?? lead.createdAt;
      const isCold = coldReference <= deadCutoff;

      const isBackfilled = isBackfilledThread(lead);

      // A lead FollowUp has never seen a single message on — typed into
      // the manual form, imported from a CSV, logged after a phone call.
      // quietSince() is what lets these reach this loop at all; this is
      // what stops the first thing they reach being an unreviewed send.
      //
      // Same reasoning as isBackfilled, one step further along: there,
      // FollowUp inherited a conversation it didn't watch. Here there is
      // no conversation. Every other draft in this file is written
      // against something the lead actually said; this one is written
      // against a name, a company and whatever the owner typed in the
      // notes. That is exactly the input a model fills in for, and the
      // person on the other end never asked to hear from us at all —
      // which on a phone number is not just awkward, it is the consent
      // question. So it is always the owner's send, whatever the tier
      // and whatever the risk check thinks.
      const isUntouched = conversation.length === 0;

      // task #63 (live-test finding): a cached suggestedMessage can predate
      // the lead's actual most recent inbound message — scoring.ts drafts
      // once per inbound webhook, but a lead that fires off several
      // messages in a burst (or in different languages) can leave a stale
      // draft sitting there for hours before the unanswered trigger picks
      // it up. Reusing it verbatim shipped a real English reply to a lead
      // whose latest message was romanized Gujarati. Unlike silence (where
      // nothing new happened since the cache was written, so it's still
      // the right answer), "unanswered" specifically means new inbound
      // content exists that the cached draft was never written against —
      // so it gets the same "never trust the cache" treatment as a dead
      // lead, for the same underlying reason.
      const isUnanswered = unansweredIds.has(lead.id);

      // Whether the cached draft was written against this conversation as
      // it stands now. This is the test the two cases above actually need:
      // the reason a dead-lead or unanswered draft "can't be trusted" is
      // that new inbound content may have arrived since it was written —
      // so compare the draft's stamp to the newest message rather than
      // rebuilding unconditionally.
      //
      // Without this the product had a cost that grew with time instead of
      // with leads. A lead held for approval sends nothing, so
      // lastContacted never moves, so it re-enters this window every 20
      // hours forever — and each pass paid for a fresh draft, a fresh
      // localization and a fresh risk check on a byte-identical
      // conversation ($0.026/lead/month, unbounded;
      // research/product/2026-09-15-ai-cost-per-lead.md §5). Cold leads are
      // held by design, so there is always a standing population of them.
      //
      // A null stamp means the draft predates the column, so it counts as
      // stale: the first pass after deploy rebuilds and stamps it, and
      // every pass after that is free. The task #63 guarantee is preserved
      // exactly — a lead who wrote again in another language has a newer
      // message than the stamp, so the draft is stale and IS rebuilt.
      const newestMessageAt = conversation.length
        ? new Date(conversation[conversation.length - 1].date)
        : null;
      const draftIsCurrent =
        lead.suggestedDraftedFor != null &&
        newestMessageAt != null &&
        newestMessageAt <= lead.suggestedDraftedFor;

      // Reuse an existing draft (subject + body) when this lead already has
      // one from a normal scoring pass — only draft fresh here if it
      // somehow doesn't (e.g. scoring never ran, most commonly no
      // OPENAI_API_KEY configured), or if it's a dead lead or unanswered
      // reply whose draft is no longer current (see above).
      // Explicit channel, not sendFollowUpToLead()'s own email-if-present
      // default — a lead that only ever texted or DM'd, but happens to
      // also have an email on file, would otherwise get an automated
      // reply sent to an inbox they never check (see
      // detectAutomatedReplyChannel's doc comment). Resolved up here
      // because the SHAPE of the draft depends on it: an Instagram or
      // Messenger DM is short, has no subject and ends in one question
      // with reply buttons (src/lib/dmDrafts.ts); an email is the framed
      // paragraph it always was.
      const sendChannel = (await detectAutomatedReplyChannel(lead)) ?? undefined;
      const isDm = sendChannel === "instagram" || sendChannel === "messenger";
      // A phone lead who has never written to the business: the owner
      // messaged them first (a WhatsApp echo, an owner-only history thread,
      // a restored chat). An automatic text to someone who never contacted
      // us is the consent question isUntouched names below, so it is held
      // exactly like one, whatever the tier (security pass 2026-09-25 F1).
      // sendFollowUpToLead refuses it too; holding here is what keeps the
      // owner told instead of a silent daily refusal.
      const phoneNeverWrote =
        (sendChannel === "text" || sendChannel === "whatsapp") && !conversation.some((m) => m.direction === "inbound");
      // Past Meta's 24-hour window nothing automatic may go out on these
      // channels, and sendFollowUpToLead would refuse it anyway — so no
      // draft, no risk check, no OpenAI spend. The owner's own day-2–7
      // draft is written by draftDmHandoffs() below, once, and sits on the
      // lead's page and in the approval queue until they tap it.
      if (isDm) {
        const hours = hoursSinceLastInbound(conversation, sendChannel);
        if (hours === null || hours > META_DM_WINDOW_HOURS) {
          return {
            kind: "skipped",
            note: `${lead.name}: Meta's window on ${sendChannel === "instagram" ? "Instagram" : "Messenger"} has closed — only a person can send now; the draft is on the lead's page`,
          };
        }
      }
      // The channel this lead would be answered on has to be connected, not
      // just "something" (daily-path bug hunt 2026-09-25, F5). With Gmail
      // dead and an Instagram token still stored, hasAnySendChannel passed
      // and every email lead was drafted, risk-checked, held and announced
      // every ~20 hours for a message sendEmail would refuse. Same exit as
      // the closed Meta window just above: no draft, no risk check, no
      // notification, and the claim is KEPT, so it is looked at again on
      // the normal ~20-hour cadence — and resumes on its own the pass after
      // a reconnect, because canSendOn is read fresh every time.
      if (sendChannel && !(await canSendOn(businessId, sendChannel))) {
        return {
          kind: "skipped",
          note: `${lead.name}: nothing connected can send on ${sendChannel} — no draft written until it is reconnected`,
        };
      }
      // A cached draft written as an email (suggestedQuickReplies null —
      // every row from before that column, and every lead whose last
      // message was an email at the time) must not go out as a DM: the
      // greeting/sign-off frame and the subject would ship inside the
      // bubble. So on a DM channel "current" also requires a DM-shaped draft.
      const cachedShapeFits = !isDm || lead.suggestedQuickReplies != null;

      let subject = lead.suggestedSubject ?? undefined;
      let message = lead.suggestedMessage;
      let quickReplies: StoredQuickReplies | null = isDm ? readStoredQuickReplies(lead.suggestedQuickReplies) : null;
      let regenerated = false;
      let dmShapeFailed: string | null = null;
      let emailShapeFailed: string | null = null;

      // Which message this is, which decides both the steer and whether
      // the cached draft is the right one (Lead.suggestedDraftKind):
      //   - a welcome back to a cold lead — with the apology only if THEY
      //     spoke last (deadLeadMessageHint);
      //   - a reply owed to someone who wrote 45+ days ago and was never
      //     answered — the belated answer, apology included. Until
      //     2026-09-25 this lead got NO steer at all, because the merge
      //     hands it the unanswered framing, which had none (research
      //     2026-09-15 §7.1);
      //   - reminder N of the quiet-lead cadence (quietReminderHint);
      //   - otherwise an ordinary reply, null, which is what scoring.ts
      //     writes.
      const reminderStep = reminderStepById.get(lead.id);
      const daysQuiet = Math.floor((nowMs - new Date(lead.lastContacted ?? lead.createdAt).getTime()) / 86_400_000);
      const theyWroteLast = (() => {
        const judged = conversation.filter((m) => !(m.direction === "outbound" && m.trigger === "instant_ack"));
        const newest = judged.reduce<Message | null>((a, m) => (!a || m.date > a.date ? m : a), null);
        return newest?.direction === "inbound";
      })();
      const draftKind: string | null = isDeadLead
        ? "reactivation"
        : isUnanswered && isCold
          ? "belated_reply"
          : reminderStep !== undefined
            ? `reminder_${reminderStep + 1}`
            : null;
      const messageHint = isDeadLead
        ? deadLeadMessageHint(daysQuiet, theyWroteLast ? "lead" : "business")
        : draftKind === "belated_reply"
          ? deadLeadMessageHint(daysQuiet, "lead")
          : // An untouched lead has no conversation for a reminder to
            // refer back to; it keeps the plain draft it always had and is
            // held for the owner whatever it says (UNTOUCHED_LEAD_REASON).
            reminderStep !== undefined && !isUntouched
            ? quietReminderHint(reminderStep, daysQuiet)
            : undefined;
      // "Current" now means the right conversation AND the right kind of
      // message. For silence this is new: a quiet lead used to reuse
      // whatever draft was cached, which was usually scoring's reply to
      // their last message — the wrong message entirely once we have
      // answered it and they have gone quiet. An untouched lead has no
      // message to date a draft against, and nothing can change under it
      // without one, so its draft stays current once it is the right kind.
      const draftFitsNow =
        (isUntouched || draftIsCurrent) && (lead.suggestedDraftKind ?? null) === draftKind;
      if (!message || !cachedShapeFits || ((isDeadLead || isUnanswered || reminderStep !== undefined) && !draftFitsNow)) {
        regenerated = true;
        if (isDm) {
          // The lead's decided language/register, off the row already
          // loaded — so the day-3 follow-up uses the same usted/tú the
          // first reply did (src/lib/leadLanguage.ts).
          const dm = await draftDm(lead.name, conversation, voiceSamples, messageHint, undefined, leadLanguageOf(lead));
          message = dm.body;
          subject = undefined;
          quickReplies = dm.quickReplies;
          dmShapeFailed = dm.shapeFailed;
        } else {
          const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples, messageHint, undefined, leadLanguageOf(lead));
          subject = draft.subject;
          // The same invariant the ack and the DM have always had, on the
          // one path that never had it: no price, date or figure the
          // conversation does not already contain. Checked on the MODEL's
          // body and the subject, before composeFollowUpEmail wraps them —
          // the frame it adds (greeting, sign-off, the owner's name) is
          // FollowUp's own text and has nothing to ground against.
          //
          // On 2026-09-20 a lead asked what a consultation costs and this
          // path answered "El costo será de $100" in the owner's name.
          // Nobody had said $100.
          emailShapeFailed = ungroundedSpecifics(
            `${draft.subject ?? ""}\n${draft.body}`,
            conversationText(conversation),
            leadLanguageOf(lead)?.language
          );
          message = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, draft.body, {
            languageSample: latestInboundText(conversation),
            leadLanguage: leadLanguageOf(lead),
          });
        }
      }

      // AUTONOMOUS skips the risk check entirely — that's the whole point
      // of the tier. Every other opted-in lead (ASSISTED) still gets
      // checked before anything goes out unreviewed. `tier === "free"`
      // forces the check even for a lead whose automationTier is still
      // AUTONOMOUS from before a downgrade — autonomous send is a Plus/Pro
      // capability (leads/[id]/automation/route.ts refuses to set it on
      // Free going forward), but a downgrade doesn't retroactively touch
      // leads already set that way, so this is the belt to that route's
      // suspenders.
      // A DM that twice failed the deterministic shape check (two
      // questions, a banned closer, a number nobody wrote, four chips) is
      // held for the owner whatever the tier — including AUTONOMOUS, which
      // skips the model risk gate below. The check is free and
      // model-free, so there is no reason to let any tier bypass it: the
      // whole point of a DM here is its shape.
      if (dmShapeFailed) {
        if (regenerated) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { suggestedMessage: message, suggestedSubject: null, suggestedQuickReplies: { question: "shape_failed", buttons: [] }, suggestedDraftedFor: newestMessageAt, suggestedDraftKind: draftKind, suggestedRiskLevel: null, suggestedRiskReason: null },
          });
        }
        const reason = `FollowUp couldn't write a short enough DM for ${lead.name.split(" ")[0]} (${dmShapeFailed}) — this one needs your eye before it goes`;
        if (unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "held");
        void recordAudit({ businessId: lead.businessId, userId: null }, "ai.hold", {
          targetType: "lead",
          targetId: lead.id,
          meta: { riskLevel: "shape", reason: dmShapeFailed, trigger: unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence" },
        });
        return { kind: "held", note: `${lead.name}: ${reason}` };
      }

      // The email equivalent of the DM check above, and for a stronger
      // reason: a DM that fails its shape check is usually just badly
      // shaped, while an email that fails this one contains a figure
      // nobody wrote. Held for every tier, AUTONOMOUS included — an
      // invented price is precisely the thing no tier may send unread.
      //
      // The draft is still written down and still offered. The owner sees
      // it in Approvals with a reason naming what to look for, which is
      // more useful than discarding it: FollowUp usually got the intent
      // right and one detail wrong, and a human fixes that in seconds.
      if (emailShapeFailed) {
        if (regenerated) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { suggestedMessage: message, suggestedSubject: subject ?? null, suggestedDraftedFor: newestMessageAt, suggestedDraftKind: draftKind, suggestedRiskLevel: null, suggestedRiskReason: null },
          });
        }
        const reason = UNGROUNDED_DRAFT_REASONS[emailShapeFailed] ?? UNGROUNDED_DRAFT_REASONS.digits;
        if (unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "held");
        void recordAudit({ businessId: lead.businessId, userId: null }, "ai.hold", {
          targetType: "lead",
          targetId: lead.id,
          meta: {
            riskLevel: "shape",
            reason,
            trigger: unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence",
          },
        });
        return { kind: "held", note: `${lead.name}: ${reason}` };
      }

      // `isUntouched` is here as well as in the hold below because an
      // AUTONOMOUS lead on a paid tier skips this whole block and sends.
      // The hold condition inside it is only reached by leads that enter
      // here, so listing it there alone would have been a guarantee that
      // never ran for the tier that needed it.
      // `effectiveTier` rather than `lead.automationTier`: an account
      // that has not permitted unreviewed sending has no AUTONOMOUS
      // leads, whatever the column says.
      /**
       * A lead may send unreviewed only if the account permitted it AND
       * this conversation has moved since that permission was given.
       *
       * The second half is what keeps "turn it on" from meaning "and
       * flush everything that was waiting". A conversation whose newest
       * message predates the grant is backlog: still drafted, still
       * risk-checked, but held — so the owner sees how much there is and
       * releases it deliberately, which is exactly what the approval
       * queue's routine pile is for.
       *
       * A lead with no conversation at all has no date to compare, so it
       * is treated as backlog too. That is the cautious direction and it
       * costs nothing: such a lead is already held as `isUntouched`.
       */
      const movedSincePermission =
        autonomousAllowedAt != null && newestMessageAt != null && newestMessageAt > autonomousAllowedAt;
      const effectiveTier =
        lead.automationTier === "AUTONOMOUS" && (!autonomousAllowed || !movedSincePermission)
          ? "ASSISTED"
          : lead.automationTier;
      /**
       * Backlog on a lead the owner HAS put on Auto: the permission is
       * granted, but this conversation has not moved since.
       *
       * Held outright, not merely downgraded. Downgrading to ASSISTED is
       * not enough on its own and that mistake is easy to make twice —
       * ASSISTED sends the safe ones, so a low-risk backlog draft would
       * go out anyway and the whole guard would be decoration. The point
       * is that the owner sees the size of the back catalogue and
       * releases it deliberately.
       *
       * Only applies where Auto was actually chosen. A lead the owner put
       * on ASSISTED is already behaving as asked, and quiet leads are
       * exactly what the silence nudge is for.
       */
      const autonomousBacklog = lead.automationTier === "AUTONOMOUS" && !movedSincePermission;
      /**
       * The same backlog rule for the account-wide send permission.
       *
       * Only bites once the hold is actually off (while it is on, every
       * draft is held anyway) and only where a grant time was recorded —
       * see autoSendAllowedAt above for why a missing stamp is not
       * treated as "everything is backlog".
       *
       * Held rather than downgraded, for the reason the autonomous
       * version learned the hard way: a downgrade still sends the safe
       * ones, which is exactly the flood this is meant to prevent.
       */
      const autoSendBacklog =
        !holdAll &&
        autoSendAllowedAt != null &&
        (newestMessageAt == null || newestMessageAt <= autoSendAllowedAt);
      // A verdict this pass paid for on a draft that is then NOT held — kept
      // so that a send the window defers (below) does not throw it away and
      // buy the same answer again next hour.
      let verdictToKeep: { riskLevel: "low" | "medium" | "high"; reason: string } | null = null;
      if (holdAll || isUntouched || phoneNeverWrote || effectiveTier !== "AUTONOMOUS" || tier === "free") {
        /**
         * Every draft that reaches here gets a verdict, including ones
         * that are going to be held no matter what it says.
         *
         * This block used to short-circuit to "low" whenever `holdAll` or
         * `isUntouched` was set, on the reasoning that the classifier
         * decides whether something may go out UNREVIEWED, so on an
         * account where nothing goes out unreviewed it had nothing to
         * decide and its cost was not worth paying.
         *
         * That was true of the only question being asked then. It stopped
         * being true when the queue had to answer a second one: of the
         * drafts waiting for you, which are routine? An owner with 600
         * held drafts cannot read 600, and "held" was the only thing the
         * product knew about any of them — so every one of them looked
         * alike, and the ones quoting a price nobody mentioned sat among
         * the ordinary nudges with nothing to tell them apart.
         *
         * The cost that reasoning was protecting is real, and it is
         * handled by the branch below rather than by skipping the
         * question: a verdict is paid for once per draft and stored with
         * it (Lead.suggestedRiskLevel), not re-paid on every hourly pass
         * for a conversation that has not changed.
         */
        let risk: { riskLevel: "low" | "medium" | "high"; reason: string };
        // Whether this pass PAID for the verdict below, which is what
        // decides if it has to be written down. Not the same as
        // `regenerated`: a draft written before this column existed is
        // current (so never regenerated) but unjudged, and keying the
        // write on `regenerated` alone would re-buy its verdict every
        // hour and throw it away every hour — the exact standing cost
        // this whole mechanism exists to avoid, aimed at the back
        // catalogue instead of at cold leads.
        let riskAssessed = false;
        if (isUntouched || phoneNeverWrote) {
          // The one case where the old reasoning still holds completely.
          // An untouched lead is held because FollowUp has not seen what
          // the owner may already have done about it, and
          // UNTOUCHED_LEAD_REASON outranks the approval setting in the
          // reason cascade below — so this draft is in the "needs you"
          // pile whatever a classifier would say. The verdict cannot
          // change the send, cannot change the queue, and is left unbought
          // and unstored: null here means unjudged, which is true.
          risk = { riskLevel: "low", reason: "" };
        } else if (!regenerated && lead.suggestedRiskLevel) {
          // Same draft as last pass, already judged. Re-running the
          // classifier on a byte-identical conversation is the cost
          // `suggestedDraftedFor` exists to prevent (see schema.prisma),
          // and a held draft is re-examined on every pass — hourly,
          // forever, for as long as it waits.
          risk = {
            riskLevel: lead.suggestedRiskLevel as "low" | "medium" | "high",
            reason: lead.suggestedRiskReason ?? "",
          };
        } else if (process.env.OPENAI_API_KEY) {
          riskAssessed = true;
          try {
            risk = await assessSendRisk({ conversation }, message);
          } catch (err) {
            // Can't tell if this one's safe — hold it rather than guess.
            // Sending something autonomously that shouldn't have gone out
            // is a worse failure mode than an unnecessary manual review.
            console.error(`Risk assessment failed for lead ${lead.id}:`, err);
            // Deliberately NOT stored. A transient failure written down as
            // a verdict is reused by every later pass, so one bad minute
            // would strand this lead on "couldn't check this one" for as
            // long as the draft lives, with nothing ever retrying it.
            // Costing one more call next hour is the cheaper mistake.
            riskAssessed = false;
            // Finishes "Held because <reason>." like every other reason
            // that reaches ApprovalQueue.
            risk = { riskLevel: "medium", reason: RISK_CHECK_FAILED_REASON };
          }
        } else {
          // No classifier available — fall back to the older, unguarded
          // behavior rather than holding every automated lead forever in
          // an unconfigured/demo environment.
          risk = { riskLevel: "low", reason: "" };
        }
        if (riskAssessed) verdictToKeep = risk;

        // A cold-lead reactivation ALWAYS waits for a human, whatever the
        // risk classifier thinks.
        //
        // This is the one automation that reaches backwards. Everything else
        // here answers a conversation the lead started or continued; this one
        // messages someone who went quiet 45+ days ago, and on a business's
        // first sync that means the back catalogue — up to six months of
        // imported threads, all eligible at once, all sent in the owner's
        // name. "Low risk" is a judgement about the wording of one message;
        // it says nothing about whether the owner wanted the whole of last
        // spring contacted on their behalf.
        //
        // So these become a batch the owner is offered rather than a batch
        // that happens to them: FollowUp finds the cold leads, writes each
        // draft, and puts them in the approval queue with the reason
        // attached. Same work, same drafts — the owner just gets to say yes.
        // Founder's call, 2026-09-15, after a trust audit found a new
        // business could message six months of contacts within an hour of
        // signing up without ever being told it would.
        //
        // A lead the owner has deliberately set to AUTONOMOUS never reaches
        // this branch, so an explicit per-lead opt-in still wins.
        //
        // Keyed on `isCold` (the threshold itself), NOT on `isDeadLead`
        // (which framing won the merge) — see isCold's definition above for
        // the hole that distinction was hiding. `isDeadLead` implies
        // `isCold`, so this only ever holds MORE than before, never less.
        // `isBackfilled` joins `isCold` for the same reason and with the
        // same shape: it only ever holds MORE than before, never less.
        if (holdAll || autonomousBacklog || autoSendBacklog || risk.riskLevel !== "low" || isCold || isBackfilled || isUntouched || phoneNeverWrote) {
          // Persist whatever was just written, so the stale draft doesn't
          // linger as what the owner sees waiting for approval — and stamp
          // it with the message it was written against, which is what lets
          // the next pass reuse it instead of paying to rebuild it.
          //
          // Keyed on `regenerated` rather than re-deriving the condition:
          // the two had to agree, and writing the same test twice is how
          // they stop agreeing. A draft that was NOT regenerated is by
          // definition already current and already stored, so there is
          // nothing to write.
          if (regenerated || riskAssessed) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                // Only the draft fields are conditional: a pass that
                // merely bought a verdict for an unchanged draft must not
                // rewrite the draft, or `suggestedDraftedFor` would move
                // and claim the draft answers a newer message than it
                // does.
                ...(regenerated
                  ? {
                      suggestedMessage: message,
                      suggestedSubject: subject ?? null,
                      suggestedQuickReplies: quickReplies ? (quickReplies as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                      suggestedDraftedFor: newestMessageAt,
                      suggestedDraftKind: draftKind,
                    }
                  : {}),
                // Written with the draft it judged, so the next pass
                // reuses it instead of re-paying for the same answer
                // about the same words. A verdict stored against a
                // different draft would be worse than none.
                suggestedRiskLevel: risk.riskLevel,
                suggestedRiskReason: risk.reason || null,
              },
            });
          }
          // A cold-lead hold isn't a risk finding, so it needs its own
          // sentence — risk.reason is empty when the classifier said "low"
          // and we held anyway, and "Held because ." is what the owner
          // would otherwise read on the approval card. Reaching the hold
          // with a "low" verdict is only possible via isCold, so these two
          // branches cover that case completely.
          //
          // The unanswered variant says something different on purpose. A
          // lead who merely went quiet is a judgement call about whether to
          // reach back out; a lead who WROTE and never got an answer is a
          // different fact about the business, and the approval card should
          // not describe it as if the lead simply drifted away. (`daysQuiet`
          // is the same count the draft's steer above was given.)
          //
          // "They", not the raw lead.name, when FollowUp doesn't actually
          // know who this is: an Instagram DM lead is filed as "Instagram
          // DM" until a handle is learned, and "Instagram went quiet 5
          // days ago" is the same placeholder-as-a-person bug that sent a
          // real lead "Hi! Instagram," on 2026-09-19.
          // Every string here is rendered by ApprovalQueue as "Held
          // because <reason>." — so each one is written as a clause that
          // finishes that sentence, lowercase unless it starts with the
          // lead's actual name. The holdAll branch used to read "Ready to
          // send — this account holds…", which came out as "Held because
          // Ready to send", a capital mid-sentence contradicting itself
          // in six words; the fallback was "They", which came out as
          // "Held because They went quiet".
          const firstName = greetingFirstName(lead.name) || "they";
          const holdReason =
            risk.riskLevel !== "low"
              ? risk.reason
              : // Ahead of holdAll, because it is the more specific fact
                // and the one the owner needs in order to judge the draft:
                // this conversation predates FollowUp, so FollowUp does not
                // know what already happened on it.
                isBackfilled
                ? `this conversation was already in your inbox before FollowUp started watching it, so it hasn't seen what you may have already done about it`
              : // One step further along than isBackfilled, and ahead of
                // it in specificity: there is no conversation at all.
                // The owner needs to know the draft was written from what
                // they typed in and nothing else, because that is the
                // only way to read it properly.
                isUntouched
                ? UNTOUCHED_LEAD_REASON
              : phoneNeverWrote
                ? NEVER_WROTE_REASON
              : holdAll
                ? HOLD_ALL_AUTOMATION_REASON
              : // Below holdAll on purpose. While the hold is on, THAT is
                // why this is waiting and saying anything else would be a
                // more specific answer to a question nobody asked. The
                // backlog sentence only becomes the true one once the
                // owner has actually granted a permission and is looking
                // at a queue that did not shrink.
                autonomousBacklog || autoSendBacklog
                ? BACKLOG_BEFORE_PERMISSION_REASON
                : isUnanswered
                  ? `${firstName} wrote ${daysQuiet} days ago and never got an answer — this reply is yours to send`
                  : `${firstName} went quiet ${daysQuiet} days ago — reaching back out is your call`;

          /*
           * Tell somebody, whichever rule held it.
           *
           * This used to fire only for a NEGLECTED lead — one the owner
           * had left unanswered. Every other held draft (the silence
           * nudge, the dead-lead reactivation, and above all a business
           * holding everything for approval) went into the queue with
           * nobody told.
           *
           * Production, 2026-09-21: twenty-three leads waiting, the
           * oldest at 175 hours. The queue was only ever visible to
           * someone who opened the dashboard, and the weekly digest
           * reports what FollowUp did, never what is waiting. Holding is
           * now the default for every account, so that silence would have
           * been every tester's whole first impression.
           *
           * notifyNeglect keeps its own wording for the neglect case,
           * which says something this one cannot — that the lead wrote and
           * was left. Everything else gets the plainer sentence.
           */
          if (unansweredIds.has(lead.id)) {
            // Kept immediate and kept individual. This one says the lead
            // WROTE and was left waiting, and for how long — a fact about
            // a specific person that a count cannot carry. It is also the
            // rare case: a burst comes from imported history, where nobody
            // wrote to us at all.
            await notifyNeglect(lead, conversation, "held");
          } else {
            // Collected rather than written, and flushed once the run
            // knows how many there were. A fresh Gmail connect holds up to
            // a hundred of these in one tick; see src/lib/holdNotices.ts.
            heldNotices.push({
              leadId: lead.id,
              businessId: lead.businessId,
              assignedToId: lead.assignedToId,
              message: `${firstName} — a follow-up is written and waiting for your approval.`,
            });
          }
          // Held-not-sent is as much a real AI decision as a send — the
          // risk gate is exactly the guarantee Rule 3 (trust ships like a
          // feature) is about, so it belongs in the same audit trail an
          // actual send gets (see the "ai.send" call in sendFollowUpToLead,
          // src/lib/sending.ts), not just a string in this run's summary.
          void recordAudit({ businessId: lead.businessId, userId: null }, "ai.hold", {
            targetType: "lead",
            targetId: lead.id,
            meta: {
              riskLevel: risk.riskLevel,
              reason: holdReason,
              trigger: unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence",
              // Which of the four reminders this was, so the trail can say
              // "reminder 3 of 4" rather than just "silence".
              ...(reminderStep !== undefined ? { reminderStep: reminderStep + 1 } : {}),
              ...(freshInboundAt ? { fresh: true } : {}),
            },
          });
          return { kind: "held", note: `${lead.name}: ${holdReason}` };
        }
      }

      const trigger = unansweredIds.has(lead.id) ? "unanswered" : isDeadLead ? DEAD_LEAD_ACTION : "silence";

      /**
       * The send window — now the LAST thing before the send, not the first
       * thing after the claim (see the note at the claim above).
       *
       * What it holds back: anything FollowUp starts on its own (the four
       * reminders, the welcome back) and a reply to a message that is no
       * longer fresh, by email or text — a customer's 1am email answered by
       * the hourly rule at 4am is still a text at 4am. What it does not:
       *   - the fresh pass. The customer wrote minutes ago; they are awake.
       *   - a late reply on Instagram, Messenger or WhatsApp. Meta's 24-hour
       *     window is the clock that matters there, and holding a reply owed
       *     since 11pm until 8am can put it past the point where it may be
       *     sent at all.
       *
       * Deferring keeps what this pass already paid for — the draft, its
       * kind and stamp, and any verdict — so the next in-window tick reuses
       * it instead of buying it again, and releases the claim so that tick
       * is the very next one rather than one twenty hours away.
       */
      const replyOnMetaWindow =
        trigger === "unanswered" && (sendChannel === "instagram" || sendChannel === "messenger" || sendChannel === "whatsapp");
      if (!freshInboundAt && !replyOnMetaWindow && !isWithinSendWindow(new Date(), timezone)) {
        if (regenerated || verdictToKeep) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              ...(regenerated
                ? {
                    suggestedMessage: message,
                    suggestedSubject: subject ?? null,
                    suggestedQuickReplies: quickReplies ? (quickReplies as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                    suggestedDraftedFor: newestMessageAt,
                    suggestedDraftKind: draftKind,
                  }
                : {}),
              suggestedRiskLevel: verdictToKeep?.riskLevel ?? null,
              suggestedRiskReason: verdictToKeep?.reason || null,
            },
          });
        }
        await prisma.lead.updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } });
        return { kind: "deferred" };
      }

      /**
       * "Stop the moment they reply", made true for the seconds between
       * reading this conversation and sending into it.
       *
       * Drafting and checking take real time — two model calls — and a
       * customer who writes in that gap would otherwise get a reminder, or
       * a reply to their previous message, on top of the one they just
       * sent. A conditional write rather than a read: it succeeds only if
       * nothing newer than what this pass drafted against has arrived, and
       * it refreshes the claim while it is at it. If the conversation moved,
       * the claim is handed back so the fresh-reply worker can answer what
       * they actually said.
       */
      //
      // Measured across every conversation this lead has, not off
      // `newestMessageAt` (the last row of the last conversation): a lead
      // with an older email thread and a newer WhatsApp one would otherwise
      // look "moved" on every pass and never be sent anything.
      const allSentAt = lead.conversations.flatMap((c) => c.messages.map((m) => m.sentAt.getTime()));
      if (allSentAt.length > 0) {
        const readUpTo = new Date(Math.max(...allSentAt));
        const stillCurrent = await prisma.lead.updateMany({
          where: { id: lead.id, conversations: { none: { messages: { some: { sentAt: { gt: readUpTo } } } } } },
          data: { lastAutomationCheckedAt: new Date() },
        });
        if (stillCurrent.count === 0) {
          await prisma.lead.updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } });
          return { kind: "skipped", note: `${lead.name}: the conversation moved while this was being written — nothing sent` };
        }
      }

      const result = await sendFollowUpToLead(lead.id, message, {
        automated: true,
        trigger,
        subject,
        channel: sendChannel,
        ...(reminderStep !== undefined || freshInboundAt
          ? { extraAuditMeta: { ...(reminderStep !== undefined ? { reminderStep: reminderStep + 1 } : {}), ...(freshInboundAt ? { fresh: true } : {}) } }
          : {}),
        // The chips under a DM, each tagged with which message carried it
        // and which question it answers, so a tap comes back as an answer
        // rather than a bare word (src/lib/quickReplies.ts).
        quickReplies: quickReplies && quickReplies.buttons.length > 0 ? toQuickReplies(quickReplies, trigger) : undefined,
      });
      if (result.success && unansweredIds.has(lead.id)) await notifyNeglect(lead, conversation, "sent");
      return result.success
        ? { kind: "sent" }
        : { kind: "skipped", note: `${lead.name}: ${result.message ?? "unknown error"}` };
    } catch (err) {
      // The claim taken above is what stops two ticks racing the same lead.
      // It was never released on this path, so a lead that threw stayed
      // claimed until `recheckCutoff` — twenty hours — while the automation
      // badge went on saying "Following up soon". One OpenAI 429, or a cron
      // invocation that times out mid-lead, and that lead is silently out of
      // the running for the rest of the day. On a product whose whole promise
      // is that nothing gets missed, a swallowed twenty-hour gap is the
      // failure, not the 429.
      //
      // The claim is released only for errors that are actually worth
      // retrying soon. Releasing on EVERY error would be worse than the bug:
      // a permanently-failing lead (malformed address, unsupported channel)
      // would be re-drafted every single hour forever, burning OpenAI spend
      // on a message that can never send. So the default is unchanged —
      // stay claimed, retry after the normal recheck — and only the known
      // transient classes get an early retry.
      if (isTransientError(err)) {
        await prisma.lead
          .updateMany({ where: { id: lead.id }, data: { lastAutomationCheckedAt: null } })
          .catch((e) => console.error(`Failed to release automation claim for lead ${lead.id}:`, e));
      }
      return { kind: "skipped", note: `${lead.name}: ${err instanceof Error ? err.message : "unknown error"}` };
    }
  });

  // After the loop, before the summary: every held lead is known, so the
  // burst can be collapsed into one line per person rather than a hundred.
  // Never allowed to fail the run — a notification is how the owner hears
  // about work that is already safely done, not part of doing it.
  await flushHoldNotices(heldNotices).catch((err) =>
    console.error(`Hold notifications failed for business ${businessId}:`, err)
  );

  // The day-2–7 handoff is about windows closing over days; the fresh pass
  // runs every minute and has no business re-scanning for it.
  const handedOff = fresh ? 0 : await draftDmHandoffs(businessId, voiceSamples, tier);

  const sent = outcomes.filter((o) => o.kind === "sent").length;
  const heldOutcomes = outcomes.filter((o): o is { kind: "held"; note: string } => o.kind === "held");
  const deferred = outcomes.filter((o) => o.kind === "deferred").length;
  const skipped = outcomes
    .filter((o): o is { kind: "skipped"; note: string } => o.kind === "skipped")
    .map((o) => o.note);

  return {
    checked: eligible.length,
    unanswered: unanswered.length,
    reactivated: deadIds.size,
    sent,
    held: heldOutcomes.length,
    handedOff,
    deferred,
    skipped,
    heldReasons: heldOutcomes.map((o) => o.note),
  };
}

/** Hours since the lead's last inbound on this channel; null if they never wrote there. */
function hoursSinceLastInbound(conversation: Message[], channel: string | undefined): number | null {
  const last = [...conversation].reverse().find((m) => m.direction === "inbound" && m.channel === channel);
  return last ? (Date.now() - new Date(last.date).getTime()) / 3_600_000 : null;
}

export const DM_HANDOFF_QUESTION = "day2_7_owner";

/**
 * Days 2–7 on Instagram and Messenger: the one message only a person may
 * send (PRODUCT_DIRECTION, "DM-only", 2026-09-16).
 *
 * For every DM lead whose 24-hour window has shut with nothing further
 * from them — they got the automatic touches and did not reply — this
 * writes ONE draft to the reactivation rules (src/lib/dmDrafts.ts, the
 * handoff set), stores it as the suggested reply, records an "ai.hold" so
 * it appears in the approval queue, and tells the owner in one line how
 * long they have. The owner's tap on the lead's page sends it through
 * POST /api/leads/[id]/send, which is where the human-agent tag is
 * attached. Nothing here sends anything.
 *
 * Once per lead per inbound: a draft already written against the lead's
 * current last message is left alone. Skipped for a lead who tapped the
 * exit chip (buttons research §8 — this is the one place the reaction
 * strategy and the rescue strategy disagree; the founder's call is
 * pending, and until then "Not now" means not now), for a lead in a
 * workflow (the workflow owns them), and for anyone past 7 days (Meta
 * refuses it, so there is nothing to draft).
 */
export async function draftDmHandoffs(businessId: string, voiceSamples: string[], tier: "free" | "plus" | "pro"): Promise<number> {
  const H = 3_600_000;
  const now = Date.now();
  // Gathered, then flushed once — see the collector in
  // runAutomationForBusiness and src/lib/holdNotices.ts for why.
  const handoffNotices: HoldNotice[] = [];
  const candidates = await prisma.lead.findMany({
    where: {
      businessId,
      automationTier: { not: "OFF" },
      stage: { notIn: ["WON", "LOST"] },
      sequenceId: null,
      OR: [{ phone: { startsWith: "ig:" } }, { phone: { startsWith: "fb:" } }],
      // Cheap prefilter: anything the lead did in the last 8 days moves
      // lastContacted, so a lead outside this has no window left.
      lastContacted: { gte: new Date(now - (META_HUMAN_AGENT_MAX_HOURS + 24) * H) },
    },
    include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
  });

  let drafted = 0;
  for (const lead of candidates) {
    const channel = isInstagramLeadId(lead.phone) ? "instagram" : isMessengerLeadId(lead.phone) ? "messenger" : null;
    if (!channel) continue;
    const conversation: Message[] = lead.conversations.flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction as Message["direction"],
        channel: c.channel as Message["channel"],
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
        source: m.source ?? undefined,
        trigger: m.trigger ?? undefined,
        quickReplyPayload: m.quickReplyPayload ?? undefined,
      }))
    );
    const inbound = [...conversation].reverse().find((m) => m.direction === "inbound" && m.channel === channel);
    if (!inbound) continue;
    const hours = (now - new Date(inbound.date).getTime()) / H;
    if (hours <= META_DM_WINDOW_HOURS || hours > META_HUMAN_AGENT_MAX_HOURS) continue;
    // They must have gone quiet on US: if their message is the newest thing
    // in the thread, the unanswered rule owns them (and the window is
    // shut for it too — that lead is the owner's to answer, and the
    // approval queue already says so via the unanswered hold).
    const newest = conversation[conversation.length - 1];
    if (!newest || newest.direction !== "outbound") continue;
    if (isExitPayload(inbound.quickReplyPayload)) continue;
    if (settledByTalk(lead.talkedAt, new Date(inbound.date))) continue;
    const already = readStoredQuickReplies(lead.suggestedQuickReplies);
    if (already?.question === DM_HANDOFF_QUESTION && lead.suggestedDraftedFor && lead.suggestedDraftedFor >= new Date(inbound.date)) continue;
    if (!(await checkAiEligibility(businessId, lead, tier)).ok) continue;

    try {
      const dm = await draftDm(lead.name, conversation, voiceSamples, undefined, "handoff");
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          suggestedMessage: dm.body,
          suggestedSubject: null,
          suggestedQuickReplies: { question: DM_HANDOFF_QUESTION, buttons: [] },
          suggestedDraftedFor: new Date(inbound.date),
          suggestedDraftKind: null,
          suggestedRiskLevel: null,
          suggestedRiskReason: null,
        },
      });
      const platform = channel === "instagram" ? "Instagram" : "Messenger";
      const daysLeft = Math.max(1, Math.floor((META_HUMAN_AGENT_MAX_HOURS - hours) / 24));
      const firstName = lead.name.split(" ")[0];
      const reason = `${firstName} didn't reply to the automatic follow-ups on ${platform}, and Meta now only lets a person send the next one — you have ${daysLeft} day${daysLeft === 1 ? "" : "s"}. This draft is yours to send, or leave.`;
      void recordAudit({ businessId, userId: null }, "ai.hold", {
        targetType: "lead",
        targetId: lead.id,
        meta: { riskLevel: "window", reason, trigger: "dm_handoff", channel, daysLeft },
      });
      handoffNotices.push({
        leadId: lead.id,
        businessId: lead.businessId,
        assignedToId: lead.assignedToId,
        message: reason,
      });
      drafted++;
    } catch (err) {
      console.error(`Day-2–7 handoff draft failed for lead ${lead.id}:`, err);
    }
  }

  // Same collapse as the held-draft notifications above. This query has no
  // `take` either, so an account that connected Instagram and let a week's
  // DMs go unanswered could hand off a dozen at once — and each of these
  // carries a deadline, which is exactly the kind of message that stops
  // being read when it arrives twelve times.
  await flushHoldNotices(handoffNotices).catch((err) =>
    console.error(`DM handoff notifications failed for business ${businessId}:`, err)
  );

  return drafted;
}

// notifyLeadOwners lived here: the assignee, or every admin when nobody
// is assigned, one notification written immediately. Both of its callers
// now collect into a HoldNotice list instead, and flushHoldNotices does
// the same recipient resolution once for the whole run — so keeping it
// would leave a second, un-batched way to write the same notification,
// which is how the burst got into two places to begin with.

/** What a real scheduler calls: every business with automation on, in one pass. */
/**
 * Tells the assigned person what just happened on a neglected lead. A held
 * draft is "one click from answered"; a sent one is "handled, here's what
 * went out." Once per consideration — lastAutomationCheckedAt keeps this
 * from repeating every hour.
 */
async function notifyNeglect(
  lead: { id: string; name: string; businessId: string; assignedToId: string | null },
  conversation: Message[],
  outcome: "held" | "sent"
): Promise<void> {
  const lastInbound = [...conversation].reverse().find((m) => m.direction === "inbound");
  const waited = lastInbound ? waitedFor(new Date(lastInbound.date)) : "a while";
  const message =
    outcome === "sent"
      ? `${lead.name} wrote ${waited} ago and hadn't heard back — FollowUp replied for you. Check the thread.`
      : `${lead.name} wrote ${waited} ago and hasn't heard back — a reply is drafted and waiting for your approval.`;
  try {
    // An unassigned lead (the shared pool / "up for grabs") has nobody to
    // hand this off to individually — this used to just return early,
    // which meant a held draft on a pond lead notified nobody at all
    // (research/product/2026-09-10-ux-simplification.md §0.6). Falling
    // back to every admin on the business is the right default for the
    // common case (one solo owner, who is the sole admin) and still
    // reaches someone on a small team rather than silently dropping it.
    const userIds = lead.assignedToId
      ? [lead.assignedToId]
      : (await prisma.user.findMany({ where: { businessId: lead.businessId, role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
    for (const userId of userIds) {
      await prisma.notification.create({ data: { userId, leadId: lead.id, message } });
    }
  } catch (err) {
    console.error(`Neglect notification failed for lead ${lead.id}:`, err);
  }
}

export async function runAutomationForAllBusinesses(): Promise<AutomationResult> {
  const enabled = await prisma.automation.findMany({
    where: { action: "auto_send", enabled: true },
    select: { businessId: true },
  });

  // One business's automation blowing up (a bad token, a billing edge
  // case, an unexpected API error) must not take down every other
  // business's daily run — each is isolated and, at real tenant counts,
  // a few running at once instead of strictly one-at-a-time keeps one
  // cron invocation from running for hours.
  const results = await mapWithConcurrency(enabled, 3, async ({ businessId }) => {
    try {
      return await runAutomationForBusiness(businessId);
    } catch (err) {
      console.error(`Automation run failed for business ${businessId}:`, err);
      return {
        ...EMPTY_RESULT,
        skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`],
      } satisfies AutomationResult;
    }
  });

  const totals: AutomationResult = { ...EMPTY_RESULT, skipped: [], heldReasons: [] };
  for (const result of results) {
    totals.checked += result.checked;
    totals.unanswered += result.unanswered;
    totals.reactivated += result.reactivated;
    totals.sent += result.sent;
    totals.held += result.held;
    totals.deferred += result.deferred;
    totals.skipped.push(...result.skipped);
    totals.heldReasons.push(...result.heldReasons);
  }
  return totals;
}

/**
 * How many recently-active leads one tick looks at. A lead whose message
 * is not reached this minute is reached the next; the cap only bounds a
 * burst (a Gmail reconnect touching hundreds of threads at once).
 */
const FRESH_SCAN_LIMIT = 500;

/**
 * A reply within five minutes of any new message, on every channel, at any
 * hour — founder's follow-up strategy, 2026-09-25. Called once a minute by
 * /api/cron/fresh-replies.
 *
 * Why this exists: the draft was always written within seconds (every
 * capture path scores in-line), but getting it IN FRONT of anyone waited
 * on the hourly unanswered rule — three hours for a lead's first real
 * reply, 24 (20 on Instagram and Messenger) for every message after that,
 * and only between 8am and 6pm. A returning customer who wrote at 7pm was
 * first shown to the owner, or answered, the next evening.
 *
 * On a holding account (the default), "within five minutes" means the
 * draft is on Today and the owner has been told. On an account that sends
 * without asking, a low-risk reply goes out; anything the risk check flags
 * still waits, exactly as Settings promises. Both are
 * runAutomationForBusiness's own decisions — this only finds the leads and
 * hands them over, so there is still exactly one place those rules live.
 *
 * Found by lastContacted, which every capture path moves when a message
 * arrives (and every send moves when one leaves — those are filtered out
 * by freshInboundToAnswer, since their newest message is ours).
 */
export async function runFreshRepliesForAllBusinesses(): Promise<AutomationResult> {
  const recent = await prisma.lead.findMany({
    where: {
      lastContacted: { gte: new Date(Date.now() - FRESH_REPLY_WINDOW_MS) },
      automationTier: { not: "OFF" },
      stage: { notIn: ["WON", "LOST"] },
      sequenceId: null,
    },
    select: { id: true, businessId: true },
    orderBy: { lastContacted: "asc" },
    take: FRESH_SCAN_LIMIT,
  });
  const byBusiness = new Map<string, string[]>();
  for (const l of recent) byBusiness.set(l.businessId, [...(byBusiness.get(l.businessId) ?? []), l.id]);

  // Same isolation as the hourly fan-out: one business failing must not
  // cost every other business its replies this minute.
  const results = await mapWithConcurrency([...byBusiness.entries()], 3, async ([businessId, freshLeadIds]) => {
    try {
      return await runAutomationForBusiness(businessId, { freshLeadIds });
    } catch (err) {
      console.error(`Fresh-reply run failed for business ${businessId}:`, err);
      return {
        ...EMPTY_RESULT,
        skipped: [`Business ${businessId}: ${err instanceof Error ? err.message : "unknown error"}`],
      } satisfies AutomationResult;
    }
  });

  const totals: AutomationResult = { ...EMPTY_RESULT, skipped: [], heldReasons: [] };
  for (const result of results) {
    totals.checked += result.checked;
    totals.unanswered += result.unanswered;
    totals.sent += result.sent;
    totals.held += result.held;
    totals.skipped.push(...result.skipped);
    totals.heldReasons.push(...result.heldReasons);
  }
  return totals;
}
