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
vi.mock("@/lib/session", () => ({ getSessionContext }));
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
