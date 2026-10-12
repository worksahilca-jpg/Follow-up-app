/**
 * The reply test (src/lib/replyEval.ts). The drafter and the grader are
 * the real model in a run; here both are stand-ins, so this proves only
 * that every way a reply can fail is caught and counted.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/dmDrafting", () => ({ draftDm: vi.fn() }));
vi.mock("@/lib/integrations/openaiClient", () => ({ getClient: vi.fn(), MODEL: "test" }));

import { REPLY_CASES, runReplyEval, type ReplyCase } from "@/lib/replyEval";

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
const gradeOf = (g: Partial<{ answered: boolean[]; invented: boolean; inventedWhat: string; sameLanguage: boolean }>) =>
  vi.fn(async () => ({ answered: [true, true], invented: false, inventedWhat: "", sameLanguage: true, ...g }));

describe("REPLY_CASES", () => {
  it("covers several questions at once, facts given and not, and other languages", () => {
    expect(REPLY_CASES.length).toBeGreaterThanOrEqual(12);
    expect(REPLY_CASES.some((c) => c.asks.length >= 2)).toBe(true);
    expect(REPLY_CASES.some((c) => c.facts?.length)).toBe(true);
    expect(REPLY_CASES.some((c) => !c.facts?.length)).toBe(true);
    expect(REPLY_CASES.some((c) => c.lines.some(([, t]) => /[¿ñá]|bhai|kitna/i.test(t)))).toBe(true);
    expect(new Set(REPLY_CASES.map((c) => c.name)).size).toBe(REPLY_CASES.length);
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
    expect(r.problems).toEqual({ shape: 1, unanswered: 1, invented: 1, language: 1, missing_fact: 1, echo: 1 });
    expect(r.failures[0]).toMatchObject({ name: "fee", reply: "Noted. I'm free Thursday, what area are you in?" });
    expect(r.failures[0].detail).toMatch(/not answered: fee/);
    expect(r.failures[0].detail).toMatch(/invented: free Thursday/);
  });

  it("a missing grade for a question counts as not answered", async () => {
    const r = await runReplyEval(draftOf("My commission is 2.5%, what area are you selling in?"), gradeOf({ answered: [true] }), [fee], noWait);
    expect(r.problems.unanswered).toBe(1);
  });

  it("drafts the way a live realtor DM reply is drafted", async () => {
    const draft = draftOf("My commission is 2.5%, what area are you selling in?");
    await runReplyEval(draft, gradeOf({}), [fee], noWait);
    expect(draft).toHaveBeenCalledWith("Sam", [expect.objectContaining({ direction: "inbound", channel: "instagram" })], [], undefined, "reply", null, fee.facts, null, "Real estate");
  });

  it("an error is an error, never a pass", async () => {
    const r = await runReplyEval(vi.fn(async () => Promise.reject(new Error("boom"))) as never, gradeOf({}), [fee], noWait);
    expect(r).toMatchObject({ passed: 0, errors: 1 });
  });
});
