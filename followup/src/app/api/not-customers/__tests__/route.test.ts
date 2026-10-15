/**
 * What FollowUp learned from "Not a customer" (A-259): read by anyone on the
 * account, changed only by an admin, always inside the signed-in business.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock, getSessionContext, requireAdmin, recordAudit } = vi.hoisted(() => ({
  prismaMock: {
    senderVerdict: {
      groupBy: vi.fn(async (): Promise<unknown[]> => []),
      deleteMany: vi.fn(async () => ({ count: 2 })),
    },
    business: {
      findUnique: vi.fn(async (): Promise<unknown> => ({ notCustomerAlways: [], notCustomerAsked: [] })),
      update: vi.fn(async () => ({})),
    },
  },
  getSessionContext: vi.fn(),
  requireAdmin: vi.fn(async () => true),
  recordAudit: vi.fn(async () => true),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { DELETE, GET, POST } from "@/app/api/not-customers/route";

const at = new Date("2026-10-15T03:00:00Z");
const req = (method: string, body: unknown) =>
  new NextRequest("http://localhost/api/not-customers", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
});

describe("GET /api/not-customers", () => {
  it("lists each answer with its count, plus a standing rule even with no one left under it", async () => {
    prismaMock.senderVerdict.groupBy.mockResolvedValueOnce([
      { reason: "friend", _count: { _all: 2 }, _max: { updatedAt: at } },
      { reason: "bogus", _count: { _all: 9 }, _max: { updatedAt: at } },
    ]);
    prismaMock.business.findUnique.mockResolvedValueOnce({ notCustomerAlways: ["spam"] });
    const data = await (await GET()).json();
    expect(data.rows).toEqual([
      { reason: "friend", count: 2, latest: at.toISOString(), always: false },
      { reason: "spam", count: 0, latest: null, always: true },
    ]);
    expect(prismaMock.senderVerdict.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ businessId: "biz1" }) }));
  });

  it("needs a signed-in user", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("POST /api/not-customers (the answer to 'from now on')", () => {
  it("a yes adds the rule and marks it asked", async () => {
    const res = await POST(req("POST", { kind: "selling", always: true }));
    expect(await res.json()).toEqual({ success: true });
    expect(prismaMock.business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: { notCustomerAsked: ["selling"], notCustomerAlways: ["selling"] },
    });
  });

  it("'Just these' only marks it asked", async () => {
    await POST(req("POST", { kind: "spam", always: false }));
    expect(prismaMock.business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { notCustomerAsked: ["spam"], notCustomerAlways: [] } });
  });

  it("refuses a person as a rule, and anyone who isn't an admin", async () => {
    expect((await POST(req("POST", { kind: "friend", always: true }))).status).toBe(400);
    requireAdmin.mockResolvedValueOnce(false);
    expect((await POST(req("POST", { kind: "selling", always: true }))).status).toBe(403);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/not-customers (Undo)", () => {
  it("forgets everyone with that answer in this business, and drops the rule", async () => {
    prismaMock.business.findUnique.mockResolvedValueOnce({ notCustomerAlways: ["selling", "spam"] });
    const res = await DELETE(req("DELETE", { reason: "selling" }));
    expect(await res.json()).toEqual({ success: true });
    expect(prismaMock.senderVerdict.deleteMany).toHaveBeenCalledWith({ where: { businessId: "biz1", verdict: "not_customer", reason: "selling" } });
    expect(prismaMock.business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { notCustomerAlways: ["spam"] } });
  });

  it("is an admin's", async () => {
    requireAdmin.mockResolvedValueOnce(false);
    expect((await DELETE(req("DELETE", { reason: "friend" }))).status).toBe(403);
    expect(prismaMock.senderVerdict.deleteMany).not.toHaveBeenCalled();
  });
});
