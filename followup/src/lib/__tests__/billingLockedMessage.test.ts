/**
 * What a locked-out business is told, and why it has to depend on the reason.
 *
 * Every gated route used to return one constant — "Start your free 14-day
 * trial" — whatever had actually happened. So a paying customer whose card was
 * declined got told to start a trial when they tried to send a follow-up,
 * invite a teammate, or run automation. They were already a customer. The one
 * screen that told them the truth was the Billing tab, which is the one screen
 * they had no reason to open, because every other screen was telling them they
 * had simply never subscribed.
 *
 * Found by a real-user audit on 2026-09-15 across ~40 call sites.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: vi.fn() } } }));

import { prisma } from "@/lib/db";
import { billingLockedMessage, BILLING_LOCKED_MESSAGE } from "@/lib/billing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => vi.clearAllMocks());

function withStatus(subscriptionStatus: string | null) {
  p.business.findUnique.mockResolvedValue({ subscriptionStatus });
}

describe("billingLockedMessage", () => {
  it("tells a customer with a failed payment to fix their card, not to start a trial", async () => {
    for (const status of ["past_due", "unpaid"]) {
      withStatus(status);
      const msg = await billingLockedMessage("biz1");
      expect(msg).toMatch(/payment/i);
      expect(msg).toMatch(/card/i);
      // The specific regression: an existing customer being sold a trial.
      expect(msg).not.toMatch(/trial/i);
    }
  });

  it("tells a cancelled customer they cancelled", async () => {
    withStatus("canceled");
    const msg = await billingLockedMessage("biz1");
    expect(msg).toMatch(/cancelled/i);
    expect(msg).not.toMatch(/trial/i);
  });

  it("tells someone who abandoned checkout to finish it", async () => {
    for (const status of ["incomplete", "incomplete_expired"]) {
      withStatus(status);
      expect(await billingLockedMessage("biz1")).toMatch(/checkout/i);
    }
  });

  it("tells a paused subscriber to resume", async () => {
    withStatus("paused");
    expect(await billingLockedMessage("biz1")).toMatch(/paused/i);
  });

  it("still offers the trial to someone who has genuinely never subscribed", async () => {
    // The original message is correct for the common case — this fix narrows
    // where it applies, it doesn't remove it.
    withStatus(null);
    expect(await billingLockedMessage("biz1")).toBe(BILLING_LOCKED_MESSAGE);
    withStatus("something_stripe_added_later");
    expect(await billingLockedMessage("biz1")).toBe(BILLING_LOCKED_MESSAGE);
  });

  it("falls back to the generic message instead of throwing when the lookup fails", async () => {
    // The gate has already decided to refuse. A database hiccup here must not
    // turn a clean 402 into a 500.
    p.business.findUnique.mockRejectedValue(new Error("connection lost"));
    await expect(billingLockedMessage("biz1")).resolves.toBe(BILLING_LOCKED_MESSAGE);
  });
});
