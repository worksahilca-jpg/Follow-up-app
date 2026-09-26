/**
 * The admin "waiting for OK" count (A-036) is the sum of what each owner
 * sees in "Needs your OK", not a re-derivation from the latest audit event,
 * which overcounted drafts answered another way or settled by "We talked".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { auditFindMany, pending } = vi.hoisted(() => ({ auditFindMany: vi.fn(), pending: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { auditEvent: { findMany: auditFindMany } } }));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: pending }));
vi.mock("@/lib/platformAdmin", () => ({ requirePlatformAdmin: vi.fn() }));

import { countWaitingForOk } from "@/lib/admin-usage";

beforeEach(() => vi.clearAllMocks());

describe("countWaitingForOk", () => {
  it("adds up each account's own approvals list", async () => {
    auditFindMany.mockResolvedValue([{ businessId: "a" }, { businessId: "b" }]);
    pending.mockImplementation(async (id: string) => (id === "a" ? [{}, {}] : [{}]));
    expect(await countWaitingForOk()).toBe(3);
    expect(auditFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { action: "ai.hold" }, distinct: ["businessId"] }));
  });

  it("is zero when no account has ever held a draft", async () => {
    auditFindMany.mockResolvedValue([]);
    expect(await countWaitingForOk()).toBe(0);
    expect(pending).not.toHaveBeenCalled();
  });
});
