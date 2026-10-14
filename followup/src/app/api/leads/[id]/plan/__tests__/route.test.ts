/**
 * "Change plan" on a customer's page (A-245): only this business's
 * customers, My own only once it exists, and "Don't wait" is an admin's
 * call when only admins send.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { lead, business } = vi.hoisted(() => ({
  lead: { findFirst: vi.fn(), update: vi.fn() },
  business: { findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { lead, business } }));
const { getSessionContext } = vi.hoisted(() => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { sendRefusal } = vi.hoisted(() => ({ sendRefusal: vi.fn() }));
vi.mock("@/lib/sendingControl", () => ({ sendRefusal }));

import { PATCH } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/leads/l1/plan", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const params = { params: Promise.resolve({ id: "l1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  lead.findFirst.mockResolvedValue({ id: "l1" });
  lead.update.mockResolvedValue({});
  business.findUnique.mockResolvedValue({ followUpPlans: null });
  sendRefusal.mockResolvedValue(null);
});

describe("changing one customer's plan", () => {
  it("puts them on Long, scoped to this business", async () => {
    expect((await PATCH(req({ plan: "long" }), params)).status).toBe(200);
    expect(lead.findFirst.mock.calls[0][0].where).toEqual({ id: "l1", businessId: "biz1" });
    expect(lead.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { followUpPlan: "long" } });
  });

  it("hands the choice back to FollowUp, and stops waiting for their day", async () => {
    await PATCH(req({ plan: null, stopWaiting: true }), params);
    expect(lead.update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { followUpPlan: null, followUpNotBefore: null } });
  });

  it("says no to someone else's customer", async () => {
    lead.findFirst.mockResolvedValue(null);
    expect((await PATCH(req({ plan: "fast" }), params)).status).toBe(404);
    expect(lead.update).not.toHaveBeenCalled();
  });

  it("needs My own to exist first", async () => {
    expect((await PATCH(req({ plan: "own" }), params)).status).toBe(400);
    business.findUnique.mockResolvedValue({ followUpPlans: { own: { days: [2], after: "stop", useFor: "picked" } } });
    expect((await PATCH(req({ plan: "own" }), params)).status).toBe(200);
  });

  it("leaves 'Don't wait' to an admin when only admins send", async () => {
    sendRefusal.mockResolvedValue("Only admins send on this account.");
    expect((await PATCH(req({ stopWaiting: true }), params)).status).toBe(403);
    expect(lead.update).not.toHaveBeenCalled();
  });
});
