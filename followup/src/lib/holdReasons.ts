/**
 * Why a drafted follow-up is waiting for a human, in the owner's words.
 *
 * Every one of these is rendered by ApprovalQueue.tsx as exactly:
 *
 *     Held because <reason>.
 *
 * so each is written as a CLAUSE that finishes that sentence — lowercase
 * first word, no full stop. That is the whole reason this file exists.
 * On 2026-09-20 the hold-everything reason was written as a standalone
 * sentence and came out, to every beta tester, as:
 *
 *     "Held because Ready to send — this account holds every automated
 *      message for you to approve."
 *
 * A capital mid-sentence, contradicting the word before it, on the single
 * most trust-bearing line in the product. The strings lived inline in two
 * schedulers, which is how they drifted apart and how the grammar rule
 * stayed unwritten. They live here now, shared by both and checked by
 * src/lib/__tests__/holdReasonGrammar.test.ts.
 *
 * The other reasons — the ones that name a lead or a number of days — are
 * still built at the call site, because they interpolate. The same rule
 * applies to them and the test covers the shapes they produce.
 */

/** Business.holdAllForApproval, reached via the hourly silence check. */
export const HOLD_ALL_AUTOMATION_REASON =
  "your account holds every automated message for you to approve before it goes out";

/**
 * Held because the conversation predates the permission being granted.
 *
 * The queue's most confusing moment without it. An owner turns sending on
 * expecting things to start moving, and instead the queue looks FULLER
 * than before — because every draft that had piled up while the switch
 * was off is still there, deliberately (see automation.ts's backlog
 * guards: granting means "from now on", never "and everything since").
 *
 * With no sentence of its own that reads as the feature not working. One
 * sentence covers both switches, because which of the two held it is not
 * a distinction the owner has any use for — what they need to know is
 * that this is old, that it is theirs to release, and that the queue is
 * not broken.
 *
 * Counted as held-only-by-the-setting below, which is what keeps these
 * releasable in one press. A backlog draft has no problem of its own; it
 * is waiting on a decision, and the decision is exactly what the routine
 * pile's button makes.
 */
export const BACKLOG_BEFORE_PERMISSION_REASON =
  "this one was already waiting before you turned sending on, so FollowUp left it for you rather than sending it with everything else";

/** Business.holdAllForApproval, reached via a workflow step. */
export const HOLD_ALL_SEQUENCE_REASON = "your account holds every follow-up for your approval before it sends";

/**
 * Business.holdAllForApproval, reached via the instant acknowledgement —
 * someone wrote in for the first time and got nothing back.
 *
 * Worth its own string because it is the most urgent kind of hold in the
 * product and the only one where the lead is still sitting there waiting.
 * The others are FollowUp deciding whether to reach back out; this one is
 * a stranger's first message, unanswered.
 */
export const HOLD_ALL_FIRST_REPLY_REASON =
  "your account holds every message for your approval, and this is the first reply to someone who has just written in";

/**
 * A lead FollowUp has never seen a message on — typed into the manual
 * form, imported from a CSV, logged after a phone call.
 *
 * Until 2026-09-20 these leads reached no automation at all: every
 * eligibility query asked `lastContacted <= cutoff`, and their
 * lastContacted is null. Now they reach it and are always held, whatever
 * the tier — there is no conversation to write against, so the draft
 * comes from the name, the company and the notes, and the person on the
 * other end never asked to hear from anyone.
 */
export const UNTOUCHED_LEAD_REASON =
  "FollowUp has never seen a message on this lead, so this draft is written from what you typed in and nothing else";

/**
 * assessSendRisk threw. Held rather than sent, in both schedulers: an
 * unchecked message going out is worse than a review nobody needed.
 */
export const RISK_CHECK_FAILED_REASON = "FollowUp couldn't check this one automatically, so it is holding it to be safe";

/**
 * An email follow-up that names a specific the conversation never
 * contained — keyed by the rule `ungroundedSpecifics` (src/lib/grounding.ts)
 * failed on.
 *
 * Each says what to look for rather than "the draft failed a check",
 * because the owner is about to read the draft and the only useful thing
 * to tell them is which part of it to distrust. From the founder's own
 * approval queue, 2026-09-20: a lead asked what a consultation costs and
 * the draft answered "El costo será de $100" — a price nobody had
 * mentioned, about to go out in his name.
 */
export const UNGROUNDED_DRAFT_REASONS: Record<string, string> = {
  digits: "the draft uses a number nobody in this conversation wrote — check it before it goes",
  currency: "the draft quotes a price nobody in this conversation mentioned — check it before it goes",
  time: "the draft names a time nobody in this conversation gave — check it before it goes",
  calendar: "the draft names a day nobody in this conversation mentioned — check it before it goes",
};

/** Exactly what ApprovalQueue.tsx builds, so tests can check the seam. */
export function renderHeldBecause(reason: string): string {
  return `Held because ${reason.replace(/\.\s*$/, "")}.`;
}

/**
 * The three reasons above that mean "nothing was wrong with this draft —
 * the account's approval setting is what stopped it".
 *
 * Lives here, beside the constants, because it is a fact ABOUT the
 * reasons: @/lib/pendingApprovals needs it to order the queue and
 * @/lib/sendPreview needs it to count, and those two already depend on
 * each other in one direction.
 *
 * Matched exactly, never by substring. These strings are customer-facing
 * prose that gets reworded — all three were rewritten on 2026-09-20 over
 * a grammar bug — and a fuzzy match would quietly start classifying the
 * wrong drafts after an edit nobody connected to this function. An exact
 * match fails loudly instead, and a reason this set has never seen counts
 * as "needs a human", which is the safe side.
 */
const HELD_ONLY_BY_SETTING: ReadonlySet<string> = new Set([
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  HOLD_ALL_FIRST_REPLY_REASON,
  // Backlog belongs here, and that is load-bearing rather than
  // incidental: this set is what the one-click routine pile is built
  // from, so leaving it out would hold the entire back catalogue in a
  // queue with no way to release it except one lead at a time — which
  // would make the backlog guard a trap instead of a courtesy.
  BACKLOG_BEFORE_PERMISSION_REASON,
]);

export function isHeldOnlyByApprovalSetting(reason: string): boolean {
  return HELD_ONLY_BY_SETTING.has(reason);
}
