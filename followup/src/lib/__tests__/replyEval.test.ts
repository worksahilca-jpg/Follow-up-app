/**
 * The reply test (src/lib/replyEval.ts). The drafter and the grader are
 * the real model in a run; here both are stand-ins, so this proves only
 * that every way a reply can fail is caught and counted.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/dmDrafting", () => ({ draftDm: vi.fn() }));
vi.mock("@/lib/integrations/openaiClient", () => ({
  getClient: vi.fn(),
  MODEL: "test",
  withAiContext: (_where: unknown, run: () => Promise<unknown>) => run(),
}));

import { REPLY_CASES, runReplyEval, runReplyTries, type ReplyCase } from "@/lib/replyEval";

const noWait = { retry: { maxRetries: 0, sleep: async () => {} } };
const fee: ReplyCase = {
  name: "fee",
  lines: [["in", "how much do you charge and are you free this week?"]],
  asks: ["fee", "free this week"],
  facts: [{ label: "Commission", value: "My commission is 2.5% when I sell your home." }],
  mustInclude: ["2.5%"],
};
const draftOf = (body: string, shapeFailed: string | null = null) =>
  vi.fn(async () => ({ body, quickReplies: { question: "reply", buttons: [] }, shapeFailed })) as never;
type G = {
  answered: boolean[];
  invented: boolean;
  inventedWhat: string;
  sameLanguage: boolean;
  usedDetail: boolean;
  robotic: boolean;
  pushy: boolean;
  bragged: boolean;
  acknowledgedFeeling: boolean;
  inventedFeeling: boolean;
};
const GOOD: G = {
  answered: [true, true],
  invented: false,
  inventedWhat: "",
  sameLanguage: true,
  usedDetail: true,
  robotic: false,
  pushy: false,
  bragged: false,
  acknowledgedFeeling: true,
  inventedFeeling: false,
};
const gradeOf = (g: Partial<G>) => vi.fn(async () => ({ ...GOOD, ...g }));

describe("REPLY_CASES", () => {
  it("covers several questions at once, facts given and not, and other languages", () => {
    expect(REPLY_CASES.length).toBeGreaterThanOrEqual(12);
    expect(REPLY_CASES.some((c) => c.asks.length >= 2)).toBe(true);
    expect(REPLY_CASES.some((c) => c.facts?.length)).toBe(true);
    expect(REPLY_CASES.some((c) => !c.facts?.length)).toBe(true);
    expect(REPLY_CASES.some((c) => c.lines.some(([, t]) => /[¿ñá]|bhai|kitna/i.test(t)))).toBe(true);
    expect(new Set(REPLY_CASES.map((c) => c.name)).size).toBe(REPLY_CASES.length);
  });

  it("has a case for each trust rule a reply can break without inventing a fact (A-247)", () => {
    expect(REPLY_CASES.some((c) => c.feeling)).toBe(true);
    expect(REPLY_CASES.some((c) => c.closing)).toBe(true);
    expect(REPLY_CASES.some((c) => c.asks.length === 0 && !c.closing)).toBe(true);
  });

  it("every fact a case insists on is in that case's facts", () => {
    for (const c of REPLY_CASES) for (const w of c.mustInclude ?? []) expect((c.facts ?? []).some((f) => f.value.includes(w)), c.name).toBe(true);
  });
});

describe("runReplyEval scoring", () => {
  it("passes a reply that answers everything with the fact, in their language", async () => {
    const r = await runReplyEval(draftOf("My commission is 2.5%. I'll confirm my week and come back to you, what area are you selling in?"), gradeOf({}), [fee], noWait);
    expect(r).toMatchObject({ cases: 1, passed: 1, errors: 0, failures: [] });
  });

  it("counts each problem: unanswered, invented, wrong language, missing fact, shape, echo", async () => {
    const r = await runReplyEval(
      draftOf("Noted. I'm free Thursday, what area are you in?", "calendar"),
      gradeOf({ answered: [false, true], invented: true, inventedWhat: "free Thursday", sameLanguage: false }),
      [fee],
      noWait
    );
    expect(r.passed).toBe(0);
    expect(r.problems).toEqual({ shape: 1, unanswered: 1, invented: 1, language: 1, missing_fact: 1, echo: 1, pressure: 0, brag: 0, feeling: 0, generic: 0 });
    expect(r.failures[0]).toMatchObject({ name: "fee", reply: "Noted. I'm free Thursday, what area are you in?" });
    expect(r.failures[0].detail).toMatch(/not answered: fee/);
    expect(r.failures[0].detail).toMatch(/invented: free Thursday/);
  });

  it("counts the trust rules: pushed, bragged, a missed or made-up feeling, generic (A-247)", async () => {
    const tired: ReplyCase = { name: "tired", lines: [["in", "We've lost 3 offers and we're exhausted. Can you help?"]], asks: ["help"], feeling: true };
    const r = await runReplyEval(
      // The code check names the pressure; the reader names the brag.
      draftOf("I'm a top producer and you need to act fast, so are you free to talk today?"),
      gradeOf({ answered: [true], acknowledgedFeeling: false, usedDetail: false, bragged: true }),
      [tired],
      noWait
    );
    expect(r.problems).toMatchObject({ pressure: 1, brag: 1, feeling: 1, generic: 1 });
    expect(r.failures[0].detail).toMatch(/missed the feeling they named/);

    // The reader's verdicts count even when the code check finds nothing.
    const quiet = await runReplyEval(draftOf("Sorry to hear it, I'd love to hear how they went. Call or text?"), gradeOf({ answered: [true], pushy: true, inventedFeeling: true, robotic: true }), [tired], noWait);
    expect(quiet.problems).toMatchObject({ pressure: 1, brag: 0, feeling: 1, generic: 1 });
    expect(quiet.failures[0].detail).toMatch(/made up a feeling/);
  });

  it("after a no, any question is asking again", async () => {
    const no: ReplyCase = { name: "no", lines: [["in", "We already signed with another agent."]], asks: [], closing: true };
    const asked = await runReplyEval(draftOf("Thanks for letting me know. Would you keep me in mind for next time?"), gradeOf({ answered: [] }), [no], noWait);
    expect(asked.problems.pressure).toBe(1);
    expect(asked.failures[0].detail).toMatch(/asked again after a no/);
    const closed = await runReplyEval(draftOf("Thanks for letting me know. Good luck with the search, I hope it goes smoothly."), gradeOf({ answered: [] }), [no], noWait);
    expect(closed.passed).toBe(1);
  });

  it("a question with nothing of theirs in it can't fail for going to anyone, but a template still fails (2026-10-14)", async () => {
    const plain: ReplyCase = { name: "experience", lines: [["in", "How long have you been a realtor?"]], asks: ["experience"], noDetail: true };
    const ok = await runReplyEval(draftOf("Good question, I'll confirm that for you. Are you buying or selling?"), gradeOf({ answered: [true], usedDetail: false }), [plain], noWait);
    expect(ok.passed).toBe(1);
    const stock = await runReplyEval(draftOf("Thanks for reaching out! I'd be happy to help."), gradeOf({ answered: [true], usedDetail: false, robotic: true }), [plain], noWait);
    expect(stock.problems.generic).toBe(1);
    expect(stock.failures[0].detail).toMatch(/read like a template/);
  });

  it("the questions with nothing of theirs in them are marked, and only those", () => {
    expect(REPLY_CASES.filter((c) => c.noDetail).map((c) => c.name).sort()).toEqual(
      ["buyer's fee", "experience", "fee and availability, fee known", "fee and availability, nothing known", "wants to talk today"].sort()
    );
  });

  it("a ranking the owner stored is theirs to state", async () => {
    const award: ReplyCase = { ...fee, facts: [{ label: "Award", value: "Award-winning agent, TRREB 2025" }], mustInclude: [] };
    const r = await runReplyEval(draftOf("I'm an award-winning agent and I'll confirm my fee and my week for you. What area are you selling in?"), gradeOf({}), [award], noWait);
    expect(r.problems.brag).toBe(0);
  });

  it("a missing grade for a question counts as not answered", async () => {
    const r = await runReplyEval(draftOf("My commission is 2.5%, what area are you selling in?"), gradeOf({ answered: [true] }), [fee], noWait);
    expect(r.problems.unanswered).toBe(1);
  });

  it("drafts the way a live realtor DM reply is drafted", async () => {
    const draft = draftOf("My commission is 2.5%, what area are you selling in?");
    await runReplyEval(draft, gradeOf({}), [fee], noWait);
    expect(draft).toHaveBeenCalledWith("Sam", [expect.objectContaining({ direction: "inbound", channel: "instagram" })], [], undefined, "reply", null, fee.facts, null, "Real estate", [], []);
  });

  it("drafts with the realtor rules and examples it is given, as a live reply does (A-319)", async () => {
    const draft = draftOf("My commission is 2.5%, what area are you selling in?");
    const lessons = { examples: [{ customerSaid: "hi", reply: "Hi! Buying or selling?" }], rules: ["Answer about the home they named first."] };
    await runReplyEval(draft, gradeOf({}), [fee], { ...noWait, lessons });
    expect(draft).toHaveBeenCalledWith("Sam", expect.anything(), [], undefined, "reply", null, fee.facts, null, "Real estate", lessons.examples, lessons.rules);
  });

  it("answers each case as many times as asked, and keeps every try in order (A-319)", async () => {
    const draft = draftOf("My commission is 2.5%, what area are you selling in?");
    const out = await runReplyTries({ examples: [], rules: [] }, { tries: 3, concurrency: 2, draft, grade: gradeOf({}), cases: [fee], retry: noWait.retry });
    expect(draft).toHaveBeenCalledTimes(3);
    expect(out).toHaveLength(1);
    expect(out[0].tries).toHaveLength(3);
    expect(out[0].said).toBe(fee.lines[fee.lines.length - 1][1]);
  });

  it("a try that couldn't be written is kept as an error, never as a pass (A-319)", async () => {
    const draft = vi.fn(async () => Promise.reject(new Error("boom"))) as never;
    const out = await runReplyTries({ examples: [], rules: [] }, { tries: 2, concurrency: 2, draft, grade: gradeOf({}), cases: [fee], retry: noWait.retry });
    expect(out[0].tries.map((t) => t.error)).toEqual(["boom", "boom"]);
  });

  it("an error is an error, never a pass", async () => {
    const r = await runReplyEval(vi.fn(async () => Promise.reject(new Error("boom"))) as never, gradeOf({}), [fee], noWait);
    expect(r).toMatchObject({ passed: 0, errors: 1 });
  });
});
