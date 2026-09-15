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
 * Google's own published per-day ceilings, as of September 2026. Verify
 * before trusting — Google moves these, and tightened enforcement in late
 * 2025.
 *
 *   Free @gmail.com      ~500 recipients / rolling 24h
 *   Google Workspace   ~2,000 EXTERNAL recipients / rolling 24h
 *
 * FollowUp cannot tell which one a connected mailbox is: the OAuth scopes
 * it holds return the address and the profile, not the edition. So every
 * number below is derived from the SMALLER figure. Guessing high and being
 * wrong means the provider blocks the owner's account; guessing low and
 * being wrong means a batch finishes on Tuesday instead of Monday.
 */
const ASSUMED_PROVIDER_DAILY_LIMIT = 500;

/**
 * The share of that allowance reserved for the owner's own mail.
 *
 * This is their working mailbox — quotes, invoices, replies to their own
 * customers — and it is why the ceiling is not simply "as much as Google
 * permits". If FollowUp consumed the lot, the owner would discover it by
 * finding they could not email anyone for the rest of the day, with no idea
 * why. Whatever we get wrong, it must not be that.
 *
 * Half, not more. 0.6 was tried and rejected by arithmetic: it lands the
 * fuse on exactly 200, which is the size of a typical back catalogue — so
 * the one burst this product is FOR would have tripped the safety stop
 * meant to catch bugs. A fuse that blows during normal use is not a fuse,
 * it is a limit wearing one's clothes.
 */
const OWNER_RESERVE = 0.5;

/**
 * The fuse. NOT a product limit, and the difference is the whole point.
 *
 * An earlier version set this at 50/day. That was wrong and was rejected:
 * it would have fired on precisely the moment this product exists for —
 * connect an inbox, find 200 dormant leads, press send, and be told to come
 * back tomorrow. It also rationed a customer to a fraction of what their
 * own mailbox would happily have sent.
 *
 * Derived rather than picked, so it can be re-derived when Google moves:
 * half of the smallest plausible provider allowance. Comfortably above the
 * largest legitimate burst this product has (a back catalogue is a few
 * hundred, ONCE, and steady state is a handful a week), and far below the
 * point where a mailbox gets blocked.
 *
 * It should never be reached. It exists for the broken case — a loop, a
 * misconfigured workflow, a sync re-queueing the same leads. Not
 * hypothetical: two infinite loops were found in this codebase in a single
 * afternoon, and one of those firing through a customer's own Gmail would
 * get their account suspended. What they lose then is their real mail.
 *
 * If it ever trips, that is an incident to investigate, not a customer who
 * has outgrown a plan — and the message below says so deliberately.
 */
export const DAILY_AUTOMATED_SEND_CAP = Math.floor(
  ASSUMED_PROVIDER_DAILY_LIMIT * (1 - OWNER_RESERVE)
);

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
