/**
 * Cancelling used to be a one-way door.
 *
 * Business.tier was only ever written from a LIVE subscription's price ID
 * (syncSubscription in src/app/api/billing/webhook/route.ts), so a
 * cancelled Plus/Pro business kept tier "plus"/"pro" forever. hasActiveAccess()
 * grants access without a subscription only to tier "free", so that business
 * was locked out of everything — including the Free plan it plainly
 * qualified for, and which a business that had never subscribed at all gets
 * for nothing. And nothing could ever fix it: Stripe has no further events
 * to send about a dead subscription.
 *
 * So a terminal subscription status resets the plan to Free. What must NOT
 * change is the grandfathering the tier field exists for (getTierFromPriceId
 * in @/lib/stripe): an unrecognized/legacy price ID on a LIVE subscription
 * still resolves to Plus, for as long as that subscription is alive.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { eventCreate, eventDelete, businessFindUnique, businessUpdate } = vi.hoisted(() => ({
  eventCreate: vi.fn(async () => ({ eventId: "evt_1" })),
  eventDelete: vi.fn(async () => ({ eventId: "evt_1" })),
  businessFindUnique: vi.fn(async () => ({ id: "biz1" })),
  // Explicitly typed so its recorded call arguments stay inspectable — an
  // untyped vi.fn() infers `mock.calls` as an empty tuple.
  businessUpdate: vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
    void args;
    return {};
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    processedWebhookEvent: { create: eventCreate, delete: eventDelete },
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
  // The real mapping's shape: only the Pro price is recognized, and
  // everything else — including a legacy price ID — falls back to Plus.
  getTierFromPriceId: (priceId: string | null | undefined) => (priceId === "price_pro" ? "pro" : "plus"),
  VOICE_FLAT_PRICE_ID: "price_voice_flat",
  VOICE_METERED_PRICE_ID: "price_voice_metered",
}));

import { POST } from "@/app/api/billing/webhook/route";
import { hasActiveAccess } from "@/lib/billing";

function webhookRequest(rawBody = "{}") {
  return new Request("https://followupbase.io/api/billing/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: rawBody,
  }) as unknown as Parameters<typeof POST>[0];
}

type Item = { id: string; price: { id: string }; current_period_end: number };
function subscription(status: string, items?: Item[]) {
  return {
    id: "sub_1",
    status,
    customer: "cus_1",
    items: { data: items ?? [{ id: "si_1", price: { id: "price_pro" }, current_period_end: 1700000000 }] },
  };
}

/** The `data` of the single business.update the handler performed. */
function written() {
  const call = businessUpdate.mock.calls.at(-1);
  if (!call) throw new Error("the webhook never wrote to the business");
  return call[0];
}

async function deliver(type: string, sub: ReturnType<typeof subscription>) {
  constructEvent.mockReturnValue({ id: `evt_${Math.random()}`, type, data: { object: sub } });
  subscriptionsRetrieve.mockResolvedValue(sub);
  return POST(webhookRequest());
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  eventCreate.mockResolvedValue({ eventId: "evt_1" });
  businessFindUnique.mockResolvedValue({ id: "biz1" });
});

describe("a cancelled subscription falls back to Free", () => {
  it("resets tier to free on customer.subscription.deleted", async () => {
    await deliver("customer.subscription.deleted", subscription("canceled"));

    expect(written().data.subscriptionStatus).toBe("canceled");
    expect(written().data.tier).toBe("free");
  });

  it("resets tier to free when an update arrives with a canceled status", async () => {
    await deliver("customer.subscription.updated", subscription("canceled"));

    expect(written().data.tier).toBe("free");
  });

  it("resets tier to free when checkout was never completed and the subscription expired", async () => {
    await deliver("customer.subscription.updated", subscription("incomplete_expired"));

    expect(written().data.tier).toBe("free");
  });

  it("leaves the business with real Free-tier access rather than a lockout", async () => {
    await deliver("customer.subscription.deleted", subscription("canceled"));
    const { subscriptionStatus, tier } = written().data as { subscriptionStatus: string; tier: string };

    // The whole point: this is the same answer a never-subscribed
    // business gets, not the lockout a stale "pro" produced.
    expect(hasActiveAccess(subscriptionStatus, tier)).toBe(true);
  });

  it("drops the Voice add-on and switches the live voice agent off, so a cancelled account can't keep spending on calls", async () => {
    const withVoice = subscription("canceled", [
      { id: "si_1", price: { id: "price_pro" }, current_period_end: 1700000000 },
      { id: "si_2", price: { id: "price_voice_flat" }, current_period_end: 1700000000 },
    ]);
    await deliver("customer.subscription.deleted", withVoice);

    expect(written().data.voiceAddonEnabled).toBe(false);
    expect(written().data.voiceAgentEnabled).toBe(false);
  });
});

describe("what cancellation must NOT change", () => {
  it("keeps a live legacy-price subscriber grandfathered onto Plus", async () => {
    const legacy = subscription("active", [{ id: "si_1", price: { id: "price_legacy_29" }, current_period_end: 1700000000 }]);
    await deliver("customer.subscription.updated", legacy);

    expect(written().data.tier).toBe("plus");
  });

  it("keeps a trialing subscriber on their paid tier", async () => {
    await deliver("customer.subscription.updated", subscription("trialing"));

    expect(written().data.tier).toBe("pro");
    expect(written().data).not.toHaveProperty("voiceAgentEnabled");
  });

  it("keeps a past_due subscriber on their paid tier — dunning is not cancellation", async () => {
    await deliver("customer.subscription.updated", subscription("past_due"));

    // Stripe is still retrying the card; the subscription still exists, so
    // the business keeps the plan it's in the middle of paying for (access
    // stays paused via hasActiveAccess until it recovers). Dropping them to
    // Free here would quietly downgrade a customer mid-dunning.
    expect(written().data.tier).toBe("pro");
    expect(hasActiveAccess("past_due", "pro")).toBe(false);
  });

  it("keeps the voice agent switch untouched for any non-terminal status", async () => {
    await deliver("customer.subscription.updated", subscription("past_due"));

    expect(written().data).not.toHaveProperty("voiceAgentEnabled");
  });
});
