/**
 * "Remove practice customers" (A-093) deletes for good, so the rule has to hold exactly:
 * this business only, source "Test lead" only, admins only.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { leadFindMany, leadCount } = vi.hoisted(() => ({ leadFindMany: vi.fn(), leadCount: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findMany: leadFindMany, count: leadCount } } }));

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
}));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));

const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

const { deleteLeadCascade } = vi.hoisted(() => ({ deleteLeadCascade: vi.fn(async () => {}) }));
vi.mock("@/lib/leads-admin", () => ({ deleteLeadCascade }));
vi.mock("@/lib/senderVerdicts", () => ({ forgetSender: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => true) }));

import { GET, DELETE } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
});

describe("practice customers", () => {
  it("removes only this business's 'Test lead' customers, each with the tenant check", async () => {
    leadFindMany.mockResolvedValue([{ id: "t1", email: "me@x.test" }, { id: "t2", email: null }]);
    const res = await DELETE();
    expect(leadFindMany.mock.calls[0][0].where).toEqual({ businessId: "biz1", source: "Test lead" });
    expect(deleteLeadCascade).toHaveBeenCalledTimes(2);
    expect(deleteLeadCascade).toHaveBeenCalledWith("t1", "biz1");
    expect(deleteLeadCascade).toHaveBeenCalledWith("t2", "biz1");
    expect(await res.json()).toEqual({ success: true, removed: 2 });
  });

  it("counts with the same rule", async () => {
    leadCount.mockResolvedValue(3);
    const res = await GET();
    expect(leadCount.mock.calls[0][0].where).toEqual({ businessId: "biz1", source: "Test lead" });
    expect(await res.json()).toEqual({ success: true, count: 3 });
  });

  it("refuses non-admins and signed-out visitors without deleting anything", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await DELETE()).status).toBe(403);
    getSessionContext.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    expect(leadFindMany).not.toHaveBeenCalled();
    expect(deleteLeadCascade).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    expect((await DELETE()).status).toBe(429);
    expect(deleteLeadCascade).not.toHaveBeenCalled();
  });
});
