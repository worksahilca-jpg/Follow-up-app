/**
 * /api/business/habits (A-099): Today's question goes to an admin only, and
 * only an admin can say yes, no, or Undo — a yes changes what FollowUp does
 * for the whole business. Every decision is held to the signed-in business.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { decideHabit, findHabitSuggestion, getHabits } = vi.hoisted(() => ({
  decideHabit: vi.fn(),
  findHabitSuggestion: vi.fn(),
  getHabits: vi.fn(),
}));
vi.mock("@/lib/habits", () => ({ decideHabit, findHabitSuggestion, getHabits, HABIT_KINDS: ["skip_thanks", "weekend_wait"] }));

import { GET, POST } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/habits", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  getHabits.mockResolvedValue([
    { kind: "skip_thanks", status: "on", evidence: 4, decidedAt: new Date("2026-10-06") },
    { kind: "weekend_wait", status: "declined", evidence: 5, decidedAt: new Date("2026-10-05") },
  ]);
  findHabitSuggestion.mockResolvedValue(null);
  decideHabit.mockResolvedValue({});
});

describe("GET", () => {
  it("lists only the habits that are on, for this business", async () => {
    const data = await (await GET()).json();
    expect(getHabits).toHaveBeenCalledWith("biz1");
    expect(data.habits).toEqual([{ kind: "skip_thanks", evidence: 4, decidedAt: "2026-10-06T00:00:00.000Z" }]);
  });

  it("never asks a teammate who isn't an admin", async () => {
    requireAdmin.mockResolvedValue(false);
    findHabitSuggestion.mockResolvedValue({ kind: "skip_thanks", count: 4, example: null });
    const data = await (await GET()).json();
    expect(findHabitSuggestion).not.toHaveBeenCalled();
    expect(data.suggestion).toBeNull();
  });

  it("refuses without a session", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });
});

describe("POST", () => {
  it("records an admin's yes for this business, and audits it", async () => {
    const res = await POST(req({ kind: "skip_thanks", decision: "on" }));
    expect(res.status).toBe(200);
    expect(decideHabit).toHaveBeenCalledWith("biz1", "u1", "skip_thanks", "on");
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "business.habit", expect.objectContaining({ meta: { kind: "skip_thanks", decision: "on" } }));
  });

  it("refuses anyone but an admin", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST(req({ kind: "skip_thanks", decision: "on" }))).status).toBe(403);
    expect(decideHabit).not.toHaveBeenCalled();
  });

  it("refuses a habit or decision it doesn't know", async () => {
    expect((await POST(req({ kind: "send_everything", decision: "on" }))).status).toBe(400);
    expect((await POST(req({ kind: "skip_thanks", decision: "maybe" }))).status).toBe(400);
    expect(decideHabit).not.toHaveBeenCalled();
  });

  it("slows down a flood of changes", async () => {
    tooManyRecentActions.mockResolvedValue(true);
    expect((await POST(req({ kind: "skip_thanks", decision: "off" }))).status).toBe(429);
  });
});
