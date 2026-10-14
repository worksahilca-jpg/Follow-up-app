/**
 * The follow-up plans (A-245): everyone on the team can see them, only an
 * admin changes them, and what's stored is only days FollowUp can use.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { business, lead } = vi.hoisted(() => ({
  business: { findUnique: vi.fn(), update: vi.fn() },
  lead: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { business, lead } }));
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { GET, PATCH } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/follow-up-plans", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  business.findUnique.mockResolvedValue({ followUpPlans: null, industry: "Real estate", holdAllForApproval: true });
  business.update.mockResolvedValue({});
  lead.findMany.mockResolvedValue([
    { followUpPlan: null, qualification: null },
    { followUpPlan: null, qualification: { v: 2, template: "real_estate", items: [], tier: "later" } },
    { followUpPlan: "long", qualification: null },
  ]);
});

describe("seeing the plans", () => {
  it("shows the plans as drawn, how many customers are on each, and who may change them", async () => {
    requireAdmin.mockResolvedValue(false);
    const data = await (await GET()).json();
    expect(data).toMatchObject({ success: true, plans: {}, counts: { fast: 1, long: 2, own: 0 }, realtor: true, holdAll: true, isAdmin: false });
    expect(lead.findMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz1" });
  });

  it("is for signed-in people only", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("changing them", () => {
  it("is an admin's call", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await PATCH(req({ fast: [2, 4] }))).status).toBe(403);
    expect(business.update).not.toHaveBeenCalled();
  });

  it("stores only usable days, in order, for this business", async () => {
    const res = await PATCH(req({ fast: [9, 2, 2, 60], own: { days: [21, 5], after: "monthly", useFor: "most" } }));
    expect(res.status).toBe(200);
    expect(business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { followUpPlans: { fast: [2, 9], own: { days: [5, 21], after: "monthly", useFor: "most" } } },
    });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "automation.plans.changed", expect.anything());
  });

  it("puts a plan back to its drawn days, and deletes My own", async () => {
    business.findUnique.mockResolvedValue({ followUpPlans: { fast: [2], own: { days: [3], after: "stop", useFor: "picked" } } });
    await PATCH(req({ fast: null, own: null }));
    expect(business.update.mock.calls[0][0].data.followUpPlans).not.toHaveProperty("fast");
  });

  it("refuses a plan with no usable day", async () => {
    expect((await PATCH(req({ long: [0, 99] }))).status).toBe(400);
    expect(business.update).not.toHaveBeenCalled();
  });
});
