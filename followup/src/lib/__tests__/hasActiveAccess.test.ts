/**
 * task: hasActiveAccess()/requireActiveBilling() were tier-blind, so a
 * genuine Free-tier business (no Stripe subscription at all, by design —
 * see checkout/route.ts) read identically to canceled/past_due: fully
 * locked out of every one of requireActiveBilling's ~45 call sites,
 * including every lead-capture route. This covers the fix: a Business.tier
 * of "free" now counts as access on its own, without breaking the existing
 * subscription-only behavior for call sites that don't pass tier.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique } } }));

import { hasActiveAccess, requireActiveBilling } from "@/lib/billing";

describe("hasActiveAccess", () => {
  it("grants access on tier 'free', even with no subscription at all", () => {
    expect(hasActiveAccess(null, "free")).toBe(true);
    expect(hasActiveAccess(undefined, "free")).toBe(true);
  });

  it("still grants access on an active/trialing subscription regardless of tier", () => {
    expect(hasActiveAccess("active", "plus")).toBe(true);
    expect(hasActiveAccess("trialing", "pro")).toBe(true);
  });

  it("does NOT grant access to a canceled/past_due Plus or Pro business — the free-tier bypass never applies once a business has actually subscribed", () => {
    // tier stays stale at "plus"/"pro" after cancellation (billing/webhook's
    // syncSubscription never resets it to "free" — see hasActiveAccess's own
    // comment), so this is the realistic shape of a lapsed subscriber.
    expect(hasActiveAccess("canceled", "plus")).toBe(false);
    expect(hasActiveAccess("past_due", "pro")).toBe(false);
  });

  it("denies access with no subscription and no tier passed at all — the pre-fix, subscription-only call sites keep their exact old behavior", () => {
    expect(hasActiveAccess(null)).toBe(false);
    expect(hasActiveAccess(undefined)).toBe(false);
  });
});

describe("requireActiveBilling", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true for a genuine Free-tier business — the core bug this fixes", async () => {
    findUnique.mockResolvedValue({ subscriptionStatus: null, tier: "free" });
    expect(await requireActiveBilling("biz1")).toBe(true);
  });

  it("returns true for an active Plus/Pro subscription", async () => {
    findUnique.mockResolvedValue({ subscriptionStatus: "active", tier: "pro" });
    expect(await requireActiveBilling("biz1")).toBe(true);
  });

  it("returns false for a canceled Plus subscription — stays locked out, not silently downgraded to Free access", async () => {
    findUnique.mockResolvedValue({ subscriptionStatus: "canceled", tier: "plus" });
    expect(await requireActiveBilling("biz1")).toBe(false);
  });

  it("returns false when the business can't be found at all", async () => {
    findUnique.mockResolvedValue(null);
    expect(await requireActiveBilling("biz1")).toBe(false);
  });
});
