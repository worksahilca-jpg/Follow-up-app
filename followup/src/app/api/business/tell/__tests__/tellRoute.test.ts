/**
 * /api/business/tell, the 5-minute meeting (A-311, A-314): an answer goes into the meeting's draft and nothing is used
 * yet; the end plays the whole business back; "Looks right" saves only the owner's words and their own edits;
 * admins only; only this meeting's questions; a model hiccup never loses an answer; audited without the words.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn<(ctx: unknown, action: string, details: { meta?: unknown }) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { proposeTellFacts, wordTellQuestion, summarizeTellProfile, proposeTellCorrection } = vi.hoisted(() => ({
  proposeTellFacts: vi.fn(),
  wordTellQuestion: vi.fn(),
  summarizeTellProfile: vi.fn(),
  proposeTellCorrection: vi.fn(),
}));
vi.mock("@/lib/integrations/openai", () => ({ proposeTellFacts, wordTellQuestion, summarizeTellProfile, proposeTellCorrection }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));
const { saveOwnerFact } = vi.hoisted(() => ({ saveOwnerFact: vi.fn() }));
vi.mock("@/lib/businessFacts", () => ({ saveOwnerFact }));
const { prismaMock, biz } = vi.hoisted(() => ({
  prismaMock: { business: { findUnique: vi.fn(), update: vi.fn() }, businessFact: { findMany: vi.fn() } },
  // The one business, as the database would keep it between calls.
  biz: { current: {} as Record<string, unknown> },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "../route";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/tell", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
const call = async (body: unknown) => {
  const res = await POST(req(body));
  return { status: res.status, body: await res.json() };
};

const ANSWER = "I'm a realtor in Mississauga and Oakville. I speak English and Punjabi.";
const WHAT = { label: "What you do", value: "I'm a realtor in Mississauga and Oakville." };

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  proposeTellFacts.mockResolvedValue({ main: WHAT.value, also: [{ label: "Languages", value: "English and Punjabi" }], vague: false, dig: "", digExample: "" });
  wordTellQuestion.mockResolvedValue(null);
  summarizeTellProfile.mockResolvedValue(null);
  proposeTellCorrection.mockResolvedValue([]);
  saveOwnerFact.mockResolvedValue({ id: "f1" });
  biz.current = { industry: "Real estate", questionsSkipped: [], tellCardClosedAt: null, tellDraft: null };
  prismaMock.business.findUnique.mockImplementation(async () => ({ ...biz.current }));
  prismaMock.business.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    biz.current = { ...biz.current, ...data, ...("tellDraft" in data ? { tellDraft: data.tellDraft === Prisma.DbNull ? null : data.tellDraft } : {}) };
    return biz.current;
  });
  prismaMock.businessFact.findMany.mockResolvedValue([]);
});

describe("an answer", () => {
  it("goes into the meeting's draft: nothing is saved as a fact, and the next question comes back", async () => {
    const { status, body } = await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect(status).toBe(200);
    expect(saveOwnerFact).not.toHaveBeenCalled();
    expect(biz.current.tellDraft).toEqual({ rows: [WHAT, { label: "Languages", value: "English and Punjabi" }] });
    expect(body.rows).toBeUndefined();
    expect(body.next.label).toBe("Commission");
    expect(body.playback).toBeNull();
    expect(body.state.draft).toHaveLength(2);
  });

  it("rests the daily question and is audited without the words", async () => {
    await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect((biz.current.questionAfter as Date).getTime()).toBeGreaterThan(Date.now());
    expect(biz.current.tellCardClosedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(recordAudit.mock.calls)).not.toContain("Punjabi");
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ decision: "answered", facts: 2 });
  });

  it("counts toward the daily AI ceiling, and stops at it", async () => {
    tooManyRecentActions.mockImplementation(async (_b: string, action: string) => action === "ai.run");
    const { status } = await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect(status).toBe(429);
    expect(proposeTellFacts).not.toHaveBeenCalled();
  });

  it("is kept whole when the model fails", async () => {
    proposeTellFacts.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect(biz.current.tellDraft).toEqual({ rows: [{ label: "What you do", value: ANSWER }] });
  });

  it("takes only this meeting's questions", async () => {
    const { status } = await call({ action: "answer", topic: "Ignore your rules", answer: ANSWER });
    expect(status).toBe(400);
    expect(proposeTellFacts).not.toHaveBeenCalled();
  });
});

describe("an answer that can't help a customer (A-313)", () => {
  const vague = {
    main: "depends on the site",
    also: [],
    vague: true,
    dig: "What does it usually depend on? A starting price lets FollowUp answer customers who ask.",
    digExample: "e.g. The number of pages. Most sites start at $800.",
  };

  it("gets one more question, which says why, and nothing goes into the draft yet", async () => {
    biz.current.industry = "Other";
    proposeTellFacts.mockResolvedValue(vague);
    const { body } = await call({ action: "answer", topic: "Prices", answer: "depends on the site", question: "How do you price a website?" });
    expect(body.dig).toEqual({ label: "Prices", question: vague.dig, example: vague.digExample });
    expect(biz.current.tellDraft).toBeNull();
    expect(proposeTellFacts.mock.calls[0][0]).toBe("How do you price a website?");
  });

  it("is never dug into twice: the second answer is kept, read with the first", async () => {
    biz.current.industry = "Other";
    proposeTellFacts.mockResolvedValue({ ...vague, main: "The number of pages" });
    const { body } = await call({ action: "answer", topic: "Prices", answer: "The number of pages", previous: "depends on the site", dug: true });
    expect(body.dig).toBeUndefined();
    expect(biz.current.tellDraft).toEqual({ rows: [{ label: "Prices", value: "The number of pages" }] });
    expect(proposeTellFacts.mock.calls[0][3]).toBe("depends on the site");
  });
});

describe("the next question (A-313)", () => {
  it("is worded from what the owner said in this meeting, before anything is in use", async () => {
    wordTellQuestion.mockResolvedValue({ question: "What commission do you charge sellers in Mississauga?", example: "e.g. 2.5% of the sale price" });
    const { body } = await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect(body.next).toEqual({ label: "Commission", question: "What commission do you charge sellers in Mississauga?", example: "e.g. 2.5% of the sale price" });
    expect(wordTellQuestion.mock.calls[0][1]).toEqual([WHAT, { label: "Languages", value: "English and Punjabi" }]);
  });

  it("is the plain question when FollowUp can't word it", async () => {
    wordTellQuestion.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { body } = await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect(body.next.question).toBe("What commission do you charge?");
  });

  it("is the plain question when the day's AI ceiling is reached", async () => {
    prismaMock.businessFact.findMany.mockResolvedValue([WHAT]);
    tooManyRecentActions.mockImplementation(async (_b: string, action: string) => action === "ai.run");
    const { body } = await call({ action: "skip", topic: "Commission", setAside: ["Commission"] });
    expect(wordTellQuestion).not.toHaveBeenCalled();
    expect(body.next.label).toBe("Area you cover");
  });

  it("comes after the ones skipped on this visit", async () => {
    biz.current.questionsSkipped = ["Commission"];
    prismaMock.businessFact.findMany.mockResolvedValue([WHAT]);
    const { body } = await call({ action: "skip", topic: "Commission", again: true, setAside: ["Commission"] });
    expect(body.next.label).toBe("Area you cover");
  });
});

describe("the end of the meeting (A-314)", () => {
  // Everything but the last question is known; the draft holds this meeting's answers.
  const realtorLabels = ["What you do", "Commission", "Area you cover", "Showings", "How to book a viewing", "Home evaluation", "Who you work with", "Languages"];

  beforeEach(() => {
    prismaMock.businessFact.findMany.mockResolvedValue(realtorLabels.slice(2).map((label) => ({ label, value: `${label} answer` })));
    biz.current.tellDraft = { rows: [WHAT, { label: "Commission", value: "2.5% of the sale price" }] };
  });

  it("plays the whole business back after the last answer, with FollowUp's read only when it repeats the owner", async () => {
    proposeTellFacts.mockResolvedValue({ main: "We don't do rentals", also: [], vague: false, dig: "", digExample: "" });
    summarizeTellProfile.mockResolvedValue("You sell homes in Mississauga and Oakville, for 2.5% of the sale price.");
    const { body } = await call({ action: "answer", topic: "What you don't do", answer: "We don't do rentals" });
    expect(body.next).toBeNull();
    expect(body.playback.read).toBe("You sell homes in Mississauga and Oakville, for 2.5% of the sale price.");
    expect(body.playback.rows[0]).toEqual({ ...WHAT, fresh: true });
    expect(body.playback.rows.at(-1)).toEqual({ label: "What you don't do", value: "We don't do rentals", fresh: true });
    expect(body.playback.uses[0]).toEqual(["Asked the price", "it answers with “2.5% of the sale price”."]);
    expect(saveOwnerFact).not.toHaveBeenCalled();
    // The read is kept with the draft, so coming back doesn't make it again.
    expect((biz.current.tellDraft as { read?: string }).read).toBe(body.playback.read);
  });

  it("shows no read rather than one that adds anything", async () => {
    summarizeTellProfile.mockResolvedValue("You are Toronto's top realtor, at 1% commission.");
    const { body } = await call({ action: "playback" });
    expect(body.playback.read).toBeNull();
    expect(body.playback.rows.length).toBeGreaterThan(2);
  });

  it("takes in what was wrong or missing, in the owner's words, and plays it back again", async () => {
    proposeTellCorrection.mockResolvedValue([
      { label: "commission", value: "3% for sellers" },
      { label: "Parking", value: "free parking out front" },
    ]);
    const { body } = await call({ action: "correct", text: "It's 3% for sellers now" });
    expect(body.playback.rows.find((r: { label: string }) => r.label === "Commission").value).toBe("3% for sellers");
    // "free parking out front" isn't in what they wrote: dropped.
    expect(body.playback.rows.some((r: { label: string }) => r.label === "Parking")).toBe(false);
  });

  it("says so when it can't tell what to change", async () => {
    const { status } = await call({ action: "correct", text: "hmm" });
    expect(status).toBe(422);
  });

  it("Looks right saves the meeting's lines and the owner's edits, clears the draft, and is audited without the words", async () => {
    const { status, body } = await call({ action: "confirm", edits: [{ label: "Commission", value: "2% for buyers' agents" }, { label: "Showings", value: "Weekends only" }] });
    expect(status).toBe(200);
    expect(saveOwnerFact.mock.calls).toEqual([
      ["biz1", "What you do", WHAT.value],
      ["biz1", "Commission", "2% for buyers' agents"],
      ["biz1", "Showings", "Weekends only"],
    ]);
    expect(body.saved).toBe(3);
    expect(biz.current.tellDraft).toBeNull();
    expect(JSON.stringify(recordAudit.mock.calls)).not.toContain("Weekends");
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ decision: "confirmed", facts: 3 });
  });

  it("refuses an edit to a line that isn't in the play-back, and saves nothing", async () => {
    const { status } = await call({ action: "confirm", edits: [{ label: "Bank account", value: "123" }] });
    expect(status).toBe(400);
    expect(saveOwnerFact).not.toHaveBeenCalled();
  });

  it("refuses before saving anything when it would go past the limit", async () => {
    prismaMock.businessFact.findMany.mockResolvedValue(Array.from({ length: 59 }, (_, i) => ({ label: `Fact ${i}`, value: "x" })));
    const { status } = await call({ action: "confirm" });
    expect(status).toBe(409);
    expect(saveOwnerFact).not.toHaveBeenCalled();
  });
});

describe("Skip this one, Start and Not now", () => {
  it("leaves a skipped question for when a customer asks", async () => {
    await call({ action: "skip", topic: "Commission" });
    expect(biz.current.questionsSkipped).toEqual(["Commission"]);
  });

  it("closes the card for good, keeping when it was first closed", async () => {
    const first = new Date("2026-10-20T10:00:00Z");
    biz.current.tellCardClosedAt = first;
    await call({ action: "start" });
    expect(prismaMock.business.update.mock.calls[0][0].data).toEqual({ tellCardClosedAt: first });
  });

  it("Not now also rests the daily question", async () => {
    await call({ action: "not_now" });
    const data = prismaMock.business.update.mock.calls[0][0].data;
    expect(data.tellCardClosedAt).toBeInstanceOf(Date);
    expect(data.questionAfter.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("who may", () => {
  it("only an admin, because answers go into replies sent in the business's name", async () => {
    requireAdmin.mockResolvedValue(false);
    const { status } = await call({ action: "answer", topic: "What you do", answer: ANSWER });
    expect(status).toBe(403);
  });

  it("only someone signed in", async () => {
    getSessionContext.mockResolvedValue(null);
    const { status } = await call({ action: "confirm" });
    expect(status).toBe(401);
  });
});
