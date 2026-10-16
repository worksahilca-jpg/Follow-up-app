/**
 * "Before your call" (A-268): the door for the note. Signed in only, this business's call with this customer only,
 * and nothing sent from here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext, findFirst, getLeadById, currentCallBrief, tooManyRecentActions } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  findFirst: vi.fn(),
  getLeadById: vi.fn(),
  currentCallBrief: vi.fn(async () => ({ v: 1, messages: 1, wants: [], asked: [], open: [], mind: [], next: [] })),
  tooManyRecentActions: vi.fn(async () => false),
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/db", () => ({ prisma: { booking: { findFirst } } }));
vi.mock("@/lib/leads-data", () => ({ getLeadById }));
vi.mock("@/lib/callBriefStore", () => ({ currentCallBrief }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true), billingLockedMessage: vi.fn() }));

import { GET } from "@/app/api/leads/[id]/call-brief/route";
import { NextRequest } from "next/server";

const params = Promise.resolve({ id: "lead1" });
const call = (query = "?booking=bk1") => GET(new NextRequest(`http://localhost/api/leads/lead1/call-brief${query}`), { params });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  findFirst.mockResolvedValue({ id: "bk1", brief: null, lead: { qualification: null } });
  getLeadById.mockResolvedValue({ id: "lead1", name: "Aisha Rahman", conversation: [] });
  tooManyRecentActions.mockResolvedValue(false);
});

describe("GET /api/leads/[id]/call-brief", () => {
  it("refuses a stranger", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(currentCallBrief).not.toHaveBeenCalled();
  });

  it("asks which call", async () => {
    expect((await call("")).status).toBe(400);
  });

  it("looks the call up for this business and this customer only", async () => {
    await call();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "bk1", leadId: "lead1", businessId: "biz1", status: "confirmed" } }));
  });

  it("says not found for another business's call, without writing a note", async () => {
    findFirst.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(currentCallBrief).not.toHaveBeenCalled();
  });

  it("returns the note", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).brief).toEqual(expect.objectContaining({ v: 1 }));
    expect(currentCallBrief).toHaveBeenCalledWith(expect.objectContaining({ bookingId: "bk1", businessId: "biz1", leadId: "lead1" }));
  });

  it("slows down a loop", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    expect((await call()).status).toBe(429);
  });
});
