/**
 * The qualifying accuracy test (src/lib/qualificationEval.ts). The test runs
 * against the real model; these only prove the harness scores honestly. A
 * harness that calls a made-up item "right" would hide the one mistake
 * FollowUp promises never to make, and one that ignores a wrong label would
 * hide a buzz about the wrong customer.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/integrations/openai", () => ({ extractQualificationFacts: vi.fn() }));

import { QUAL_EVAL_CASES, QUAL_EVAL_TODAY, runQualificationEval, type QualEvalCase } from "@/lib/qualificationEval";
import type { CriterionKey, ExtractedItem } from "@/lib/qualification";

const noWait = { retry: { maxRetries: 0, sleep: async () => {} } };
const ASKED: CriterionKey[] = ["side", "area", "timing", "financing", "budget", "agent", "viewing", "home", "why", "price"];

describe("QUAL_EVAL_CASES", () => {
  it("has over fifty cases with unique names", () => {
    expect(QUAL_EVAL_CASES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(QUAL_EVAL_CASES.map((c) => c.name)).size).toBe(QUAL_EVAL_CASES.length);
  });

  it("tests every asked item both ways, so a reader that always says yes, or always no, fails", () => {
    for (const k of ASKED) {
      const scored = QUAL_EVAL_CASES.filter((c) => !(c.expect.skip ?? []).includes(k));
      expect(scored.filter((c) => c.expect.known.includes(k)).length, `${k} known`).toBeGreaterThanOrEqual(k === "agent" || k === "why" || k === "price" ? 2 : 4);
      expect(scored.filter((c) => !c.expect.known.includes(k)).length, `${k} not known`).toBeGreaterThanOrEqual(5);
    }
  });

  it("checks every sorting label, buyers and sellers, ready and not, and other languages", () => {
    const labels = QUAL_EVAL_CASES.flatMap((c) => Object.entries(c.expect.buckets ?? {}).map(([k, v]) => `${k}:${v}`));
    for (const l of ["side:buy", "side:rent", "side:sell", "side:both", "timing:soon", "timing:months", "timing:later", "financing:sorted", "financing:not_yet", "agent:has", "agent:none"]) {
      expect(labels, l).toContain(l);
    }
    expect(QUAL_EVAL_CASES.some((c) => c.expect.known.length === 0)).toBe(true);
    expect(QUAL_EVAL_CASES.some((c) => c.lines.some(([, t]) => /[¿áéíóúñ]/.test(t)))).toBe(true);
  });

  it("every case has something the customer wrote, and a label is only given for something they told", () => {
    for (const c of QUAL_EVAL_CASES) {
      expect(c.lines.some(([who]) => who === "in"), c.name).toBe(true);
      for (const k of Object.keys(c.expect.buckets ?? {})) expect(c.expect.known, `${c.name}: ${k}`).toContain(k);
    }
  });
});

const condo: QualEvalCase = {
  name: "a condo in Leslieville, soon",
  lines: [["in", "Looking to buy a condo in Leslieville next month, under 600k"]],
  expect: { known: ["side", "area", "timing", "budget", "kind"], buckets: { side: "buy", timing: "soon" } },
};
const item = (key: ExtractedItem["key"], value: string, quote: string, bucket?: string): ExtractedItem => ({ key, known: true, value, quote, ...(bucket ? { bucket } : {}) });
const RIGHT = [
  item("side", "Buying", "Looking to buy", "buy"),
  item("area", "Leslieville", "in Leslieville"),
  item("timing", "Next month", "next month", "soon"),
  item("budget", "Under $600k", "under 600k"),
  item("kind", "Condo", "a condo"),
];

describe("runQualificationEval scoring", () => {
  it("counts a right answer, a made-up item, a rejected quote and a wrong label separately", async () => {
    const read = vi.fn(async () => [
      ...RIGHT.filter((i) => i.key !== "timing"),
      // The wrong label: they said next month.
      item("timing", "Next month", "next month", "later"),
      // Known, but the quote isn't theirs: dropped, so "not known", which is right here.
      item("financing", "Pre-approved", "pre-approved"),
      // Known, with a quote that IS in their words, but it isn't a viewing: made up.
      item("viewing", "Next month", "next month"),
    ]);
    const r = await runQualificationEval(read, [condo], noWait);
    expect(r.items).toEqual({ total: 13, right: 12, madeUp: 1, missed: 0 });
    expect(r.quotesRejected).toBe(1);
    expect(r.sorting).toEqual({ right: 1, total: 2 });
    expect(r.casesRight).toBe(0);
    expect(r.failures.map((f) => f.item)).toEqual(["viewing", "timing label", "where they stand"]);
    expect(r.byItem.viewing).toEqual({ right: 0, total: 1 });
    expect(read).toHaveBeenCalledWith(expect.any(Array), expect.any(Array), QUAL_EVAL_TODAY);
  });

  it("counts what the customer said but the reader missed", async () => {
    const r = await runQualificationEval(vi.fn(async () => []), [condo], noWait);
    expect(r.items).toEqual({ total: 13, right: 8, madeUp: 0, missed: 5 });
    expect(r.sorting).toEqual({ right: 0, total: 2 });
  });

  it("all right is one right case, and where they stand comes out the same", async () => {
    const r = await runQualificationEval(vi.fn(async () => RIGHT), [condo], noWait);
    expect(r.casesRight).toBe(1);
    expect(r.tierRight).toBe(1);
    expect(r.tierTotal).toBe(1);
    expect(r.failures).toEqual([]);
  });

  it("skips what the case marks as debatable", async () => {
    const skipped: QualEvalCase = { ...condo, expect: { ...condo.expect, skip: ["kind"] } };
    const r = await runQualificationEval(vi.fn(async () => RIGHT.filter((i) => i.key !== "kind")), [skipped], noWait);
    expect(r.items.total).toBe(12);
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
      expect: { known: ["side", "area"], buckets: { side: "buy" } },
    };
    // The reader quotes the business: dropped, so not made up.
    const read = vi.fn(async () => [item("side", "Buying", "still for sale", "buy"), item("area", "9 Pine Ct", "9 Pine Ct"), item("viewing", "Saturday 2pm", "Saturday at 2pm")]);
    const r = await runQualificationEval(read, [offered], noWait);
    expect(r.items.madeUp).toBe(0);
    expect(r.quotesRejected).toBe(1);
    expect(read).toHaveBeenCalledWith(
      [expect.objectContaining({ direction: "inbound" }), expect.objectContaining({ direction: "outbound" })],
      expect.any(Array),
      QUAL_EVAL_TODAY
    );
  });
});
