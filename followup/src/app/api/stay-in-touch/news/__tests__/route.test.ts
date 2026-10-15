/**
 * Today's "Anything new for the customers staying in touch?" (A-260): an
 * admin's answer writes held notes; "Not now" waits; nobody else may.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { business } = vi.hoisted(() => ({ business: { update: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: { business } }));
const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => true) }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { writeStayNotes, newsNotNow } = vi.hoisted(() => ({ writeStayNotes: vi.fn(), newsNotNow: vi.fn(async () => {}) }));
vi.mock("@/lib/stayInTouchData", () => ({ writeStayNotes, newsNotNow }));

import { POST } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/stay-in-touch/news", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  business.update.mockResolvedValue({});
  writeStayNotes.mockResolvedValue({ fit: ["Anika"], notFit: [{ first: "Tom", why: "wants a condo" }], notDue: 0, waiting: 0, unreachable: 0 });
});

describe("the owner's news", () => {
  it("writes the notes and says who they were for", async () => {
    const res = await POST(req({ text: "A 4-bed in Glen Abbey just listed at $1.19M." }));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(writeStayNotes).toHaveBeenCalledWith({ businessId: "biz1", userId: "u1" }, "A 4-bed in Glen Abbey just listed at $1.19M.");
    expect(out.lines[0]).toMatch(/It fits Anika/);
    expect(out.lines[1]).toMatch(/Nothing for Tom this time/);
    expect(business.update.mock.calls[0][0].data.questionAfter).toBeInstanceOf(Date);
  });

  it("'Not now' writes nothing and waits", async () => {
    const res = await POST(req({ notNow: true }));
    expect(res.status).toBe(200);
    expect(newsNotNow).toHaveBeenCalledWith("biz1");
    expect(writeStayNotes).not.toHaveBeenCalled();
  });

  it("is an admin's, because the notes go out in the business's name", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST(req({ text: "A 4-bed in Glen Abbey just listed." }))).status).toBe(403);
    getSessionContext.mockResolvedValue(null);
    expect((await POST(req({ text: "A 4-bed in Glen Abbey just listed." }))).status).toBe(401);
    expect(writeStayNotes).not.toHaveBeenCalled();
  });

  it("needs a real sentence, and not too long", async () => {
    expect((await POST(req({ text: "hi" }))).status).toBe(400);
    expect((await POST(req({ text: "x".repeat(501) }))).status).toBe(400);
    expect(writeStayNotes).not.toHaveBeenCalled();
  });

  it("is limited per hour: each answer runs one AI note per customer", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    expect((await POST(req({ text: "A 4-bed in Glen Abbey just listed." }))).status).toBe(429);
  });
});
