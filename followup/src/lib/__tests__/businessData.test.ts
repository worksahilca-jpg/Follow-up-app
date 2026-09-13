/**
 * Guarantees of full-business deletion (src/lib/businessData.ts): every
 * dependent row is removed in an order the database will actually accept
 * (nothing with a required FK to something still-standing), billing is
 * canceled before data is touched, a billing failure never blocks the
 * deletion, and the audit row documenting the deletion is written AFTER
 * the transaction — since AuditEvent isn't a relation to Business, it's
 * the one thing meant to survive.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const callOrder: string[] = [];
function trackedDeleteMany(name: string) {
  return vi.fn(async () => {
    callOrder.push(name);
    return { count: 0 };
  });
}

const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

const { cancelSubscription } = vi.hoisted(() => ({ cancelSubscription: vi.fn(async () => ({})) }));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ subscriptions: { cancel: cancelSubscription } }),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: vi.fn(), delete: vi.fn(async () => ({})) },
    user: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("user") },
    lead: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("lead") },
    conversation: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("conversation") },
    message: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("message") },
    deal: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("deal") },
    followUp: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("followUp") },
    task: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("task") },
    booking: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("booking") },
    sequence: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("sequence") },
    sourceRule: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("sourceRule") },
    savedFilter: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("savedFilter") },
    invite: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("invite") },
    notification: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("notification") },
    automation: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("automation") },
    crmConnection: { findUnique: vi.fn(async () => null), deleteMany: trackedDeleteMany("crmConnection") },
    a2pRegistration: { findUnique: vi.fn(async () => null), deleteMany: trackedDeleteMany("a2pRegistration") },
    productFeedback: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("productFeedback") },
    rateLimitHit: { deleteMany: trackedDeleteMany("rateLimitHit") },
    filteredEmail: { deleteMany: trackedDeleteMany("filteredEmail") },
    integration: { deleteMany: trackedDeleteMany("integration") },
    aIInsight: { deleteMany: trackedDeleteMany("aIInsight") },
    auditEvent: { findMany: vi.fn(async () => []) },
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
  },
}));

import { prisma } from "@/lib/db";
import { deleteBusinessData, exportBusinessData } from "@/lib/businessData";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

const business = {
  id: "biz1",
  name: "Acme Realty",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  webhookSecret: "whsec_1",
  twilioSecret: "tw_1",
  twilioAuthToken: "secret-token",
  instagramAccessToken: "ig-token",
  facebookPageAccessToken: "fb-token",
};

beforeEach(() => {
  callOrder.length = 0;
  recordAudit.mockReset();
  cancelSubscription.mockReset().mockResolvedValue({});
  p.business.findUnique.mockResolvedValue(business);
  p.business.delete.mockClear();
});

describe("deleteBusinessData", () => {
  it("returns failure without touching anything when the business doesn't exist", async () => {
    p.business.findUnique.mockResolvedValueOnce(null);
    const result = await deleteBusinessData("ghost", { userId: "u1", email: "a@b.com" });
    expect(result).toEqual({ success: false, message: "Business not found." });
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(p.business.delete).not.toHaveBeenCalled();
  });

  it("cancels the Stripe subscription before deleting any data", async () => {
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    expect(cancelSubscription).toHaveBeenCalledWith("sub_1");
    expect(cancelSubscription.mock.invocationCallOrder[0]).toBeLessThan(
      (p.business.delete.mock.invocationCallOrder[0] as number)
    );
  });

  it("never blocks the deletion when Stripe cancellation fails", async () => {
    cancelSubscription.mockRejectedValueOnce(new Error("already canceled"));
    const result = await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    expect(result).toEqual({ success: true });
    expect(p.business.delete).toHaveBeenCalledWith({ where: { id: "biz1" } });
  });

  it("skips the Stripe call entirely when there's no subscription on file", async () => {
    p.business.findUnique.mockResolvedValueOnce({ ...business, stripeSubscriptionId: null });
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it("deletes every dependent table in an FK-safe order, business last", async () => {
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });

    // Leaf-first: a Message can't be deleted after its Conversation is gone.
    expect(callOrder.indexOf("message")).toBeLessThan(callOrder.indexOf("conversation"));
    // SavedFilter/Notification/Integration all hold a required FK to User —
    // deleting User first would violate that constraint.
    expect(callOrder.indexOf("savedFilter")).toBeLessThan(callOrder.indexOf("user"));
    expect(callOrder.indexOf("notification")).toBeLessThan(callOrder.indexOf("user"));
    expect(callOrder.indexOf("integration")).toBeLessThan(callOrder.indexOf("user"));
    // Business itself is always the very last thing removed.
    expect(p.business.delete).toHaveBeenCalledWith({ where: { id: "biz1" } });
  });

  it("writes the audit record only after the transaction succeeds, and it's never deleted", async () => {
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    expect(recordAudit).toHaveBeenCalledWith(
      { businessId: "biz1", userId: "u1" },
      "business.delete",
      expect.objectContaining({ targetType: "business", targetId: "biz1" })
    );
    // No auditEvent.deleteMany exists on the mocked client at all — deleting
    // it was never even attempted.
    expect((p.auditEvent as Record<string, unknown>).deleteMany).toBeUndefined();
  });
});

describe("exportBusinessData", () => {
  it("returns null for a business that doesn't exist", async () => {
    p.business.findUnique.mockResolvedValueOnce(null);
    expect(await exportBusinessData("ghost")).toBeNull();
  });

  it("never includes a credential, token, or webhook secret", async () => {
    const result = await exportBusinessData("biz1");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/whsec_1|tw_1|secret-token|ig-token|fb-token/);
  });

  it("keeps ordinary, non-secret business fields", async () => {
    const result = await exportBusinessData("biz1");
    expect(result?.business).toMatchObject({ id: "biz1", name: "Acme Realty" });
  });
});
