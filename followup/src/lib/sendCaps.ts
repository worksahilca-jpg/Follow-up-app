/**
 * How much mail FollowUp will send from one business's mailbox in a day.
 *
 * Before this there was no ceiling anywhere. The hourly automation sent to
 * every eligible lead it found — an unbounded query with no `take` — and
 * the reactivation batch worked through a whole back catalogue, resuming
 * across invocations until it ran out of people. On a first sync that can
 * be several hundred messages out of one small business's own Gmail in an
 * afternoon.
 *
 * Two separate things break at that volume, and only one of them is ours:
 *
 *   The mailbox stops working. Gmail and Microsoft enforce their own
 *   per-day recipient limits (a personal Gmail is the tightest, then
 *   Workspace, then Microsoft 365 — check the current figures, they move).
 *   Crossing one doesn't just fail FollowUp's send: the provider starts
 *   refusing the OWNER'S OWN mail for the rest of the day. We would have
 *   broken the thing they use to run their business, to deliver follow-ups
 *   they never asked us to send that fast.
 *
 *   The sending pattern starts to look like a campaign. Spam filters weigh
 *   volume-in-a-window and complaint rate, not prose quality — forty
 *   individually-written emails to people who haven't replied in months
 *   look, from the outside, exactly like forty identical ones. The damage
 *   lands on the business's domain reputation, so it is paid by the leads
 *   who DID want to hear from them.
 *
 * The caps below are deliberately far under every provider limit. They are
 * not there to approach a ceiling safely; they are there because a real
 * person following up on their own leads does not send eighty emails
 * before lunch, and the product should not either.
 */

import { prisma } from "@/lib/db";

/**
 * Automated sends per business per rolling 24 hours, across every channel
 * and every trigger. Reached only by an unusually busy inbox — the point
 * is to bound the runaway case (a first sync, a misconfigured workflow, a
 * bug like the one that let cold leads into the silent bucket), not to
 * ration ordinary use.
 */
export const DAILY_AUTOMATED_SEND_CAP = 50;

/**
 * Reactivation sends per business per rolling 24 hours, counted inside the
 * cap above rather than on top of it.
 *
 * Much tighter, because this is the one genuinely campaign-shaped thing
 * FollowUp does: many people, at once, none of whom asked today. Twenty-
 * five a day means a 200-lead back catalogue goes out over about a week —
 * which is both what a person doing it by hand would look like, and slow
 * enough that the owner sees the first replies before the last messages
 * leave.
 */
export const DAILY_REACTIVATION_SEND_CAP = 25;

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
      reason: `That's ${DAILY_REACTIVATION_SEND_CAP} reactivation messages today — the rest go out tomorrow. Sending a back catalogue slowly is what keeps it out of spam folders.`,
    };
  }

  if (automatedUsed >= DAILY_AUTOMATED_SEND_CAP) {
    return {
      allowed: false,
      used: automatedUsed,
      cap: DAILY_AUTOMATED_SEND_CAP,
      reason: `FollowUp has sent ${DAILY_AUTOMATED_SEND_CAP} messages for you today and has paused until tomorrow, so your mailbox doesn't get rate-limited. You can still send anything yourself.`,
    };
  }

  return {
    allowed: true,
    used: kind === "reactivation" ? reactivationUsed : automatedUsed,
    cap: kind === "reactivation" ? DAILY_REACTIVATION_SEND_CAP : DAILY_AUTOMATED_SEND_CAP,
  };
}
