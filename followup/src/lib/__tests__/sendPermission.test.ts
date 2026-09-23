/**
 * Permission to send without asking.
 *
 * Until now `Business.holdAllForApproval` was `@default(true)` and the
 * settings route READ it but never WROTE it — so every account held every
 * message forever, with no way out. The landing page meanwhile sold
 * "FollowUp replies for you" as the $39 tier's headline benefit (#307).
 *
 * Founder, 2026-09-22: "followup will be sending automatically followups
 * if they have allowed and given the permission." So: off unless granted,
 * granted explicitly, and revocable.
 *
 * ## Why the inversion gets its own tests
 *
 * The stored field is the NEGATIVE of the decision. `holdAllForApproval`
 * true means "do not send"; the owner is choosing "do send". One misplaced
 * `!` in this path does not throw, does not fail a typecheck, and does not
 * look wrong in review — it silently messages every customer a business
 * has, signed as that business. That is the worst outcome this product can
 * produce, so the translation is asserted in both directions, at the wire,
 * rather than trusted to read correctly.
 *
 * Driven through the real route handler. The bug this guards against lives
 * in the composition — which branch runs, what it writes — and a source
 * assertion cannot see that.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessUpdate, businessFindUnique, automationFindFirst, audit, sessionCtx, admin, billing } = vi.hoisted(() => ({
  businessUpdate: vi.fn(),
  businessFindUnique: vi.fn(),
  automationFindFirst: vi.fn(),
  audit: vi.fn(),
  sessionCtx: vi.fn(),
  admin: vi.fn(),
  billing: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { update: businessUpdate, findUnique: businessFindUnique },
    automation: { findFirst: automationFindFirst, update: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: audit }));
vi.mock("@/lib/session", () => ({ getSessionContext: sessionCtx, requireAdmin: admin }));
vi.mock("@/lib/billing", () => ({
  requireActiveBilling: billing,
  billingLockedMessage: async () => "Billing is locked.",
}));
vi.mock("@/lib/acknowledge", () => ({
  INSTANT_ACK_ACTION: "instant_ack",
  INSTANT_ACK_NAME: "Instant acknowledgement",
  isInstantAckEnabled: async () => true,
}));
vi.mock("@/lib/automation", () => ({
  UNANSWERED_ACTION: "unanswered",
  UNANSWERED_DEFAULT_HOURS: 4,
  UNANSWERED_NAME: "Unanswered reply",
  DEAD_LEAD_ACTION: "dead_lead",
  DEAD_LEAD_DEFAULT_DAYS: 60,
  DEAD_LEAD_NAME: "Dead lead",
}));

import { GET, POST } from "@/app/api/automation/settings/route";

const post = (body: unknown) =>
  POST(
    new Request("https://followupbase.io/api/automation/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
  );

beforeEach(() => {
  vi.clearAllMocks();
  sessionCtx.mockResolvedValue({ businessId: "biz_1", userId: "user_1" });
  admin.mockResolvedValue(true);
  billing.mockResolvedValue(true);
  automationFindFirst.mockResolvedValue(null);
  businessFindUnique.mockResolvedValue({ holdAllForApproval: true });
  businessUpdate.mockResolvedValue({});
});

describe("granting permission to send", () => {
  it("clears the hold when the owner says yes", async () => {
    const res = await post({ autoSendPermission: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, autoSendPermission: true });

    // The inversion, at the only place it happens inbound. `true` in
    // means "send on my behalf", which is `holdAllForApproval: false`.
    //
    // The grant is also STAMPED. That timestamp is what stops the switch
    // emptying the approval queue on the next tick: automation.ts refuses
    // to act on any conversation older than it, so what was already
    // waiting stays waiting until the owner releases it deliberately.
    // Without the stamp, turning this on releases weeks of drafts about
    // conversations that ended long ago.
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "biz_1" },
      data: { holdAllForApproval: false, autoSendAllowedAt: expect.any(Date) },
    });
  });

  it("restores the hold when the owner says stop", async () => {
    const res = await post({ autoSendPermission: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, autoSendPermission: false });
    // The stamp is CLEARED on revoke, not left behind. Granting again
    // must start a fresh "from now on" rather than reaching back to the
    // first time and releasing everything held in between.
    expect(businessUpdate).toHaveBeenCalledWith({
      where: { id: "biz_1" },
      data: { holdAllForApproval: true, autoSendAllowedAt: null },
    });
  });

  it("writes an audit row naming the decision, not the field", async () => {
    // Who turned sending on, and when, is the question someone asks after
    // a message goes out that surprised them.
    await post({ autoSendPermission: true });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz_1" }), "automation.autosend.granted");

    audit.mockClear();
    await post({ autoSendPermission: false });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ businessId: "biz_1" }), "automation.autosend.revoked");
  });
});

describe("what must NOT be able to grant it", () => {
  it("refuses a non-admin", async () => {
    admin.mockResolvedValue(false);
    const res = await post({ autoSendPermission: true });
    expect(res.status).toBe(403);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("refuses a signed-out request", async () => {
    sessionCtx.mockResolvedValue(null);
    const res = await post({ autoSendPermission: true });
    expect(res.status).toBe(401);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("refuses when billing is locked", async () => {
    billing.mockResolvedValue(false);
    const res = await post({ autoSendPermission: true });
    expect(res.status).toBe(402);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("ignores a non-boolean, rather than coercing it", async () => {
    // "true" as a string, or 1, must not grant permission. zod rejects
    // the body outright; what matters is that nothing is written.
    for (const value of ["true", 1, "yes", {}]) {
      businessUpdate.mockClear();
      await post({ autoSendPermission: value });
      expect(businessUpdate, `${JSON.stringify(value)} was treated as a decision`).not.toHaveBeenCalled();
    }
  });

  it("does not touch the hold when the body says nothing about it", async () => {
    // Saving the silence delay must never change what sends. This is the
    // reason the branch is isolated and returns early.
    await post({ enabled: true, triggerDays: 5 });
    expect(businessUpdate).not.toHaveBeenCalled();
  });
});

describe("reading the permission back", () => {
  it("reports the positive form so no client writes the inversion", async () => {
    businessFindUnique.mockResolvedValue({ holdAllForApproval: true });
    const held = await (await GET()).json();
    expect(held.autoSendPermission).toBe(false);
    expect(held.holdAllForApproval).toBe(true);

    businessFindUnique.mockResolvedValue({ holdAllForApproval: false });
    const sending = await (await GET()).json();
    expect(sending.autoSendPermission).toBe(true);
    expect(sending.holdAllForApproval).toBe(false);
  });

  it("treats an unknown business as still holding", async () => {
    // A missing row must read as "not permitted". The safe answer is the
    // one that sends nothing.
    businessFindUnique.mockResolvedValue(null);
    const res = await (await GET()).json();
    expect(res.autoSendPermission).toBe(false);
  });
});
