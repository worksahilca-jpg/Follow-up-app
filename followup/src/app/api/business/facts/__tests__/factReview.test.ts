/**
 * The owner's answer to something FollowUp learned (A-308): "Use it" puts it in replies, "Not right" drops it, only
 * an admin answers, and only for their own business.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { fact } = vi.hoisted(() => ({
  fact: { findFirst: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { businessFact: fact } }));
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { POST } from "../[id]/review/route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/facts/f1/review", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const IN_USE = new Date("2026-10-01");

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  fact.updateMany.mockResolvedValue({ count: 1 });
  fact.deleteMany.mockResolvedValue({ count: 1 });
});

describe("Use it", () => {
  it("puts something new in replies", async () => {
    fact.findFirst.mockResolvedValue({ id: "f1", approvedAt: null, proposedValue: null });
    const res = await POST(req({ decision: "use" }), params("f1"));
    expect(res.status).toBe(200);
    expect(fact.findFirst.mock.calls[0][0].where).toEqual({ id: "f1", businessId: "biz1" });
    expect(fact.updateMany).toHaveBeenCalledWith({ where: { id: "f1", businessId: "biz1" }, data: { approvedAt: expect.any(Date) } });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "business.fact.review", { targetType: "business_fact", targetId: "f1", meta: { decision: "use" } });
  });

  it("swaps in the new words for a fact already in use", async () => {
    fact.findFirst.mockResolvedValue({ id: "f1", approvedAt: IN_USE, proposedValue: "2.5%" });
    await POST(req({ decision: "use" }), params("f1"));
    expect(fact.updateMany).toHaveBeenCalledWith({
      where: { id: "f1", businessId: "biz1" },
      data: { value: "2.5%", proposedValue: null, approvedAt: expect.any(Date) },
    });
  });
});

describe("Not right", () => {
  it("removes something new", async () => {
    fact.findFirst.mockResolvedValue({ id: "f1", approvedAt: null, proposedValue: null });
    await POST(req({ decision: "not_right" }), params("f1"));
    expect(fact.deleteMany).toHaveBeenCalledWith({ where: { id: "f1", businessId: "biz1" } });
    expect(fact.updateMany).not.toHaveBeenCalled();
  });

  it("drops new words and keeps the ones in use", async () => {
    fact.findFirst.mockResolvedValue({ id: "f1", approvedAt: IN_USE, proposedValue: "2.5%" });
    await POST(req({ decision: "not_right" }), params("f1"));
    expect(fact.updateMany).toHaveBeenCalledWith({ where: { id: "f1", businessId: "biz1" }, data: { proposedValue: null } });
    expect(fact.deleteMany).not.toHaveBeenCalled();
  });
});

describe("who and what", () => {
  it("changes nothing when nothing waits (answered already)", async () => {
    fact.findFirst.mockResolvedValue({ id: "f1", approvedAt: IN_USE, proposedValue: null });
    expect((await POST(req({ decision: "not_right" }), params("f1"))).status).toBe(200);
    expect(fact.deleteMany).not.toHaveBeenCalled();
    expect(fact.updateMany).not.toHaveBeenCalled();
  });

  it("is an admin's to answer, signed in, for their own business only", async () => {
    getSessionContext.mockResolvedValueOnce(null);
    expect((await POST(req({ decision: "use" }), params("f1"))).status).toBe(401);
    requireAdmin.mockResolvedValueOnce(false);
    expect((await POST(req({ decision: "use" }), params("f1"))).status).toBe(403);
    fact.findFirst.mockResolvedValueOnce(null);
    expect((await POST(req({ decision: "use" }), params("other"))).status).toBe(404);
    expect((await POST(req({ decision: "maybe" }), params("f1"))).status).toBe(400);
    expect(fact.updateMany).not.toHaveBeenCalled();
  });
});
