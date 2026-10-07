/**
 * /api/business/question (A-101): the one question a day on Today. An answer
 * is saved as a fact the owner typed; "Not now" sets that question aside.
 * Either way the next one waits about a day. Admin only, held to the
 * signed-in business, and never a back door for any other fact.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { saveOwnerFact } = vi.hoisted(() => ({ saveOwnerFact: vi.fn() }));
vi.mock("@/lib/businessFacts", () => ({ saveOwnerFact }));
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { business: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/question", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  prismaMock.business.findUnique.mockResolvedValue({ industry: "Real estate", questionsSkipped: [] });
  prismaMock.business.update.mockResolvedValue({});
  saveOwnerFact.mockResolvedValue({ id: "fact1" });
});

describe("an answer", () => {
  it("is saved as the owner's fact, and the next question waits about a day", async () => {
    const before = Date.now();
    const res = await POST(req({ label: "What you do", answer: "I help families buy and sell homes in Brampton" }));
    expect((await res.json()).success).toBe(true);
    expect(saveOwnerFact).toHaveBeenCalledWith("biz1", "What you do", "I help families buy and sell homes in Brampton");
    const data = prismaMock.business.update.mock.calls[0][0];
    expect(data.where).toEqual({ id: "biz1" });
    expect(data.data.questionAfter.getTime()).toBeGreaterThanOrEqual(before + 19 * 3600_000);
    expect(data.data.questionsSkipped).toBeUndefined();
  });

  it("works for the trade's own questions", async () => {
    const res = await POST(req({ label: "Commission", answer: "2.5% of the sale price" }));
    expect(res.status).toBe(200);
  });

  it("says so when the list is full, and changes nothing", async () => {
    saveOwnerFact.mockResolvedValue(null);
    const res = await POST(req({ label: "Commission", answer: "2.5%" }));
    expect(res.status).toBe(409);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });
});

describe("Not now", () => {
  it("sets that question aside once, and waits until tomorrow", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ industry: "Real estate", questionsSkipped: ["Showings"] });
    await POST(req({ label: "Commission" }));
    expect(saveOwnerFact).not.toHaveBeenCalled();
    expect(prismaMock.business.update.mock.calls[0][0].data.questionsSkipped).toEqual(["Showings", "Commission"]);
    await POST(req({ label: "Showings" }));
    expect(prismaMock.business.update.mock.calls[1][0].data.questionsSkipped).toEqual(["Showings"]);
  });
});

describe("who may answer, and what", () => {
  it("is admin only", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST(req({ label: "Commission", answer: "2%" }))).status).toBe(403);
    expect(saveOwnerFact).not.toHaveBeenCalled();
  });

  it("refuses anyone not signed in", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await POST(req({ label: "Commission" }))).status).toBe(401);
  });

  it("is not a back door for any other fact", async () => {
    const res = await POST(req({ label: "Secret discount", answer: "50% off for everyone" }));
    expect(res.status).toBe(400);
    expect(saveOwnerFact).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    expect((await POST(req({ label: "Commission" }))).status).toBe(429);
  });
});
