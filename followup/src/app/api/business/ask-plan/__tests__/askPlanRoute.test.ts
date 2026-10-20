/**
 * /api/business/ask-plan (A-302): what the owner asks a new buyer, in their words and order. Admin only, realtors
 * only, the model's reading checked by fixed rules before anything is kept, and a failed reading never saves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { proposeAskPlan } = vi.hoisted(() => ({ proposeAskPlan: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ proposeAskPlan }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { business: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "../route";
import { finishPlan, type AskPlan } from "@/lib/askPlan";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/ask-plan", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

const WORDS = "First if they're PR. Then their down payment, then which areas they want.";
const proposed = {
  steps: [
    { kind: "own" as const, label: "Status", question: "Are you a PR?", ask: "their status", find: "their status" },
    { kind: "own" as const, label: "Down payment", question: "How much have you saved for a down payment?", ask: "their down payment", find: "how much they saved" },
    { kind: "area" as const, label: "Areas", question: "", ask: "", find: "" },
  ],
  forCall: [],
};
const saved = (): AskPlan => finishPlan(WORDS, proposed)!;

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  proposeAskPlan.mockResolvedValue(proposed);
  prismaMock.business.findUnique.mockResolvedValue({ industry: "Real estate", askPlan: null, questionsSkipped: [] });
  prismaMock.business.update.mockResolvedValue({});
});

describe("the owner's words", () => {
  it("become their questions, in their order, with status kept for the call", async () => {
    const res = await POST(req({ words: WORDS }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.plan.steps.map((s: { label: string }) => s.label)).toEqual(["Down payment", "Areas", "When", "Pre-approval", "Their agent"]);
    expect(body.plan.forCall).toEqual(["Status"]);
    const data = prismaMock.business.update.mock.calls[0][0];
    expect(data.where).toEqual({ id: "biz1" });
    expect(data.data.askPlan.words).toBe(WORDS);
    expect(data.data.questionAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it("is audited without the words themselves", async () => {
    await POST(req({ words: WORDS }));
    expect(JSON.stringify(recordAudit.mock.calls)).not.toContain("down payment");
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ decision: "made", questions: 5, forCall: 1 });
  });

  it("saves nothing when FollowUp can't read them, and says to try again", async () => {
    proposeAskPlan.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ words: WORDS }));
    expect(res.status).toBe(503);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });

  it("saves nothing when there's nothing in them FollowUp may ask", async () => {
    proposeAskPlan.mockResolvedValue({ steps: [proposed.steps[0]], forCall: [] });
    const res = await POST(req({ words: "Only if they're PR" }));
    expect(res.status).toBe(422);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });

  it("counts toward the business's daily AI ceiling", async () => {
    tooManyRecentActions.mockImplementation(async (_b: string, action: string) => action === "ai.run");
    const res = await POST(req({ words: WORDS }));
    expect(res.status).toBe(429);
    expect(proposeAskPlan).not.toHaveBeenCalled();
  });

  it("can't be empty or very long", async () => {
    expect((await POST(req({ words: "  " }))).status).toBe(400);
    expect((await POST(req({ words: "x".repeat(601) }))).status).toBe(400);
  });
});

describe("who may change it", () => {
  it("only an admin, of a real estate business", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST(req({ words: WORDS }))).status).toBe(403);
    requireAdmin.mockResolvedValue(true);
    prismaMock.business.findUnique.mockResolvedValue({ industry: "Plumbing", askPlan: null, questionsSkipped: [] });
    expect((await POST(req({ words: WORDS }))).status).toBe(400);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });

  it("only someone signed in", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await POST(req({ words: WORDS }))).status).toBe(401);
  });
});

describe("the other changes", () => {
  it("'Not now' sets the question aside, and the next waits a day", async () => {
    await POST(req({ notNow: true }));
    const data = prismaMock.business.update.mock.calls[0][0].data;
    expect(data.questionsSkipped).toEqual(["What you ask a new buyer"]);
    expect(data.questionAfter.getTime()).toBeGreaterThan(Date.now());
    expect(proposeAskPlan).not.toHaveBeenCalled();
  });

  it("a new order is kept only when it is exactly the owner's questions", async () => {
    const plan = saved();
    prismaMock.business.findUnique.mockResolvedValue({ industry: "Real estate", askPlan: plan, questionsSkipped: [] });
    const keys = plan.steps.map((s) => s.key);
    const res = await POST(req({ order: [...keys].reverse() }));
    expect(res.status).toBe(200);
    expect(prismaMock.business.update.mock.calls[0][0].data.askPlan.steps[0].key).toBe("agent");

    prismaMock.business.update.mockClear();
    expect((await POST(req({ order: [...keys.slice(1), "own:other"] }))).status).toBe(409);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });

  it("'Use FollowUp's order instead' clears it", async () => {
    await POST(req({ clear: true }));
    expect(prismaMock.business.update.mock.calls[0][0].data).toHaveProperty("askPlan");
    expect(proposeAskPlan).not.toHaveBeenCalled();
  });
});
