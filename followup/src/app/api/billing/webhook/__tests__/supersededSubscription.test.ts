/**
 * Regression: a Stripe event about a SUPERSEDED subscription must not
 * overwrite the live one the business is actually on.
 *
 * Stripe delivers out of order and one customer can hold more than one
 * subscription over time. The realistic sequence:
 *
 *   1. Sub A is set to cancel at period end (it stays `active` until then).
 *   2. The owner changes their mind and resubscribes before that date —
 *      checkout creates sub B, mirrored as trialing/active.
 *   3. Period end arrives; Stripe fires customer.subscription.deleted for
 *      A, i.e. AFTER everything about B.
 *
 * Before the fix, step 3 wrote subscriptionStatus "canceled" over a
 * business that is paying, and nothing ever corrected it — Stripe has no
 * further events to send for A, and B is stable so it sends none for B.
 * Every gated route then 402s, inbound sync stops, and leads stop being
 * captured for a customer with a live subscription.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type BusinessUpdateArgs = { where: { id: string }; data: Record<string, unknown> };

const { businessFindUnique, businessUpdate, processedCreate, processedDelete } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  businessUpdate: vi.fn(async () => ({})),
  processedCreate: vi.fn(async () => ({})),
  processedDelete: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique, update: businessUpdate },
    processedWebhookEvent: { create: processedCreate, delete: processedDelete },
  },
}));

const { constructEvent, retrieveSubscription } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  retrieveSubscription: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: retrieveSubscription },
  }),
  getTierFromPriceId: (priceId: string | null | undefined) => (priceId === "price_pro" ? "pro" : "plus"),
  VOICE_FLAT_PRICE_ID: "price_voice_flat",
  VOICE_METERED_PRICE_ID: "price_voice_metered",
}));

import { POST } from "@/app/api/billing/webhook/route";

/** The single business.update the handler is expected to have made. */
function lastUpdate(): BusinessUpdateArgs {
  const calls = businessUpdate.mock.calls as unknown as BusinessUpdateArgs[][];
  const call = calls.at(-1);
  if (!call) throw new Error("business.update was never called");
  return call[0];
}

function subscription(id: string, status: string) {
  return {
    id,
    status,
    customer: "cus_1",
    items: { data: [{ price: { id: "price_plus" }, current_period_end: 1_800_000_000 }] },
  };
}

function request() {
  return {
    headers: { get: (name: string) => (name === "stripe-signature" ? "sig" : null) },
    text: async () => "{}",
  } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_placeholder");
});

describe("billing webhook — superseded subscriptions", () => {
  it("ignores a late `deleted` event for the old subscription when the business has moved to a new one", async () => {
    const old = subscription("sub_A", "canceled");
    constructEvent.mockReturnValue({ id: "evt_1", type: "customer.subscription.deleted", data: { object: old } });
    // First lookup: business by stripeCustomerId. Second: its current
    // subscription of record, which is already sub_B.
    businessFindUnique
      .mockResolvedValueOnce({ id: "biz1" })
      .mockResolvedValueOnce({ stripeSubscriptionId: "sub_B" });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("still applies a terminal event for the subscription the business is actually on", async () => {
    const current = subscription("sub_B", "canceled");
    constructEvent.mockReturnValue({ id: "evt_2", type: "customer.subscription.deleted", data: { object: current } });
    businessFindUnique
      .mockResolvedValueOnce({ id: "biz1" })
      .mockResolvedValueOnce({ stripeSubscriptionId: "sub_B" });

    await POST(request());

    expect(businessUpdate).toHaveBeenCalledTimes(1);
    expect(lastUpdate().data.subscriptionStatus).toBe("canceled");
  });

  it("lets a genuinely live new subscription take over from the recorded one", async () => {
    const fresh = subscription("sub_B", "trialing");
    constructEvent.mockReturnValue({ id: "evt_3", type: "customer.subscription.updated", data: { object: fresh } });
    retrieveSubscription.mockResolvedValue(fresh);
    businessFindUnique
      .mockResolvedValueOnce({ id: "biz1" })
      .mockResolvedValueOnce({ stripeSubscriptionId: "sub_A" });

    await POST(request());

    expect(businessUpdate).toHaveBeenCalledTimes(1);
    expect(lastUpdate().data.stripeSubscriptionId).toBe("sub_B");
    expect(lastUpdate().data.subscriptionStatus).toBe("trialing");
  });

  it("mirrors the first subscription when the business has none on record yet", async () => {
    const first = subscription("sub_A", "trialing");
    constructEvent.mockReturnValue({ id: "evt_4", type: "customer.subscription.created", data: { object: first } });
    retrieveSubscription.mockResolvedValue(first);
    businessFindUnique
      .mockResolvedValueOnce({ id: "biz1" })
      .mockResolvedValueOnce({ stripeSubscriptionId: null });

    await POST(request());

    expect(businessUpdate).toHaveBeenCalledTimes(1);
    expect(lastUpdate().data.stripeSubscriptionId).toBe("sub_A");
  });

  it("looks the business up by customer id without decrypting its stored secrets", async () => {
    const fresh = subscription("sub_A", "active");
    constructEvent.mockReturnValue({ id: "evt_5", type: "customer.subscription.updated", data: { object: fresh } });
    retrieveSubscription.mockResolvedValue(fresh);
    businessFindUnique
      .mockResolvedValueOnce({ id: "biz1" })
      .mockResolvedValueOnce({ stripeSubscriptionId: "sub_A" });

    await POST(request());

    expect(businessFindUnique.mock.calls[0]?.[0]).toEqual({
      where: { stripeCustomerId: "cus_1" },
      select: { id: true },
    });
  });
});
