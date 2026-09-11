/**
 * task: GET /api/billing/status now also reports leadsUsedThisMonth (only
 * computed on Free — Plus/Pro have no cap) so the Settings billing tab can
 * show "X/20 this month" instead of leaving Free's biggest restriction
 * invisible until a lead silently never gets scored.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadCount } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  leadCount: vi.fn(async () => 0),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique }, lead: { count: leadCount } } }));

const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));

import { GET } from "@/app/api/billing/status/route";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "user1", email: "owner@acme.com" });
});

describe("GET /api/billing/status", () => {
  it("reports leadsUsedThisMonth for a Free-tier business", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: null, currentPeriodEnd: null, tier: "free", voiceAddonEnabled: false });
    leadCount.mockResolvedValue(7);
    const res = await GET();
    const body = await res.json();
    expect(body.leadsUsedThisMonth).toBe(7);
    expect(body.leadCap).toBe(20);
  });

  it("never queries the lead count for a Plus/Pro business", async () => {
    businessFindUnique.mockResolvedValue({ subscriptionStatus: "active", currentPeriodEnd: null, tier: "pro", voiceAddonEnabled: true });
    const res = await GET();
    const body = await res.json();
    expect(body.leadsUsedThisMonth).toBe(0);
    expect(leadCount).not.toHaveBeenCalled();
  });

  it("401s with sane Free-tier defaults when there's no session", async () => {
    getSessionContext.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      active: false,
      status: null,
      currentPeriodEnd: null,
      tier: "free",
      voiceAddonEnabled: false,
      leadsUsedThisMonth: 0,
      leadCap: 20,
    });
  });
});
