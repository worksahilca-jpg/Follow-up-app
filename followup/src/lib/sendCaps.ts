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
 * How long a reservation (see below) counts as "possibly still in flight".
 * Comfortably above the slowest realistic provider call this product makes
 * (Gmail/Twilio/Meta send APIs) — long enough that a real send can't
 * outlive it, short enough that a failed attempt's reservation doesn't
 * shadow the cap for long. Deliberately generous rather than tight: this
 * fuse should never be reached in normal use (see file header), so erring
 * conservative here costs nothing a real customer would notice.
 */
const RESERVATION_TTL_MS = 10 * 60 * 1000;

const RESERVATION_ACTION = {
  automated: "sendcap:automated",
  reactivation: "sendcap:reactivation",
} as const;

/**
 * B-006 (research/audit/backend-backlog.md): counting from FollowUp rows
 * alone — the record written for every real send — is honest about what
 * actually went out, but it is a plain count-then-act: nothing stopped
 * several concurrent callers (the automation loop's mapWithConcurrency(3))
 * from all reading the same pre-send count and all passing, each of them
 * committing its FollowUp row only much later, after a slow external send.
 *
 * The fix mirrors src/lib/rateLimit.ts's checkAndRecordHit — an advisory
 * lock serializes concurrent callers for the same business, and a
 * reservation is written before the lock is released so the very next
 * concurrent caller sees it. The difference from rateLimit.ts: that
 * function's own "hit" IS the completed action, recorded in the same beat
 * as the check. A send cannot work that way — the real record (the
 * FollowUp row) can only be written after the external provider call
 * returns, which may take seconds, and holding this lock (or a DB
 * transaction at all) open across that call risks starving the connection
 * pool and blowing Prisma's own interactive-transaction timeout for no
 * real gain — this lock only ever contends against the same business's
 * own concurrent sends (at most 3, the automation loop's own concurrency
 * limit), never across businesses.
 *
 * So the count blends two sources: real FollowUp rows (truth, persists the
 * full 24h window) plus RateLimitHit reservations younger than
 * RESERVATION_TTL_MS (a stand-in for "a send this business started but
 * hasn't landed a FollowUp row for yet"). A reservation is written only on
 * the allowed path — a blocked check never reaches the provider, so there
 * is nothing in flight to reserve. If the send that follows ultimately
 * fails, the reservation still ages out on its own after
 * RESERVATION_TTL_MS; nothing needs to release it.
 */
export async function checkSendCap(
  businessId: string,
  kind: SendCapKind
): Promise<SendCapVerdict> {
  const since = new Date(Date.now() - WINDOW_MS);
  const reservedSince = new Date(Date.now() - RESERVATION_TTL_MS);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sendcap:${businessId}`}))`;

    const [automatedSent, reactivationSent, automatedReserved, reactivationReserved] = await Promise.all([
      tx.followUp.count({
        where: { lead: { businessId }, automated: true, sentAt: { gte: since } },
      }),
      tx.followUp.count({
        where: {
          lead: { businessId },
          automated: true,
          trigger: "dead_lead_reactivation",
          sentAt: { gte: since },
        },
      }),
      // Every reservation (plain automated or reactivation) is recorded
      // under the automated key too — see below — so this alone mirrors
      // what automatedSent counts: every automated send, of any trigger.
      tx.rateLimitHit.count({
        where: { businessId, action: RESERVATION_ACTION.automated, createdAt: { gte: reservedSince } },
      }),
      tx.rateLimitHit.count({
        where: { businessId, action: RESERVATION_ACTION.reactivation, createdAt: { gte: reservedSince } },
      }),
    ]);

    const automatedUsed = automatedSent + automatedReserved;
    const reactivationUsed = reactivationSent + reactivationReserved;

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

    // Reserve this slot now, inside the same locked transaction, so the
    // very next concurrent caller for this business — still waiting on
    // the lock above — counts it. A reactivation send reserves under both
    // keys, matching how its eventual FollowUp row counts toward both
    // automatedSent and reactivationSent above.
    await tx.rateLimitHit.create({ data: { businessId, action: RESERVATION_ACTION.automated } });
    if (kind === "reactivation") {
      await tx.rateLimitHit.create({ data: { businessId, action: RESERVATION_ACTION.reactivation } });
    }

    return {
      allowed: true,
      used: kind === "reactivation" ? reactivationUsed : automatedUsed,
      cap: kind === "reactivation" ? DAILY_REACTIVATION_SEND_CAP : DAILY_AUTOMATED_SEND_CAP,
    };
  });
}
