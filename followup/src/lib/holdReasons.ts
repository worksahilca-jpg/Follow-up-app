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

/** Business.holdAllForApproval, reached via a workflow step. */
export const HOLD_ALL_SEQUENCE_REASON = "your account holds every follow-up for your approval before it sends";

/**
 * assessSendRisk threw. Held rather than sent, in both schedulers: an
 * unchecked message going out is worse than a review nobody needed.
 */
export const RISK_CHECK_FAILED_REASON = "FollowUp couldn't check this one automatically, so it is holding it to be safe";

/** Exactly what ApprovalQueue.tsx builds, so tests can check the seam. */
export function renderHeldBecause(reason: string): string {
  return `Held because ${reason.replace(/\.\s*$/, "")}.`;
}
