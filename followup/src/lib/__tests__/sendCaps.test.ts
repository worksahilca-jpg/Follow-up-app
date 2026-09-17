/**
 * The circuit breaker on automated sending.
 *
 * Not a product limit, and the difference is the point. An earlier version
 * capped this at 50/day, which would have fired on exactly the moment the
 * product exists for: connect an inbox, find 200 dormant leads, press send,
 * and be told to come back tomorrow. Google Workspace itself allows roughly
 * 2,000 external recipients per rolling 24 hours, so 50 rationed a customer
 * to a fraction of what their own mailbox would happily send.
 *
 * What is left is a fuse for when the product is BROKEN — a loop, a
 * misconfigured workflow, a sync re-queueing the same leads. Two infinite
 * loops were found in this codebase in one afternoon, and one of those
 * firing through a customer's own Gmail gets their account suspended: what
 * they lose is their real mail, not ours.
 *
 * So these tests pin both directions. Too low rations a real customer on
 * their first day; too high stops being a fuse at all.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { executeRaw, count, create } = vi.hoisted(() => ({
  executeRaw: vi.fn(async () => 0),
  count: vi.fn(),
  create: vi.fn(async () => ({})),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({
        $executeRaw: executeRaw,
        followUp: { count: (...a: unknown[]) => count(...a) },
        rateLimitHit: { count: (...a: unknown[]) => count(...a), create },
      })
    ),
  },
}));

import { prisma } from "@/lib/db";
import {
  checkSendCap,
  DAILY_AUTOMATED_SEND_CAP,
  DAILY_REACTIVATION_SEND_CAP,
} from "@/lib/sendCaps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transaction = (prisma as any).$transaction as ReturnType<typeof vi.fn>;

/**
 * Calls, in order: followUp.count(automated), followUp.count(reactivation),
 * rateLimitHit.count(automated reservations), rateLimitHit.count
 * (reactivation reservations). Reservations default to 0 — most tests
 * aren't about the race itself, which has its own dedicated case below.
 */
function used(automated: number, reactivation: number, reservedAutomated = 0, reservedReactivation = 0) {
  count
    .mockResolvedValueOnce(automated)
    .mockResolvedValueOnce(reactivation)
    .mockResolvedValueOnce(reservedAutomated)
    .mockResolvedValueOnce(reservedReactivation);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the daily cap", () => {
  it("allows an ordinary day", async () => {
    used(3, 0);
    const v = await checkSendCap("biz-1", "automated");
    expect(v.allowed).toBe(true);
  });

  it("stops at the ceiling, not after it", async () => {
    used(DAILY_AUTOMATED_SEND_CAP, 0);
    const v = await checkSendCap("biz-1", "automated");
    expect(v.allowed).toBe(false);
    expect(v.cap).toBe(DAILY_AUTOMATED_SEND_CAP);
  });

  // It is a fuse, not a plan limit, and the message has to say so — an
  // owner who reads "you have reached your daily limit" concludes they
  // need a bigger plan, when what has actually happened is that something
  // is broken.
  it("reads like a safety stop, not a plan limit", async () => {
    used(DAILY_AUTOMATED_SEND_CAP, 0);
    const v = await checkSendCap("biz-1", "automated");
    expect(v.reason).toMatch(/safety measure/i);
    expect(v.reason).toMatch(/something may be wrong/i);
    expect(v.reason).toMatch(/nothing you send yourself is affected/i);
    expect(v.reason).not.toMatch(/upgrade|plan|limit reached/i);
  });

  // The back catalogue is not rationed. The owner pressed the button having
  // been shown the count and three real drafts; slowing it afterwards would
  // second-guess a decision they already made on purpose. It shares the
  // fuse and nothing else.
  it("does not ration the reactivation batch separately", async () => {
    expect(DAILY_REACTIVATION_SEND_CAP).toBe(DAILY_AUTOMATED_SEND_CAP);

    used(120, 120);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(true);
  });

  // The one burst this product is FOR. A 200-lead back catalogue must clear
  // in a single sitting — an earlier derivation put the fuse at exactly 200
  // and would have stopped it one message short, which is how a safety stop
  // turns into a product limit by accident.
  it("lets a whole back catalogue through in one sitting", async () => {
    used(199, 199);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(true);
    expect(DAILY_AUTOMATED_SEND_CAP).toBeGreaterThan(200);
  });

  it("still trips once the fuse itself is reached", async () => {
    used(DAILY_AUTOMATED_SEND_CAP, DAILY_AUTOMATED_SEND_CAP);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(false);
  });

  // Far above a normal day, far below Google Workspace's own ~2,000/day
  // external-recipient ceiling. Both halves matter: too low rations a real
  // customer, too high stops being a fuse.
  it("sits above real use and below the provider ceiling", () => {
    // Above the largest legitimate burst...
    expect(DAILY_AUTOMATED_SEND_CAP).toBeGreaterThan(200);
    // ...and below the SMALLEST provider allowance (free Gmail ~500/day),
    // because FollowUp cannot tell which edition a mailbox is and must
    // assume the tighter one.
    expect(DAILY_AUTOMATED_SEND_CAP).toBeLessThan(500);
  });

  it("counts only this business, only automated, only sends that happened", async () => {
    used(0, 0);
    await checkSendCap("biz-1", "automated");
    const where = count.mock.calls[0][0].where;
    expect(where.lead).toEqual({ businessId: "biz-1" });
    expect(where.automated).toBe(true);
    // sentAt, not scheduledAt: a queued follow-up that never went out must
    // not consume a day's allowance.
    expect(where.sentAt.gte).toBeInstanceOf(Date);
  });

  // A calendar-day reset would let a batch run twice in a few hours —
  // 11pm and again at midnight.
  it("uses a rolling 24 hours, not a calendar day", async () => {
    used(0, 0);
    const before = Date.now();
    await checkSendCap("biz-1", "automated");
    const since = count.mock.calls[0][0].where.sentAt.gte as Date;
    const hours = (before - since.getTime()) / (60 * 60 * 1000);
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });
});

