/**
 * The weekly digest goes out at most once per admin per week
 * (daily-path bug hunt 2026-09-25, F11).
 *
 * Vercel can invoke the same scheduled run more than once and asks for
 * idempotent jobs. /api/cron/weekly-digest kept no record of having sent,
 * so a repeat delivery emailed every admin a second copy. It now claims
 * each (admin, week) through the same atomic check-and-record the rate
 * limits use (src/lib/rateLimit.ts), before the send.
 *
 * rateLimit.ts runs for real here. Only the database under it is faked:
 * an in-memory RateLimitHit table, and a $transaction that runs one
 * callback at a time — which is what pg_advisory_xact_lock gives two
 * callers on the same key (stricter here, since it serialises every key;
 * nothing below depends on the difference).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Hit = { businessId: string; action: string; createdAt: Date };

const { hits, findMany, sendEmail } = vi.hoisted(() => ({
  hits: [] as Hit[],
  findMany: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: async () => 0,
    rateLimitHit: {
      count: async ({ where }: { where: { businessId: string; action: string; createdAt: { gte: Date } } }) =>
        hits.filter((h) => h.businessId === where.businessId && h.action === where.action && h.createdAt >= where.createdAt.gte).length,
      create: async ({ data }: { data: { businessId: string; action: string } }) => {
        hits.push({ ...data, createdAt: new Date() });
        return {};
      },
    },
  };
  let queue: Promise<unknown> = Promise.resolve();
  return {
    prisma: {
      business: { findMany },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => {
        const run = queue.then(() => fn(tx));
        queue = run.catch(() => undefined);
        return run;
      },
    },
  };
});
vi.mock("@/lib/cronAuth", () => ({ requireCronSecret: vi.fn(() => null) }));
vi.mock("@/lib/integrations/gmail", () => ({ sendEmail }));
vi.mock("@/lib/weeklyDigest", () => ({
  gatherWeeklyDigest: vi.fn(async () => ({})),
  renderWeeklyDigest: vi.fn(() => ({ subject: "FollowUp this week", text: "digest", html: "<p>digest</p>" })),
}));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { GET } from "@/app/api/cron/weekly-digest/route";

function business(id: string, admins: Array<{ id: string; email: string }>) {
  return { id, name: `Business ${id}`, subscriptionStatus: "active", tier: "plus", users: admins };
}
const owner = { id: "user-owner", email: "owner@acme.com" };
const partner = { id: "user-partner", email: "partner@acme.com" };

const cronDelivery = async () =>
  (await GET(new Request("https://followupbase.io/api/cron/weekly-digest") as unknown as Parameters<typeof GET>[0])).json();

/** Monday 21 September 2026, 13:00 UTC — the scheduled run (vercel.json: "0 13 * * 1"). */
const MONDAY = new Date("2026-09-21T13:00:00Z");
const at = (d: Date) => vi.setSystemTime(d);
const later = (ms: number) => new Date(MONDAY.getTime() + ms);
const MIN = 60_000;
const DAY = 86_400_000;

beforeEach(() => {
  vi.clearAllMocks();
  hits.length = 0;
  vi.useFakeTimers({ toFake: ["Date"] });
  at(MONDAY);
  sendEmail.mockResolvedValue({ success: true });
  findMany.mockResolvedValue([business("biz1", [owner])]);
});
afterEach(() => vi.useRealTimers());

describe("the weekly digest, delivered twice", () => {
  it("emails nobody twice when Vercel repeats the same Monday's run", async () => {
    expect(await cronDelivery()).toMatchObject({ sent: 1, alreadySent: 0 });
    at(later(2 * MIN));
    expect(await cronDelivery()).toMatchObject({ sent: 0, alreadySent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends one digest when two deliveries arrive together", async () => {
    await Promise.all([cronDelivery(), cronDelivery()]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("treats any later moment of the same week as the same digest", async () => {
    await cronDelivery();
    at(new Date("2026-09-27T23:59:00Z")); // the Sunday that ends it
    await cronDelivery();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  // The week is in the claim's key. A rolling seven-day window alone would
  // block a run that fires a second early next Monday — and that week's
  // digest would simply never arrive.
  it("still sends next Monday's digest, even if that run fires a moment early", async () => {
    await cronDelivery();
    at(later(7 * DAY - 1_000)); // Monday 28 September, 12:59:59
    expect(await cronDelivery()).toMatchObject({ sent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });
});

describe("what one claim covers", () => {
  it("gives every admin their own digest, once each", async () => {
    findMany.mockResolvedValue([business("biz1", [owner, partner])]);
    await cronDelivery();
    await cronDelivery();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls.map((c) => c[1].to).sort()).toEqual(["owner@acme.com", "partner@acme.com"]);
  });

  // A first delivery cut off between two admins must not cost the second
  // one their digest for the week.
  it("lets the repeat delivery send to an admin the first one never reached", async () => {
    findMany.mockResolvedValue([business("biz1", [owner])]);
    await cronDelivery();
    findMany.mockResolvedValue([business("biz1", [owner, partner])]);
    expect(await cronDelivery()).toMatchObject({ sent: 1, alreadySent: 1 });
    expect(sendEmail).toHaveBeenLastCalledWith("biz1", expect.objectContaining({ to: "partner@acme.com" }));
  });

  it("never lets one business's digest stand in for another's", async () => {
    findMany.mockResolvedValue([business("biz1", [owner]), business("biz2", [owner])]);
    expect(await cronDelivery()).toMatchObject({ sent: 2 });
    expect(sendEmail.mock.calls.map((c) => c[0]).sort()).toEqual(["biz1", "biz2"]);
  });

  // At most once is the promise. A Gmail error can arrive after Google
  // accepted the message, and retrying on it would be the duplicate this
  // guard exists to stop — so a failed send is not re-sent by a repeat.
  it("does not re-send on a repeat delivery after a failed send", async () => {
    sendEmail.mockResolvedValueOnce({ success: false, message: "Gmail timed out" });
    expect(await cronDelivery()).toMatchObject({ sent: 0 });
    expect(await cronDelivery()).toMatchObject({ sent: 0, alreadySent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
