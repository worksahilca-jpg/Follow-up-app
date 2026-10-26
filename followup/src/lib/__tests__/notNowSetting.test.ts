/**
 * "When a customer says 'not now'" (A-329): the owner's one answer, saved through the settings route. Admins only,
 * scoped to their own business, and with Ask, the customer whose card asked gets their waiting reply written again.
 * Driven through the real route handler.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessUpdate, businessFindUnique, leadFindFirst, audit, sessionCtx, admin, billing, redraft } = vi.hoisted(() => ({
  businessUpdate: vi.fn(),
  businessFindUnique: vi.fn(),
  leadFindFirst: vi.fn(),
  audit: vi.fn(),
  sessionCtx: vi.fn(),
  admin: vi.fn(),
  billing: vi.fn(),
  redraft: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { update: businessUpdate, findUnique: businessFindUnique },
    lead: { findFirst: leadFindFirst },
    automation: { findFirst: vi.fn(async () => null), update: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: audit }));
vi.mock("@/lib/session", () => ({ getSessionContext: sessionCtx, requireAdmin: admin }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: billing, billingLockedMessage: async () => "Billing is locked." }));
vi.mock("@/lib/acknowledge", () => ({ INSTANT_ACK_ACTION: "instant_ack", INSTANT_ACK_NAME: "Instant acknowledgement", isInstantAckEnabled: async () => true }));
vi.mock("@/lib/automation", () => ({
  UNANSWERED_ACTION: "unanswered",
  UNANSWERED_DEFAULT_HOURS: 4,
  UNANSWERED_NAME: "Unanswered reply",
  DEAD_LEAD_ACTION: "dead_lead",
  DEAD_LEAD_DEFAULT_DAYS: 60,
  DEAD_LEAD_NAME: "Dead lead",
}));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: redraft }));

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
  businessUpdate.mockResolvedValue({});
  redraft.mockResolvedValue(true);
});

describe("the not-now answer (A-329)", () => {
  it("reads as null until the owner answers, then as their answer", async () => {
    businessFindUnique.mockResolvedValueOnce({ holdAllForApproval: true, notNowPlan: null });
    expect((await (await GET()).json()).notNowPlan).toBeNull();
    businessFindUnique.mockResolvedValueOnce({ holdAllForApproval: true, notNowPlan: "ask" });
    expect((await (await GET()).json()).notNowPlan).toBe("ask");
  });

  it("saves Stop on its own business, audited, and writes nothing again", async () => {
    const res = await post({ notNowPlan: "stop", notNowLeadId: "lead_1" });
    expect(await res.json()).toEqual({ success: true, notNowPlan: "stop" });
    expect(businessUpdate).toHaveBeenCalledWith({ where: { id: "biz_1" }, data: { notNowPlan: "stop" } });
    expect(audit).toHaveBeenCalledWith(expect.anything(), "automation.not_now.stop");
    expect(redraft).not.toHaveBeenCalled();
  });

  it("with Ask, writes the asking customer's reply again, only for their own maybe-no customer", async () => {
    leadFindFirst.mockResolvedValueOnce({ id: "lead_1" });
    await post({ notNowPlan: "ask", notNowLeadId: "lead_1" });
    expect(leadFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead_1", businessId: "biz_1", saidNoHow: "unsure" } }));
    expect(redraft).toHaveBeenCalledWith("lead_1");
  });

  it("never writes again for a customer of another business", async () => {
    leadFindFirst.mockResolvedValueOnce(null);
    const res = await post({ notNowPlan: "ask", notNowLeadId: "someone_elses" });
    expect((await res.json()).success).toBe(true);
    expect(redraft).not.toHaveBeenCalled();
  });

  it("saves even when the new reply can't be written", async () => {
    leadFindFirst.mockResolvedValueOnce({ id: "lead_1" });
    redraft.mockRejectedValueOnce(new Error("AI down"));
    const res = await post({ notNowPlan: "ask", notNowLeadId: "lead_1" });
    expect((await res.json()).success).toBe(true);
    expect(businessUpdate).toHaveBeenCalled();
  });

  it("is an admin's choice, and takes only the two answers", async () => {
    admin.mockResolvedValueOnce(false);
    expect((await post({ notNowPlan: "ask" })).status).toBe(403);
    expect((await post({ notNowPlan: "always" })).status).toBe(400);
    expect(businessUpdate).not.toHaveBeenCalled();
  });
});
