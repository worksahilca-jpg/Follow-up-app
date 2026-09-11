/**
 * task: Voice is Plus/Pro-eligible, but only once the business is actually
 * paying for the Voice add-on (research/market/2026-09-11-tier-pricing-
 * recommendation.md §4) — voiceAgentEnabled (the feature toggle) must not
 * flip on without voiceAddonEnabled (the billing fact) already true.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, businessUpdate } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  businessUpdate: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique, update: businessUpdate } } }));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(async () => ({ businessId: "biz1", userId: "user1", email: "owner@acme.com" })),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));

import { POST } from "@/app/api/twilio/config/route";

function postRequest(body: unknown) {
  return new Request("https://followupbase.io/api/twilio/config", {
    method: "POST",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
  requireAdmin.mockResolvedValue(true);
  businessFindUnique.mockResolvedValue({ twilioSecret: "existing-secret", voiceAddonEnabled: false });
});

describe("POST /api/twilio/config — Voice add-on gate", () => {
  it("refuses to turn voiceAgentEnabled on without the Voice add-on", async () => {
    const res = await POST(postRequest({ voiceAgentEnabled: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(businessUpdate).not.toHaveBeenCalled();
  });

  it("allows turning voiceAgentEnabled on once the Voice add-on is active", async () => {
    businessFindUnique.mockResolvedValue({ twilioSecret: "existing-secret", voiceAddonEnabled: true });
    const res = await POST(postRequest({ voiceAgentEnabled: true }));
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ voiceAgentEnabled: true }) }));
  });

  it("always allows turning voiceAgentEnabled off, addon or not", async () => {
    const res = await POST(postRequest({ voiceAgentEnabled: false }));
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ voiceAgentEnabled: false }) }));
  });

  it("never checks the add-on when voiceAgentEnabled isn't part of this request at all", async () => {
    const res = await POST(postRequest({ phoneNumber: "+15551234567" }));
    expect(res.status).toBe(200);
    expect(businessUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ twilioPhoneNumber: "+15551234567" }) }));
  });
});
