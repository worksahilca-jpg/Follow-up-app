/**
 * task: autonomous send is a Plus/Pro capability
 * (research/market/2026-09-11-tier-pricing-recommendation.md) — a Free
 * tier business must not be able to opt a lead into it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadFindFirst, leadUpdate } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadFindFirst: vi.fn(async (): Promise<{ id: string; sequenceId: string | null }> => ({ id: "lead1", sequenceId: null })),
  leadUpdate: vi.fn(async ({ data }: { data: { automationTier: string } }) => ({
    id: "lead1",
    automationTier: data.automationTier,
  })),
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: businessFindUnique }, lead: { findFirst: leadFindFirst, update: leadUpdate } },
}));

const { getSessionContext } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1", email: "owner@acme.com" })),
}));
const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => true) }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

// The account-level permission (2026-09-23). Granted in the default
// fixture so the tier tests below stay about the TIER; the permission has
// its own describe at the bottom.
const { isAutonomousAllowed } = vi.hoisted(() => ({ isAutonomousAllowed: vi.fn(async () => true) }));
vi.mock("@/lib/autonomousPermission", () => ({
  isAutonomousAllowed,
  AUTONOMOUS_NOT_ALLOWED_MESSAGE: "Sending without review is switched off for this account. An admin can turn it on in Settings.",
}));
vi.mock("@/lib/billing", () => ({
  requireActiveBilling: vi.fn(async () => true),
  BILLING_LOCKED_MESSAGE: "Start your free 14-day trial to unlock this — see Billing in Settings.",
}));

import { POST } from "@/app/api/leads/[id]/automation/route";

function postRequest(tier: string) {
  return new Request("http://localhost/api/leads/lead1/automation", {
    method: "POST",
    body: JSON.stringify({ tier }),
  }) as unknown as Parameters<typeof POST>[0];
}

const params = Promise.resolve({ id: "lead1" });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  leadFindFirst.mockResolvedValue({ id: "lead1", sequenceId: null });
  businessFindUnique.mockResolvedValue({ tier: "plus" });
  requireAdmin.mockResolvedValue(true);
  isAutonomousAllowed.mockResolvedValue(true);
});

describe("POST /api/leads/[id]/automation — tier gate", () => {
  it("refuses AUTONOMOUS for a Free-tier business", async () => {
    businessFindUnique.mockResolvedValue({ tier: "free" });
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("allows AUTONOMOUS for a Plus business", async () => {
    businessFindUnique.mockResolvedValue({ tier: "plus" });
  requireAdmin.mockResolvedValue(true);
  isAutonomousAllowed.mockResolvedValue(true);
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(200);
    expect(leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { automationTier: "AUTONOMOUS" } }));
  });

  it("allows AUTONOMOUS for a Pro business", async () => {
    businessFindUnique.mockResolvedValue({ tier: "pro" });
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(200);
  });

  it("never even checks billing tier for ASSISTED or OFF", async () => {
    const res = await POST(postRequest("assisted"), { params });
    expect(res.status).toBe(200);
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("allows ASSISTED for a Free-tier business", async () => {
    businessFindUnique.mockResolvedValue({ tier: "free" });
    const res = await POST(postRequest("off"), { params });
    expect(res.status).toBe(200);
  });
});

// A lead enrolled in a workflow already has its own automated cadence
// (src/lib/sequences.ts) — turning ASSISTED/AUTONOMOUS on for it too used
// to be allowed outright, since nothing here checked sequenceId and
// automation.ts's own candidate query doesn't exclude it either, risking
// both systems drafting/sending to the same lead on the same day.
describe("POST /api/leads/[id]/automation — workflow-enrollment conflict", () => {
  it("refuses ASSISTED for a lead currently enrolled in a workflow", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead1", sequenceId: "seq1" });
    const res = await POST(postRequest("assisted"), { params });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("refuses AUTONOMOUS for a lead currently enrolled in a workflow", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead1", sequenceId: "seq1" });
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(409);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("still allows turning a workflow-enrolled lead OFF", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead1", sequenceId: "seq1" });
    const res = await POST(postRequest("off"), { params });
    expect(res.status).toBe(200);
    expect(leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { automationTier: "OFF" } }));
  });

  it("allows ASSISTED for a lead with no workflow enrollment", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead1", sequenceId: null });
    const res = await POST(postRequest("assisted"), { params });
    expect(res.status).toBe(200);
  });
});


/**
 * "Auto should be permitted by the user that is using followup."
 * — founder, 2026-09-23
 *
 * Before this, the only things in front of Auto on this route were a
 * billing-tier check and a confirmation dialog rendered in the browser.
 * The dialog is client code that the API never hears about, and the route
 * had no admin check at all — so any signed-in teammate could set any
 * lead to unreviewed sending by calling this directly.
 */
describe("POST /api/leads/[id]/automation — the account permission", () => {
  it("refuses AUTONOMOUS when the account has not permitted it", async () => {
    isAutonomousAllowed.mockResolvedValue(false);
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(403);
    expect(leadUpdate, "the lead was changed despite the refusal").not.toHaveBeenCalled();
  });

  it("refuses AUTONOMOUS from someone who is not an admin", async () => {
    // A confirmation dialog is not a permission: it lives in the page,
    // and this route is reachable without one.
    requireAdmin.mockResolvedValue(false);
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(403);
    expect(leadUpdate).not.toHaveBeenCalled();
  });

  it("still lets anyone set the safer modes", async () => {
    // The gate is on Auto alone. Turning a lead DOWN must never need a
    // permission — stopping is always allowed.
    requireAdmin.mockResolvedValue(false);
    isAutonomousAllowed.mockResolvedValue(false);
    for (const tier of ["off", "assisted"]) {
      leadUpdate.mockClear();
      const res = await POST(postRequest(tier), { params });
      expect(res.status, `${tier} was refused`).toBe(200);
      expect(leadUpdate).toHaveBeenCalled();
    }
  });

  it("allows AUTONOMOUS once the account permits it and an admin asks", async () => {
    const res = await POST(postRequest("autonomous"), { params });
    expect(res.status).toBe(200);
    expect(leadUpdate).toHaveBeenCalled();
  });
});
