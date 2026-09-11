/**
 * task: the Stripe billing webhook needs to (1) never re-apply an event
 * it's already processed — Stripe doesn't guarantee exactly-once or
 * in-order delivery — and (2) derive tier/voiceAddonEnabled from the
 * subscription's actual line items rather than trusting the embedded
 * event payload, re-fetching the live object first.
 * (research/market/2026-09-11-stripe-tier-billing-implementation.md §5)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { eventCreate, businessFindUnique, businessUpdate } = vi.hoisted(() => ({
  eventCreate: vi.fn(async () => ({ eventId: "evt_1" })),
  businessFindUnique: vi.fn(async () => ({ id: "biz1" })),
  businessUpdate: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    processedWebhookEvent: { create: eventCreate },
    business: { findUnique: businessFindUnique, update: businessUpdate },
  },
}));

const { constructEvent, subscriptionsRetrieve } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    webhooks: { constructEvent },
    subscriptions: { retrieve: subscriptionsRetrieve },
  }),
  getTierFromPriceId: (priceId: string | null | undefined) => (priceId === "price_pro" ? "pro" : "plus"),
  VOICE_FLAT_PRICE_ID: "price_voice_flat",
  VOICE_METERED_PRICE_ID: "price_voice_metered",
}));

import { POST } from "@/app/api/billing/webhook/route";

function webhookRequest(rawBody = "{}") {
  return new Request("https://followupbase.io/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: rawBody,
  }) as unknown as Parameters<typeof POST>[0];
}

function subscription(overrides: Partial<{ id: string; status: string; customer: string; items: { id: string; price: { id: string }; current_period_end: number }[] }> = {}) {
  return {
    id: overrides.id ?? "sub_1",
    status: overrides.status ?? "active",
    customer: overrides.customer ?? "cus_1",
    items: { data: overrides.items ?? [{ id: "si_1", price: { id: "price_plus" }, current_period_end: 1700000000 }] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  eventCreate.mockResolvedValue({ eventId: "evt_1" });
  businessFindUnique.mockResolvedValue({ id: "biz1" });
});

describe("POST /api/billing/webhook", () => {
  it("400s without configuring a webhook secret", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(webhookRequest());
    expect(res.status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("400s on an invalid signature", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(webhookRequest());
    expect(res.status).toBe(400);
    expect(eventCreate).not.toHaveBeenCalled();
  });

  it("skips reprocessing a duplicate event id instead of re-applying its side effects", async () => {
    constructEvent.mockReturnValue({ id: "evt_1", type: "customer.subscription.updated", data: { object: subscription() } });
    eventCreate.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

    const res = await POST(webhookRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ received: true, duplicate: true });
    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("re-fetches the live subscription on customer.subscription.updated instead of trusting the event payload", async () => {
    const staleFromEvent = subscription({ status: "past_due" });
    const liveFromApi = subscription({ status: "active" });
    constructEvent.mockReturnValue({ id: "evt_2", type: "customer.subscription.updated", data: { object: staleFromEvent } });
    subscriptionsRetrieve.mockResolvedValue(liveFromApi);

    await POST(webhookRequest());

    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_1");
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "active" }) })
    );
  });

  it("does NOT re-fetch on customer.subscription.deleted — the event payload is the only terminal state available", async () => {
    const deleted = subscription({ status: "canceled" });
    constructEvent.mockReturnValue({ id: "evt_3", type: "customer.subscription.deleted", data: { object: deleted } });

    await POST(webhookRequest());

    expect(subscriptionsRetrieve).not.toHaveBeenCalled();
    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subscriptionStatus: "canceled" }) })
    );
  });

  it("derives tier from whichever item isn't a Voice price, and voiceAddonEnabled from whether the Voice flat item is present", async () => {
    const withVoice = subscription({
      items: [
        { id: "si_1", price: { id: "price_pro" }, current_period_end: 1700000000 },
        { id: "si_2", price: { id: "price_voice_flat" }, current_period_end: 1700000000 },
        { id: "si_3", price: { id: "price_voice_metered" }, current_period_end: 1700000000 },
      ],
    });
    constructEvent.mockReturnValue({ id: "evt_4", type: "customer.subscription.updated", data: { object: withVoice } });
    subscriptionsRetrieve.mockResolvedValue(withVoice);

    await POST(webhookRequest());

    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tier: "pro", voiceAddonEnabled: true }) })
    );
  });

  it("reports voiceAddonEnabled: false once Voice's items are removed from the subscription", async () => {
    const withoutVoice = subscription({ items: [{ id: "si_1", price: { id: "price_plus" }, current_period_end: 1700000000 }] });
    constructEvent.mockReturnValue({ id: "evt_5", type: "customer.subscription.updated", data: { object: withoutVoice } });
    subscriptionsRetrieve.mockResolvedValue(withoutVoice);

    await POST(webhookRequest());

    expect(businessUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tier: "plus", voiceAddonEnabled: false }) })
    );
  });

  it("re-fetches the subscription on checkout.session.completed and syncs it", async () => {
    const session = { client_reference_id: "biz1", subscription: "sub_1" };
    constructEvent.mockReturnValue({ id: "evt_6", type: "checkout.session.completed", data: { object: session } });
    subscriptionsRetrieve.mockResolvedValue(subscription());

    await POST(webhookRequest());

    expect(subscriptionsRetrieve).toHaveBeenCalledWith("sub_1");
    expect(businessUpdate).toHaveBeenCalledWith({ where: { id: "biz1" }, data: expect.any(Object) });
  });

  it("logs but does not throw on invoice.payment_failed", async () => {
    constructEvent.mockReturnValue({ id: "evt_7", type: "invoice.payment_failed", data: { object: { id: "in_1", customer: "cus_1" } } });

    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("ignores an unrecognized event type without erroring", async () => {
    constructEvent.mockReturnValue({ id: "evt_8", type: "some.future.event", data: { object: {} } });
    const res = await POST(webhookRequest());
    expect(res.status).toBe(200);
  });
});
