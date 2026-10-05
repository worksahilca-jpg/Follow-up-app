/**
 * GET /api/twilio/config (src/app/api/twilio/config/route.ts), audit
 * 2026-09-27: it only needs to say WHETHER an Auth Token is saved, and any
 * team member can call it. Selecting the column made src/lib/db.ts decrypt
 * the live credential on every Settings load to compute that boolean. The
 * Meta config routes already avoid this; this one now does too.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const ctx = { userId: "u1", businessId: "b1", email: "rep@example.com", authTime: Date.now() };
const { businessFindUnique, businessCount } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  businessCount: vi.fn(),
}));

const { requireAdmin } = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => false) }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(async () => ctx), requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique, count: businessCount } } }));

import { GET } from "@/app/api/twilio/config/route";

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue({ twilioSecret: "s3cret", twilioAccountSid: "AC123", voiceAgentEnabled: false });
});

describe("GET /api/twilio/config", () => {
  // Security review L7 (2026-10-05): the URLs carry the webhook secret.
  it("shows the webhook URLs to an admin only", async () => {
    businessCount.mockResolvedValue(0);
    requireAdmin.mockResolvedValueOnce(false);
    const asTeammate = await (await GET()).json();
    expect(asTeammate.smsUrl).toBeNull();
    expect(JSON.stringify(asTeammate)).not.toContain("s3cret");
    requireAdmin.mockResolvedValueOnce(true);
    const asAdmin = await (await GET()).json();
    expect(asAdmin.smsUrl).toContain("/api/twilio/sms/s3cret");
  });

  it("never selects the Auth Token", async () => {
    businessCount.mockResolvedValue(1);
    await GET();
    const select = businessFindUnique.mock.calls[0][0].select as Record<string, unknown>;
    expect(select).not.toHaveProperty("twilioAuthToken");
  });

  it("reports a saved token from a count scoped to the caller's business", async () => {
    businessCount.mockResolvedValue(1);
    const body = await (await GET()).json();
    expect(body.hasAuthToken).toBe(true);
    expect(body).not.toHaveProperty("authToken");
    expect(businessCount).toHaveBeenCalledWith({ where: { id: "b1", twilioAuthToken: { not: null } } });
  });

  it("reports no token when none is saved", async () => {
    businessCount.mockResolvedValue(0);
    const body = await (await GET()).json();
    expect(body.hasAuthToken).toBe(false);
  });
});
