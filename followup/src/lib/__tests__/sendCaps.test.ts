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

const count = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { followUp: { count: (...a: unknown[]) => count(...a) } } }));

import {
  checkSendCap,
  DAILY_AUTOMATED_SEND_CAP,
  DAILY_REACTIVATION_SEND_CAP,
} from "@/lib/sendCaps";

/** First call counts all automated sends; second counts reactivation only. */
function used(automated: number, reactivation: number) {
  count.mockResolvedValueOnce(automated).mockResolvedValueOnce(reactivation);
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

    used(300, 300);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(true);
  });

  // Well above any real day. A 200-lead back catalogue — the largest
  // legitimate burst this product has — must clear in one go.
  it("lets a whole back catalogue through in one sitting", async () => {
    used(200, 200);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(true);
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
    expect(DAILY_AUTOMATED_SEND_CAP).toBeGreaterThan(200);
    expect(DAILY_AUTOMATED_SEND_CAP).toBeLessThan(2000);
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
