/**
 * A circuit breaker on automated sending. Not a product limit.
 *
 * There was no ceiling at all before this: the hourly automation queried
 * every eligible lead with no `take`, and the reactivation batch resumed
 * across invocations until it ran out of people.
 *
 * The obvious fix — cap it low — is wrong, and was tried and rejected.
 * Google Workspace allows roughly 2,000 external recipients per rolling 24
 * hours, and the rules that would force an unsubscribe link only bite at
 * 5,000 messages a day. A business clearing a 200-lead back catalogue is at
 * 10% of its own mailbox's allowance and nowhere near anyone's bulk
 * threshold. Capping that at 50 would have rationed a customer to a
 * fraction of what they are entitled to, on the day they most needed it.
 *
 * What remains is a stop for the case where the product is BROKEN: a loop,
 * a misconfigured workflow, a sync re-queueing the same leads. That is not
 * hypothetical — two infinite loops were found in this codebase in one
 * afternoon. A runaway firing through a customer's own Gmail gets their
 * account suspended, and what they lose is their real mail.
 *
 * So the number is deliberately far above any legitimate day and far below
 * the provider's ceiling. It should never be reached. If it is, that is an
 * incident to investigate, not a limit a customer has outgrown.
 *
 * What actually keeps complaints down is not volume — it is that every
 * message names the enquiry the person made and the reply they never got
 * (see deadLeadMessageHint in automation.ts). Gmail wants a spam-complaint
 * rate under 0.10% and penalises above 0.30%, and at these volumes a single
 * complaint is a large percentage. Content is the protection; this is only
 * the fuse.
 */

import { prisma } from "@/lib/db";

/**
 * A circuit breaker, NOT a product limit — the distinction is the whole
 * reason for this number.
 *
 * An earlier version capped automated sending at 50/day. That was wrong,
 * and the founder was right to reject it: Google Workspace allows roughly
 * 2,000 external recipients per rolling 24 hours, so 50 rationed a customer
 * to 2.5% of what their own mailbox would happily send. It would have fired
 * on exactly the moment this product exists for — someone connects an inbox
 * with 200 dormant leads, presses send, and FollowUp answers "come back
 * tomorrow." Refusing to do the job it was bought for, to avoid a risk that
 * was never there.
 *
 * 400 is set below Google's ceiling with room to spare, and is not
 * reachable by any legitimate use: a real back catalogue is a few hundred
 * ONCE, and steady state is a handful a week. It exists for the failure
 * case only — a loop, a misconfigured workflow, a sync that re-queues the
 * same leads. Two infinite loops were found in this codebase in a single
 * afternoon; one of them firing through a customer's own Gmail would get
 * their account suspended, and they would lose their real mail, not ours.
 *
 * If this ever fires, something is broken. It should be treated as an
 * incident, not as a customer hitting a plan limit.
 */
export const DAILY_AUTOMATED_SEND_CAP = 400;

/**
 * No separate reactivation ceiling. The back catalogue is the thing the
 * owner explicitly pressed a button to send, having been shown the count
 * and three real drafts — rationing it afterwards would be second-guessing
 * a decision they already made deliberately.
 *
 * It shares the circuit breaker above, which is the only limit that should
 * ever stop it.
 */
export const DAILY_REACTIVATION_SEND_CAP = DAILY_AUTOMATED_SEND_CAP;

export type SendCapKind = "automated" | "reactivation";

export type SendCapVerdict = {
  allowed: boolean;
  /** Sends already made in the window that count against this cap. */
  used: number;
  cap: number;
  /** Owner-facing, only set when blocked. */
  reason?: string;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Counted from FollowUp rows — the record written for every real send —
 * rather than a separate counter, so the number can never drift from what
 * actually went out. A rolling 24 hours rather than a calendar day: a
 * midnight reset would let a batch run twice in a few hours.
 */
export async function checkSendCap(
  businessId: string,
  kind: SendCapKind
): Promise<SendCapVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);

  const [automatedUsed, reactivationUsed] = await Promise.all([
    prisma.followUp.count({
      where: { lead: { businessId }, automated: true, sentAt: { gte: since } },
    }),
    prisma.followUp.count({
      where: {
        lead: { businessId },
        automated: true,
        trigger: "dead_lead_reactivation",
        sentAt: { gte: since },
      },
    }),
  ]);

  if (kind === "reactivation" && reactivationUsed >= DAILY_REACTIVATION_SEND_CAP) {
    return {
      allowed: false,
      used: reactivationUsed,
      cap: DAILY_REACTIVATION_SEND_CAP,
      reason: `FollowUp has stopped after ${DAILY_REACTIVATION_SEND_CAP} messages today as a safety measure — that is far more than a normal day, so something may be wrong. Nothing you send yourself is affected.`,
    };
  }

  if (automatedUsed >= DAILY_AUTOMATED_SEND_CAP) {
    return {
      allowed: false,
      used: automatedUsed,
      cap: DAILY_AUTOMATED_SEND_CAP,
      reason: `FollowUp has stopped after ${DAILY_AUTOMATED_SEND_CAP} messages today as a safety measure — that is far more than a normal day, so something may be wrong. Nothing you send yourself is affected.`,
    };
  }

  return {
    allowed: true,
    used: kind === "reactivation" ? reactivationUsed : automatedUsed,
    cap: kind === "reactivation" ? DAILY_REACTIVATION_SEND_CAP : DAILY_AUTOMATED_SEND_CAP,
  };
}
