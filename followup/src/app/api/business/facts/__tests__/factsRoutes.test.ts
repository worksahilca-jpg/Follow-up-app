/**
 * "What FollowUp knows" in Settings (A-096): everyone on the team can read
 * it, only an admin changes it, and every read and write is held to the
 * signed-in business — a fact goes into replies sent in its name.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { fact, lead } = vi.hoisted(() => ({
  fact: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  lead: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: { businessFact: fact, lead } }));
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { GET, POST } from "../route";
import { PATCH, DELETE } from "../[id]/route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/facts", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  fact.findMany.mockResolvedValue([]);
  fact.create.mockResolvedValue({ id: "f9" });
  fact.updateMany.mockResolvedValue({ count: 1 });
  fact.deleteMany.mockResolvedValue({ count: 1 });
  lead.findMany.mockResolvedValue([]);
});

describe("reading the list", () => {
  it("shows this business's facts, with the customer each was learned from", async () => {
    fact.findMany.mockResolvedValue([
      { id: "f1", label: "Commission", value: "2.5%", source: "reply", sourceLeadId: "lead1", updatedAt: new Date("2026-10-05") },
      { id: "f2", label: "Area", value: "Toronto", source: "owner", sourceLeadId: null, updatedAt: new Date("2026-10-06") },
    ]);
    lead.findMany.mockResolvedValue([{ id: "lead1", name: "Ivy Sohal" }]);
    requireAdmin.mockResolvedValue(false);
    const data = await (await GET()).json();
    expect(fact.findMany.mock.calls[0][0].where).toEqual({ businessId: "biz1" });
    expect(lead.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["lead1"] }, businessId: "biz1" });
    expect(data.isAdmin).toBe(false);
    expect(data.facts.map((f: { learnedFrom: string | null }) => f.learnedFrom)).toEqual(["Ivy Sohal", null]);
    expect(data.facts[0]).not.toHaveProperty("sourceLeadId");
  });

  it("is for signed-in people only", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("changing it", () => {
  it("adds the owner's own fact", async () => {
    const res = await POST(req({ label: "  Showings ", value: "Weekdays  after 4" }));
    expect(res.status).toBe(200);
    expect(fact.create).toHaveBeenCalledWith({ data: { businessId: "biz1", label: "Showings", value: "Weekdays after 4", source: "owner" } });
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "business.fact.save", { targetType: "business_fact", targetId: "f9" });
  });

  it("replaces a fact with the same name instead of adding a twin", async () => {
    fact.findMany.mockResolvedValue([{ id: "f1", label: "Commission" }]);
    fact.update.mockResolvedValue({ id: "f1" });
    await POST(req({ label: "commission", value: "2%" }));
    expect(fact.update).toHaveBeenCalledWith({ where: { id: "f1" }, data: { label: "commission", value: "2%", source: "owner", sourceLeadId: null } });
    expect(fact.create).not.toHaveBeenCalled();
  });

  it("refuses empty and overlong entries", async () => {
    expect((await POST(req({ label: "", value: "x" }))).status).toBe(400);
    expect((await POST(req({ label: "x", value: "y".repeat(201) }))).status).toBe(400);
    expect(fact.create).not.toHaveBeenCalled();
  });

  it("refuses a 61st fact", async () => {
    fact.findMany.mockResolvedValue(Array.from({ length: 60 }, (_, i) => ({ id: `f${i}`, label: `L${i}` })));
    expect((await POST(req({ label: "New", value: "x" }))).status).toBe(409);
  });

  it("edits and removes only within this business", async () => {
    await PATCH(req({ label: "Commission", value: "2%" }), params("f1"));
    expect(fact.updateMany.mock.calls[0][0].where).toEqual({ id: "f1", businessId: "biz1" });
    expect(fact.updateMany.mock.calls[0][0].data).toEqual({ label: "Commission", value: "2%", source: "owner", sourceLeadId: null });
    await DELETE(req({}), params("f1"));
    expect(fact.deleteMany.mock.calls[0][0].where).toEqual({ id: "f1", businessId: "biz1" });
  });

  it("says not found for another business's fact", async () => {
    fact.updateMany.mockResolvedValue({ count: 0 });
    fact.deleteMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(req({ label: "A", value: "b" }), params("other"))).status).toBe(404);
    expect((await DELETE(req({}), params("other"))).status).toBe(404);
  });

  it("refuses a rename onto another fact's name", async () => {
    fact.findMany.mockResolvedValue([{ label: "Area" }]);
    expect((await PATCH(req({ label: "area", value: "b" }), params("f1"))).status).toBe(409);
    expect(fact.updateMany).not.toHaveBeenCalled();
  });

  it("is admin-only, signed-in only and rate limited", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST(req({ label: "A", value: "b" }))).status).toBe(403);
    expect((await PATCH(req({ label: "A", value: "b" }), params("f1"))).status).toBe(403);
    expect((await DELETE(req({}), params("f1"))).status).toBe(403);
    requireAdmin.mockResolvedValue(true);
    tooManyRecentActions.mockResolvedValue(true);
    expect((await POST(req({ label: "A", value: "b" }))).status).toBe(429);
    getSessionContext.mockResolvedValue(null);
    expect((await DELETE(req({}), params("f1"))).status).toBe(401);
    expect(fact.create).not.toHaveBeenCalled();
    expect(fact.deleteMany).not.toHaveBeenCalled();
  });
});
