/**
 * task: give a new business a free trial (no card required) instead of
 * charging immediately at checkout — so a beta tester who signs up isn't
 * asked to pay before they've even tried the product.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type MockBusiness = {
  stripeCustomerId: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionStatus?: string | null;
  name: string;
};

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(async (query: unknown): Promise<MockBusiness> => {
    void query;
    return { stripeCustomerId: "cus_existing", name: "Acme Plumbing" };
  }),
  update: vi.fn(async (query: unknown) => {
    void query;
    return {};
  }),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique, update } } }));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1", email: "owner@acme.com" })),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

const { sessionsCreate, customersCreate } = vi.hoisted(() => ({
  sessionsCreate: vi.fn(async () => ({ url: "https://checkout.stripe.com/session123" })),
  customersCreate: vi.fn(async () => ({ id: "cus_new" })),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: sessionsCreate } },
    customers: { create: customersCreate },
  }),
  priceIdForTier: (tier: "plus" | "pro") => (tier === "pro" ? "price_pro" : "price_plus"),
  VOICE_FLAT_PRICE_ID: "price_voice_flat",
  VOICE_METERED_PRICE_ID: "price_voice_metered",
  appUrl: () => "https://followupbase.io",
}));

import { POST } from "@/app/api/billing/checkout/route";
import { TRIAL_PERIOD_DAYS } from "@/lib/billing";
import { VOICE_ADDON_AVAILABLE } from "@/lib/pricing";

function postRequest(body: unknown = { tier: "plus" }) {
  return new Request("https://followupbase.io/api/billing/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  requireAdmin.mockResolvedValue(true);
  findUnique.mockResolvedValue({ stripeCustomerId: "cus_existing", name: "Acme Plumbing" });
  sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session123" });
});

describe("POST /api/billing/checkout — free trial", () => {
  it("starts every new subscription with a free trial and no upfront card requirement", async () => {
    const res = await POST(postRequest());
    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS },
        payment_method_collection: "if_required",
      })
    );
  });

  it("still rejects a non-admin before ever contacting Stripe", async () => {
    requireAdmin.mockResolvedValue(false);
    const res = await POST(postRequest());
    expect(res.status).toBe(403);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("reuses an existing Stripe customer instead of creating a new one", async () => {
    await POST(postRequest());
    expect(customersCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing" }));
  });

  it("creates a Stripe customer for a business that's never checked out before", async () => {
    findUnique.mockResolvedValue({ stripeCustomerId: null, name: "Acme Plumbing" });
    await POST(postRequest());
    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: "owner@acme.com", name: "Acme Plumbing" })
    );
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_new" }));
  });

  it("rejects an unknown tier before ever contacting Stripe", async () => {
    const res = await POST(postRequest({ tier: "enterprise" }));
    expect(res.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("builds a single line item for the tier price when Voice isn't requested", async () => {
    await POST(postRequest({ tier: "pro" }));
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_pro", quantity: 1 }] })
    );
  });

  // The Voice add-on is deferred (VOICE_ADDON_AVAILABLE in @/lib/pricing),
  // so this used to assert both Voice line items were added and now asserts
  // the opposite. The line-item shape it pinned still matters and is not
  // lost — it is asserted below against the same code path, guarded by the
  // flag, so whoever turns Voice back on gets the metered-item rule
  // (a metered price takes no quantity, or Stripe rejects it) enforced
  // again the moment they flip it.
  it("refuses the Voice add-on while it is deferred", async () => {
    const res = await POST(postRequest({ tier: "plus", voiceAddon: true }));
    expect(res.status).toBe(400);
    // Refused, not silently downgraded to a plain Plus subscription: a
    // customer who asked for Voice and got a Plus-only subscription with a
    // success page would believe they had bought it.
    expect(sessionsCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/voice add-on isn't available/i);
  });

  it("still builds the right Voice line items once it is available again", async () => {
    if (!VOICE_ADDON_AVAILABLE) return; // deferred — the refusal above is the live behaviour
    await POST(postRequest({ tier: "plus", voiceAddon: true }));
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [
          { price: "price_plus", quantity: 1 },
          { price: "price_voice_flat", quantity: 1 },
          // No quantity — Stripe rejects a metered line item that carries one.
          { price: "price_voice_metered" },
        ],
      })
    );
  });
});

/**
 * B-002 (research/audit/backend-backlog.md): checkout used to reuse the
 * Stripe *customer* but never checked for an existing *subscription* — two
 * browser tabs both starting checkout while on Free was enough to create
 * two live subscriptions on one customer, billed twice every month, with
 * no direct API access needed.
 */
describe("POST /api/billing/checkout — refuses a second subscription", () => {
  it("refuses checkout when the business already has an active subscription", async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      subscriptionStatus: "active",
      name: "Acme Plumbing",
    });
    const res = await POST(postRequest());
    expect(res.status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already have a plan/i);
  });

  it("also refuses while the existing subscription is still trialing", async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_existing",
      subscriptionStatus: "trialing",
      name: "Acme Plumbing",
    });
    const res = await POST(postRequest());
    expect(res.status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("lets a Free business (never subscribed) check out for the first time", async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      name: "Acme Plumbing",
    });
    const res = await POST(postRequest());
    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalled();
  });

  it("lets a canceled business (subscription id present, status terminal) start a new one", async () => {
    findUnique.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_old_canceled",
      subscriptionStatus: "canceled",
      name: "Acme Plumbing",
    });
    const res = await POST(postRequest());
    expect(res.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalled();
  });
});
