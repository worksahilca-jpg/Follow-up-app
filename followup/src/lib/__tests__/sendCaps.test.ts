/**
 * The daily ceiling on automated sending, which did not exist at all.
 *
 * The hourly automation queried every eligible lead with no `take`, and the
 * reactivation batch worked through a whole back catalogue, resuming across
 * invocations until it ran out of people. On a first sync that is several
 * hundred messages out of one small business's own Gmail in an afternoon.
 *
 * Two things break there, and the worse one isn't ours: crossing a
 * provider's per-day recipient limit doesn't just fail FollowUp's send, it
 * makes the provider start refusing the OWNER'S OWN mail for the rest of
 * the day. We would have broken the thing they run their business on, to
 * deliver follow-ups nobody asked us to send that fast.
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

  it("explains itself in words an owner can act on", async () => {
    used(DAILY_AUTOMATED_SEND_CAP, 0);
    const v = await checkSendCap("biz-1", "automated");
    // Not "rate limit exceeded". It has to say what happened, why, and
    // what they can still do.
    expect(v.reason).toMatch(/paused until tomorrow/i);
    expect(v.reason).toMatch(/rate-limited/i);
    expect(v.reason).toMatch(/you can still send anything yourself/i);
  });

  // The campaign-shaped send gets the tighter number, because it is the
  // one that looks like a campaign from the outside.
  it("caps the reactivation batch well below the general cap", async () => {
    expect(DAILY_REACTIVATION_SEND_CAP).toBeLessThan(DAILY_AUTOMATED_SEND_CAP);

    used(DAILY_REACTIVATION_SEND_CAP, DAILY_REACTIVATION_SEND_CAP);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(false);
    expect(v.cap).toBe(DAILY_REACTIVATION_SEND_CAP);
    expect(v.reason).toMatch(/go out tomorrow/i);
  });

  // A back catalogue spread over days is the entire point — it is what a
  // person doing this by hand looks like, and it is slow enough that the
  // owner sees the first replies before the last messages leave.
  it("lets a reactivation batch continue while it is under its own cap", async () => {
    used(DAILY_REACTIVATION_SEND_CAP - 1, DAILY_REACTIVATION_SEND_CAP - 1);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(true);
  });

  // Reactivation counts INSIDE the general cap, not on top of it, so a big
  // batch can't push the total past what the mailbox will take.
  it("still blocks a reactivation send once the overall cap is reached", async () => {
    used(DAILY_AUTOMATED_SEND_CAP, 2);
    const v = await checkSendCap("biz-1", "reactivation");
    expect(v.allowed).toBe(false);
    expect(v.cap).toBe(DAILY_AUTOMATED_SEND_CAP);
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
