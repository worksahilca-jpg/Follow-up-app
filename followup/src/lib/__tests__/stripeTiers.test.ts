/**
 * task: derive which paid tier (Plus/Pro) a Stripe Price ID corresponds to,
 * and the inverse — the Price ID for a chosen tier. Pure functions, no
 * Stripe SDK involved, so no mocking needed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("getTierFromPriceId / priceIdForTier", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.STRIPE_PLUS_PRICE_ID = "price_plus_123";
    process.env.STRIPE_PRO_PRICE_ID = "price_pro_456";
  });

  it("recognizes the configured Pro price ID as pro", async () => {
    const { getTierFromPriceId } = await import("@/lib/stripe");
    expect(getTierFromPriceId("price_pro_456")).toBe("pro");
  });

  it("recognizes the configured Plus price ID as plus", async () => {
    const { getTierFromPriceId } = await import("@/lib/stripe");
    expect(getTierFromPriceId("price_plus_123")).toBe("plus");
  });

  it("falls back to plus for any price ID that isn't the Pro price — this is what grandfathers pre-restructure subscribers", async () => {
    const { getTierFromPriceId } = await import("@/lib/stripe");
    expect(getTierFromPriceId("price_legacy_29_flat")).toBe("plus");
  });

  it("falls back to plus for a null/undefined price ID (e.g. a subscription with no items yet)", async () => {
    const { getTierFromPriceId } = await import("@/lib/stripe");
    expect(getTierFromPriceId(null)).toBe("plus");
    expect(getTierFromPriceId(undefined)).toBe("plus");
  });

  it("priceIdForTier is the exact inverse of the recognized cases", async () => {
    const { priceIdForTier } = await import("@/lib/stripe");
    expect(priceIdForTier("plus")).toBe("price_plus_123");
    expect(priceIdForTier("pro")).toBe("price_pro_456");
  });
});