/**
 * B-006 (research/audit/backend-backlog.md): a plain count()-then-compare
 * let several concurrent callers (the automation loop's own
 * mapWithConcurrency(3)) all read the same pre-send count and all pass,
 * before any of their eventual FollowUp rows existed to stop the next one.
 * These tests can't reproduce the race itself under mocks — nothing
 * actually runs concurrently here — but they pin the observable contract
 * that closes it: one $transaction per check, the lock acquired before any
 * count, and a reservation recorded inside that same transaction on the
 * allowed path only, exactly like rateLimit.ts's checkAndRecordHit.
 */
describe("the atomic check-and-reserve", () => {
  it("runs the lock, the counts and the reservation inside one transaction", async () => {
    used(0, 0);
    await checkSendCap("biz-1", "automated");
    expect(transaction).toHaveBeenCalledTimes(1);
    const lockOrder = executeRaw.mock.invocationCallOrder[0];
    const countOrder = count.mock.invocationCallOrder[0];
    const createOrder = create.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(countOrder);
    expect(countOrder).toBeLessThan(createOrder);
  });

  it("counts an in-flight reservation from a concurrent caller against the same cap", async () => {
    // Simulates the exact race: 249 real sends already landed, and one
    // concurrent call already reserved a slot (not yet a real FollowUp
    // row) before this one acquired the lock.
    used(DAILY_AUTOMATED_SEND_CAP - 1, 0, /* reservedAutomated */ 1);
    const v = await checkSendCap("biz-1", "automated");
    expect(v.allowed).toBe(false);
    expect(v.used).toBe(DAILY_AUTOMATED_SEND_CAP);
  });

  it("reserves a slot on the allowed path so the very next concurrent caller sees it", async () => {
    used(0, 0);
    await checkSendCap("biz-1", "automated");
    expect(create).toHaveBeenCalledWith({ data: { businessId: "biz-1", action: "sendcap:automated" } });
  });

  it("never reserves a slot on the blocked path — a refused check never reaches the provider", async () => {
    used(DAILY_AUTOMATED_SEND_CAP, 0);
    await checkSendCap("biz-1", "automated");
    expect(create).not.toHaveBeenCalled();
  });

  it("a reactivation reservation counts toward both the reactivation and the overall automated pool", async () => {
    used(0, 0);
    await checkSendCap("biz-1", "reactivation");
    expect(create).toHaveBeenCalledWith({ data: { businessId: "biz-1", action: "sendcap:automated" } });
    expect(create).toHaveBeenCalledWith({ data: { businessId: "biz-1", action: "sendcap:reactivation" } });
  });

  it("a plain automated reservation does NOT count toward the reactivation-only pool", async () => {
    used(0, 0);
    await checkSendCap("biz-1", "automated");
    expect(create).not.toHaveBeenCalledWith({ data: { businessId: "biz-1", action: "sendcap:reactivation" } });
  });
});
