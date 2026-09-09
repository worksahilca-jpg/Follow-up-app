/**
 * task (fourth-pass audit, finding #2): the original tooManyRecentLeads/
 * tooManyRecentActions were a plain count() read followed, several awaits
 * later in the CALLER, by whatever row would make the count go up — no
 * transaction, no lock, so a concurrent flood could have every request
 * read the same pre-flood count and all pass. The fix moves the count and
 * the hit-record into one function, inside a single $transaction (guarded
 * by a Postgres advisory lock) — this can't prove the race is gone under
 * mocks (nothing actually races here), but it locks in the observable
 * contract that makes that true: one $transaction call per check, the
 * lock acquired before the count, and the hit always recorded inside the
 * same transaction as the count, not by the caller afterward.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { executeRaw, count, create } = vi.hoisted(() => ({
  executeRaw: vi.fn(async () => 0),
  count: vi.fn(async () => 0),
  create: vi.fn(async () => ({})),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ $executeRaw: executeRaw, rateLimitHit: { count, create } })
    ),
  },
}));

import { prisma } from "@/lib/db";
import { tooManyRecentLeads, tooManyRecentActions } from "@/lib/rateLimit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transaction = (prisma as any).$transaction as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(0);
});

describe("tooManyRecentLeads / tooManyRecentActions — atomic check-and-record", () => {
  it("does the count and the hit-record inside one transaction, lock first", async () => {
    await tooManyRecentLeads("biz1", "Website form", { windowMinutes: 10, max: 20 });
    expect(transaction).toHaveBeenCalledTimes(1);
    // Lock acquired before the count is read — otherwise a concurrent
    // caller could still slip in between them.
    const lockOrder = executeRaw.mock.invocationCallOrder[0];
    const countOrder = count.mock.invocationCallOrder[0];
    const createOrder = create.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(countOrder);
    expect(countOrder).toBeLessThan(createOrder);
  });

  it("returns false and still records the hit when under the limit", async () => {
    count.mockResolvedValue(5);
    const result = await tooManyRecentLeads("biz1", "Webhook", { windowMinutes: 10, max: 100 });
    expect(result).toBe(false);
    expect(create).toHaveBeenCalledWith({ data: { businessId: "biz1", action: "lead:Webhook" } });
  });

  it("returns true and still records the hit when at/over the limit", async () => {
    count.mockResolvedValue(20);
    const result = await tooManyRecentLeads("biz1", "Website form", { windowMinutes: 10, max: 20 });
    expect(result).toBe(true);
    expect(create).toHaveBeenCalledTimes(1); // recorded even though over limit
  });

  it("namespaces lead-intake hits separately from tooManyRecentActions' own action keys", async () => {
    await tooManyRecentLeads("biz1", "Website form", { windowMinutes: 10, max: 20 });
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ action: "lead:Website form" }) }));

    await tooManyRecentActions("biz1", "leads.send", { windowMinutes: 10, max: 60 });
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ action: "leads.send" }) }));
  });

  it("scopes the count to the calling business", async () => {
    await tooManyRecentActions("biz2", "gmail-sync", { windowMinutes: 10, max: 5 });
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "biz2" }) }));
    expect(create).toHaveBeenCalledWith({ data: { businessId: "biz2", action: "gmail-sync" } });
  });
});
