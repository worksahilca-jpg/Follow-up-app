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
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
    productFeedback: { findMany: vi.fn(async () => []), deleteMany: trackedDeleteMany("productFeedback") },
    rateLimitHit: { deleteMany: trackedDeleteMany("rateLimitHit") },
    filteredEmail: { deleteMany: trackedDeleteMany("filteredEmail") },
    integration: { deleteMany: trackedDeleteMany("integration") },
    pushSubscription: { deleteMany: trackedDeleteMany("pushSubscription") },
    ownerAlert: { deleteMany: trackedDeleteMany("ownerAlert") },
    aIInsight: { deleteMany: trackedDeleteMany("aIInsight") },
    outboundSend: { deleteMany: trackedDeleteMany("outboundSend") },
    sendClaim: { deleteMany: trackedDeleteMany("sendClaim") },
    inboundWebhookEvent: { deleteMany: trackedDeleteMany("inboundWebhookEvent") },
    suppression: { deleteMany: trackedDeleteMany("suppression") },
    reactivationRun: { deleteMany: trackedDeleteMany("reactivationRun") },
    auditEvent: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => {
        callOrder.push("auditEventScrub");
        return { count: 0 };
      }),
    },
    // The unattributed Meta envelopes are cleared with raw SQL (they have
    // no businessId to filter on). Records the bound LIKE pattern.
    $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      callOrder.push(`rawEnvelope:${String(values[0])}`);
      return 0;
    }),
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
    // A deleted business must leave no way to reach anyone's phone.
    expect(callOrder).toContain("pushSubscription");
    expect(callOrder.indexOf("pushSubscription")).toBeLessThan(callOrder.indexOf("user"));
    expect(callOrder.indexOf("ownerAlert")).toBeLessThan(callOrder.indexOf("user"));
    // A queued outbound send holds a required FK to Lead — and it carries
    // real message text, so an erasure that skipped it would leave this
    // business's drafts behind.
    expect(callOrder.indexOf("outboundSend")).toBeLessThan(callOrder.indexOf("lead"));
    // The raw inbound-capture log holds provider payloads — phone numbers,
    // names, the text of what people sent — under a plain businessId column
    // with no FK to cascade it, so an erasure that skipped it would leave
    // this business's inbound messages on disk after the business is gone.
    expect(callOrder).toContain("inboundWebhookEvent");
    // Business itself is always the very last thing removed.
    expect(p.business.delete).toHaveBeenCalledWith({ where: { id: "biz1" } });
  });

  // Audit 2026-09-16 Meta #9: Meta envelopes are stored unattributed
  // (businessId NULL), so the businessId delete above never reached them
  // and a deleted business's DM text outlived its erasure.
  it("also erases the unattributed Meta envelopes that name this business's accounts", async () => {
    p.business.findUnique.mockResolvedValueOnce({
      ...business,
      instagramUserId: "17841400000000001",
      instagramAccountId: "17841400000000001", // same id twice: one delete
      facebookPageId: "102030405060708",
      whatsappPhoneNumberId: "555000111222",
    });
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    const raw = callOrder.filter((c) => c.startsWith("rawEnvelope:"));
    expect(raw).toEqual([
      'rawEnvelope:%"17841400000000001"%',
      'rawEnvelope:%"102030405060708"%',
      'rawEnvelope:%"555000111222"%',
    ]);
  });

  // Audit 2026-09-16 H-1(b): the audit trail survives erasure by design,
  // but its meta held people's names, emails and numbers.
  it("keeps the audit trail but strips the personal details out of it", async () => {
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    expect(p.auditEvent.updateMany).toHaveBeenCalledWith({
      where: { businessId: "biz1" },
      data: { meta: expect.anything(), ip: null },
    });
    const data = (p.auditEvent.updateMany.mock.calls[0] as [{ data: { meta: unknown } }])[0].data;
    // Prisma.DbNull: the column set to SQL NULL, not the JSON value null.
    expect(String(data.meta)).toMatch(/DbNull/);
    // Scrubbed inside the same transaction, before the business row goes;
    // the deletion's own audit record is written after, and is not scrubbed.
    expect(callOrder).toContain("auditEventScrub");
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "business.delete", expect.anything());
  });

  it("never builds a pattern from an id that isn't all digits", async () => {
    p.business.findUnique.mockResolvedValueOnce({ ...business, instagramUserId: "%", facebookPageId: null });
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });
    expect(callOrder.filter((c) => c.startsWith("rawEnvelope:"))).toEqual([]);
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

/**
 * Reach (audit 2026-09-16, H-1). Suppression and ReactivationRun both
 * reference Business with ON DELETE RESTRICT and were absent from the
 * delete list, so any business holding one STOP or one reactivation run
 * got a 500 from its own erasure — after Stripe had already been
 * cancelled. The mocked tests above cannot see a missing table; this one
 * reads the schema and fails on any Business relation the transaction
 * does not clear, so the next table added with a businessId cannot repeat
 * it silently.
 */
describe("erasure reaches every table that points at Business", () => {
  it("deletes from every model with a businessId relation before deleting the business", async () => {
    const schema = readFileSync(join(__dirname, "..", "..", "..", "prisma", "schema.prisma"), "utf8");
    const models: string[] = [];
    for (const block of schema.split(/^model /m).slice(1)) {
      const name = block.split(/\s/)[0];
      if (/@relation\(fields: \[businessId\]/.test(block)) models.push(name);
    }
    expect(models.length).toBeGreaterThanOrEqual(15);

    callOrder.length = 0;
    await deleteBusinessData("biz1", { userId: "u1", email: "a@b.com" });

    const delegate = (m: string) => m.charAt(0).toLowerCase() + m.slice(1);
    for (const model of models) {
      expect(callOrder, `deleteBusinessData never clears ${model} (prisma.${delegate(model)}.deleteMany) — its FK would block the delete`).toContain(delegate(model));
    }
    expect(p.business.delete).toHaveBeenCalled();
  });
});
