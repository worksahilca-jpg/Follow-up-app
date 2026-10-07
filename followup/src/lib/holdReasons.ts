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

import { ANSWER_SLOT_REASON, PRICE_SLOT_REASON } from "@/lib/priceSlot";

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
 * A phone lead the owner messaged first, who has never written back.
 * FollowUp never texts or WhatsApps someone on its own who has not
 * contacted the business (security pass 2026-09-25 F1), so the first
 * message is the owner's to send.
 */
export const NEVER_WROTE_REASON =
  "they have never messaged you, so FollowUp won't text or WhatsApp them on its own — the first message is yours to send";

/**
 * A lead FollowUp found in the Gmail spam folder (founder, 2026-10-01).
 * Some of those really are spam or scams, and an automatic reply tells a
 * spammer the address is live, so nothing goes out until the owner has
 * written to them once, which is how they confirm it's a real customer.
 */
export const FOUND_IN_SPAM_REASON =
  "this email was in your spam folder, so FollowUp waits for you to confirm it's a real customer before anything goes out";

/** The source a lead found in the Gmail spam folder is filed under. */
export const SPAM_FOLDER_SOURCE = "Gmail (spam)";

/**
 * A customer who is also in the business's CRM (Follow Up Boss, HubSpot).
 * Those CRMs often run their own follow-ups, which FollowUp can't see, so
 * FollowUp never follows up with them on its own: the customer could get
 * two check-ins. Founder, 2026-09-29.
 */
export const IN_CRM_REASON =
  "they're also in your CRM, which may send its own follow-ups, so FollowUp waits for you rather than risk a second message";

/**
 * The customer's newest message asked whether they're talking to a real
 * person (Lead.askedIfPersonAt, situations audit 2026-10-06). The draft can
 * only promise that someone will come back to them, so a person has to.
 */
export const ASKED_IF_PERSON_REASON = "they asked whether they're talking to a real person, so this one is for you to answer";

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
  availability: "the draft says whether it's available, and only you know that — check it before it goes",
  booking: "the draft tells them a time is booked or confirmed, and only you can confirm that — check it before it goes",
  done: "the draft says you already sent, called or arranged something this conversation doesn't show — check it before it goes",
  policy: "the draft states what's free, included, refundable or guaranteed, and you haven't said that here — check it before it goes",
  hours: "the draft says when you're open, and only you know that — check it before it goes",
  service: "the draft says what you cover, offer or accept, and you haven't said that here — check it before it goes",
  // Founder, 2026-09-29: a link or address that didn't come from the
  // business (inventedSpecific in src/lib/dmDrafts.ts). Usually the lead's
  // own, which is exactly the one that must not go out in the owner's name.
  link: "the draft has a link or email address you didn't write — check it before it goes",
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

/**
 * Why a reply is waiting, said the way the owner would say it (founder, 2026-10-05: round 1 of the
 * check-up, A-087). The clauses above finish "Held because …", which made every card read like a log
 * line, and the risk judge's own sentences ("The draft references previous communication and offers
 * tailored information, which could imply commitments…") were worse. This turns any stored reason into
 * one short line that says what to check.
 *
 * Null means "say nothing": the only thing holding it is the account's every-reply-waits setting, and
 * the card already says "waits for your OK". The stored reasons are left as they are, because the safe
 * pile matches them exactly (isHeldOnlyByApprovalSetting); this is only how they are shown.
 */
export function plainHoldReason(reason: string, opts: { firstName: string; topic?: string | null }): string | null {
  const r = reason.trim().replace(/\.\s*$/, "");
  const first = opts.firstName;
  if (r === BACKLOG_BEFORE_PERMISSION_REASON) return "This was waiting before you turned sending on.";
  if (!r || isHeldOnlyByApprovalSetting(r)) return null;
  const known = PLAIN_BY_REASON[r];
  if (known) return known(first);
  const off = /^FollowUp is switched off for (.+?), so this reply only goes when you send it$/.exec(r);
  if (off) return `FollowUp is off for ${off[1]}, so this only goes when you send it.`;
  // The risk judge's own words: say what kind of check it is, not its essay.
  switch (opts.topic) {
    case "price":
      return "Check the price before it goes.";
    case "date":
      return "Check the day or time before it goes.";
    case "tense":
      return `${first} sounds unhappy. Read it before it goes.`;
  }
  if (/\b(price|cost|fee|\$|quote)/i.test(r)) return "Check the price before it goes.";
  if (/\b(availab|schedul|booking|appointment)/i.test(r)) return "Check: it says what's available. Only you know that.";
  if (/\b(frustrat|upset|angry|unhappy|complain)/i.test(r)) return `${first} sounds unhappy. Read it before it goes.`;
  if (/\bsent\b/i.test(r) && /\b(confirm|claims?)/i.test(r)) return "Check: it says you already sent something. This conversation doesn't show that.";
  if (/\b(commit|promis|impl(y|ies))/i.test(r)) return "Read it before it goes: it promises something.";
  // Anything else (a Meta messaging window, a reason added later): its own words, as a sentence.
  const sentence = r.replace(/ — check it before it goes$/, "");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

const PLAIN_BY_REASON: Record<string, (first: string) => string> = {
  [UNTOUCHED_LEAD_REASON]: (first) => `You added ${first} yourself, so this is written from your notes only.`,
  [NEVER_WROTE_REASON]: () => "They haven't messaged you yet, so the first message is yours to send.",
  [FOUND_IN_SPAM_REASON]: () => "This came from your spam folder. Make sure it's a real customer.",
  [IN_CRM_REASON]: () => "They're also in your CRM, which may send its own follow-up.",
  [RISK_CHECK_FAILED_REASON]: () => "FollowUp couldn't check this one, so it's waiting to be safe.",
  [ASKED_IF_PERSON_REASON]: (first) => `${first} asked if they're talking to a real person. Answer this one yourself.`,
  "this conversation was already in your inbox before FollowUp started watching it, so it hasn't seen what you may have already done about it":
    () => "This was in your inbox before FollowUp started. Check you haven't already answered.",
  [PRICE_SLOT_REASON]: () => "Add the price, then send.",
  [ANSWER_SLOT_REASON]: () => "Add your answer, then send.",
  [UNGROUNDED_DRAFT_REASONS.digits]: () => "Check the number. Nobody wrote it in this conversation.",
  [UNGROUNDED_DRAFT_REASONS.currency]: () => "Check the price. Nobody mentioned one here.",
  [UNGROUNDED_DRAFT_REASONS.time]: () => "Check the time. Nobody gave one here.",
  [UNGROUNDED_DRAFT_REASONS.calendar]: () => "Check the day. Nobody mentioned it here.",
  [UNGROUNDED_DRAFT_REASONS.availability]: () => "Check: it says what's available. Only you know that.",
  [UNGROUNDED_DRAFT_REASONS.booking]: () => "Check: it says a time is booked. Only you can confirm that.",
  [UNGROUNDED_DRAFT_REASONS.done]: () => "Check: it says you already did something this conversation doesn't show.",
  [UNGROUNDED_DRAFT_REASONS.policy]: () => "Check: it says what's free, included or guaranteed.",
  [UNGROUNDED_DRAFT_REASONS.hours]: () => "Check: it says when you're open. Only you know that.",
  [UNGROUNDED_DRAFT_REASONS.service]: () => "Check: it says what you offer. You haven't said that here.",
  [UNGROUNDED_DRAFT_REASONS.link]: () => "Check the link or email address. You didn't write it.",
};
