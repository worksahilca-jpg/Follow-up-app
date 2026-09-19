/**
 * The beta plan (founder, 2026-09-19: "Beta testers get Pro, free").
 * Pins the three guarantees that make it safe to hand out:
 *  1. a "beta" status counts as full access everywhere hasActiveAccess is asked;
 *  2. it is granted only to a business that has never subscribed, and
 *     revoked only from a business that is on it — a paying customer's
 *     Stripe state is never touched in either direction;
 *  3. by email, a tester with no business yet is a no-op (sign-in grants later).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateMany, userFindUnique } = vi.hoisted(() => ({
  updateMany: vi.fn(async () => ({ count: 1 })),
  userFindUnique: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { updateMany }, user: { findUnique: userFindUnique } } }));

import { BETA_SUBSCRIPTION_STATUS, grantBetaPlan, hasActiveAccess, revokeBetaPlan, setBetaPlanForEmail } from "@/lib/billing";

beforeEach(() => vi.clearAllMocks());

describe("the beta plan", () => {
  it("reads as full access, like a paid subscription", () => {
    expect(hasActiveAccess(BETA_SUBSCRIPTION_STATUS, "pro")).toBe(true);
    expect(hasActiveAccess(BETA_SUBSCRIPTION_STATUS)).toBe(true);
    expect(hasActiveAccess(null, "pro")).toBe(false);
  });

  it("is granted only to a business that has never subscribed", async () => {
    await grantBetaPlan("biz1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "biz1", subscriptionStatus: null },
      data: { subscriptionStatus: "beta", tier: "pro" },
    });
  });

  it("is revoked only from a business that is on it", async () => {
    await revokeBetaPlan("biz1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "biz1", subscriptionStatus: "beta" },
      data: { subscriptionStatus: null, tier: "free" },
    });
  });

  it("by email: grants the tester's business, and does nothing for a tester who hasn't signed in yet", async () => {
    userFindUnique.mockResolvedValueOnce({ businessId: "biz9" });
    await setBetaPlanForEmail("Owner@Example.com", true);
    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" }, select: { businessId: true } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "biz9", subscriptionStatus: null } }));

    updateMany.mockClear();
    userFindUnique.mockResolvedValueOnce(null);
    await setBetaPlanForEmail("nobody@example.com", true);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
