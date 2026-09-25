/**
 * The beta plan (founder, 2026-09-19: "Beta testers get Pro, free").
 * Pins the three guarantees that make it safe to hand out:
 *  1. a "beta" status counts as full access everywhere hasActiveAccess is asked;
 *  2. it is granted to any business with no real Stripe subscription, and
 *     revoked only from a business that is on it — a paying customer's
 *     Stripe state is never touched in either direction;
 *  3. by email, a tester with no business yet is a no-op (sign-in grants later).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Explicitly typed so `mock.calls` stays inspectable — an untyped vi.fn()
// infers it as an empty tuple, which tsc rejects on indexing.
type BusinessUpdateMany = (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<{ count: number }>;
const { updateMany, userFindUnique } = vi.hoisted(() => ({
  updateMany: vi.fn<BusinessUpdateMany>(async () => ({ count: 1 })),
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

  // The condition is "nobody is paying", not "the status column is empty".
  // Keying it on subscriptionStatus left three real businesses on Free —
  // the founder's own among them — carrying a stale "active" with no
  // Stripe subscription behind it, and Free does not cover Instagram. The
  // first real Instagram DM was captured and then silently left unscored,
  // undrafted and unanswered (2026-09-19).
  it("is granted to any business with no real Stripe subscription, whatever the status column says", async () => {
    await grantBetaPlan("biz1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "biz1", stripeSubscriptionId: null },
      // holdAllForApproval: a tester gets Pro's reach and none of its
      // unreviewed sending (founder, 2026-09-19).
      data: { subscriptionStatus: "beta", tier: "pro", holdAllForApproval: true },
    });
  });

  it("never touches a business that is actually paying", async () => {
    // updateMany matches nothing when a stripeSubscriptionId is present,
    // which is the whole guarantee — expressed here as the count Prisma
    // would return for a non-matching where clause.
    updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await grantBetaPlan("paying-biz")).toBe(false);
    expect(updateMany.mock.calls[0][0].where).toHaveProperty("stripeSubscriptionId", null);
  });

  it("is revoked only from a business that is on it", async () => {
    await revokeBetaPlan("biz1");
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "biz1", subscriptionStatus: "beta" },
      data: { subscriptionStatus: null, tier: "free" },
    });
  });

  // 2026-09-25: revoking used to write holdAllForApproval: false, so
  // removing someone from the tester list switched their account to
  // sending on its own. Free does not stop the instant reply (it is gated
  // by the monthly AI allowance, not the tier), so that was a live path to
  // an unapproved message. A plan change is not the owner's decision.
  it("never touches the approval hold", async () => {
    await revokeBetaPlan("biz1");
    expect(updateMany.mock.calls[0][0].data).not.toHaveProperty("holdAllForApproval");
  });

  it("by email: grants the tester's business, and does nothing for a tester who hasn't signed in yet", async () => {
    userFindUnique.mockResolvedValueOnce({ businessId: "biz9" });
    await setBetaPlanForEmail("Owner@Example.com", true);
    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" }, select: { businessId: true } });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "biz9", stripeSubscriptionId: null } }));

    updateMany.mockClear();
    userFindUnique.mockResolvedValueOnce(null);
    await setBetaPlanForEmail("nobody@example.com", true);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
