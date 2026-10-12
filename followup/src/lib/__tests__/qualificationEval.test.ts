/**
 * The qualifying accuracy test (src/lib/qualificationEval.ts). The test runs
 * against the real model; these only prove the harness scores honestly. A
 * harness that calls a made-up item "right" would hide the one mistake
 * FollowUp promises never to make.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/integrations/openai", () => ({ extractQualificationFacts: vi.fn() }));

import { QUAL_EVAL_CASES, runQualificationEval, type QualEvalCase } from "@/lib/qualificationEval";
import type { ExtractedItem } from "@/lib/qualification";

const KEYS = ["want", "timing", "budget", "viewing"] as const;
const noWait = { retry: { maxRetries: 0, sleep: async () => {} } };

describe("QUAL_EVAL_CASES", () => {
  it("has about fifty cases with unique names", () => {
    expect(QUAL_EVAL_CASES.length).toBeGreaterThanOrEqual(45);
    expect(new Set(QUAL_EVAL_CASES.map((c) => c.name)).size).toBe(QUAL_EVAL_CASES.length);
  });

  it("tests every item both ways, so a reader that always says yes, or always no, fails", () => {
    for (const k of KEYS) {
      expect(QUAL_EVAL_CASES.filter((c) => c.expect[k]).length, `${k} known`).toBeGreaterThanOrEqual(5);
      expect(QUAL_EVAL_CASES.filter((c) => !c.expect[k]).length, `${k} not known`).toBeGreaterThanOrEqual(5);
    }
  });

  it("includes customers who are ready, customers who say nothing, and other languages", () => {
    expect(QUAL_EVAL_CASES.some((c) => KEYS.every((k) => c.expect[k]))).toBe(true);
    expect(QUAL_EVAL_CASES.some((c) => KEYS.every((k) => !c.expect[k]))).toBe(true);
    expect(QUAL_EVAL_CASES.some((c) => c.lines.some(([, t]) => /[¿áéíóúñ]/.test(t)))).toBe(true);
  });

  it("every case has something the customer wrote", () => {
    for (const c of QUAL_EVAL_CASES) expect(c.lines.some(([who]) => who === "in"), c.name).toBe(true);
  });
});

const condo: QualEvalCase = {
  name: "condo under 600k",
  lines: [["in", "Looking for a condo in Leslieville under 600k"]],
  expect: { want: true, timing: false, budget: true, viewing: false },
};
const item = (key: ExtractedItem["key"], value: string, quote: string): ExtractedItem => ({ key, known: true, value, quote });

describe("runQualificationEval scoring", () => {
  it("counts a right answer, a made-up item, and a rejected quote separately", async () => {
    const read = vi.fn(async () => [
      item("want", "Condo in Leslieville", "condo in Leslieville"),
      item("budget", "Under $600k", "under 600k"),
      // Known, but the quote isn't theirs: dropped, so "not known", which is right here.
      item("timing", "Next week", "next week"),
      // Known, with a quote that IS in their words, but it isn't a viewing: made up.
      item("viewing", "Saturday", "Looking for"),
    ]);
    const r = await runQualificationEval(read, [condo], noWait);
    expect(r.items).toEqual({ total: 4, right: 3, madeUp: 1, missed: 0 });
    expect(r.quotesRejected).toBe(1);
    expect(r.casesRight).toBe(0);
    expect(r.readyRight).toBe(1);
    expect(r.failures).toEqual([expect.objectContaining({ name: "condo under 600k", item: "viewing", expected: "not known", got: "known" })]);
    expect(r.byItem.viewing).toEqual({ right: 0, total: 1 });
  });

  it("counts what the customer said but the reader missed", async () => {
    const read = vi.fn(async () => KEYS.map((key): ExtractedItem => ({ key, known: false, value: "", quote: "" })));
    const r = await runQualificationEval(read, [condo], noWait);
    expect(r.items).toEqual({ total: 4, right: 2, madeUp: 0, missed: 2 });
  });

  it("all right is one right case", async () => {
    const read = vi.fn(async () => [item("want", "Condo in Leslieville", "condo in Leslieville"), item("budget", "Under $600k", "under 600k")]);
    const r = await runQualificationEval(read, [condo], noWait);
    expect(r.casesRight).toBe(1);
    expect(r.failures).toEqual([]);
  });

  it("an error, or no answer at all, is an error, never a pass", async () => {
    const thrown = await runQualificationEval(vi.fn(async () => Promise.reject(new Error("boom"))), [condo], noWait);
    expect(thrown.errors).toBe(1);
    expect(thrown.items.total).toBe(0);
    const empty = await runQualificationEval(vi.fn(async () => null), [condo], noWait);
    expect(empty.errors).toBe(1);
    expect(empty.failures[0]).toMatchObject({ item: "error" });
  });

  it("reads the conversation as the live path does: the business's lines are not the customer's words", async () => {
    const offered: QualEvalCase = {
      name: "business offers a time",
      lines: [
        ["in", "Is 9 Pine Ct still for sale?"],
        ["out", "It is! Would Saturday at 2pm work for a viewing?"],
      ],
      expect: { want: true, timing: false, budget: false, viewing: false },
    };
    // The reader quotes the business: dropped, so not made up.
    const read = vi.fn(async () => [item("want", "9 Pine Ct", "9 Pine Ct"), item("viewing", "Saturday 2pm", "Saturday at 2pm")]);
    const r = await runQualificationEval(read, [offered], noWait);
    expect(r.items.madeUp).toBe(0);
    expect(r.quotesRejected).toBe(1);
    expect(read).toHaveBeenCalledWith([expect.objectContaining({ direction: "inbound" }), expect.objectContaining({ direction: "outbound" })], expect.any(Array));
  });
});
