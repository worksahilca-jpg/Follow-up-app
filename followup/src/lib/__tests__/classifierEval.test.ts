/**
 * The eval harness itself (src/lib/classifierEval.ts). The eval runs
 * against the real model; these tests only prove the harness scores
 * honestly — a harness that reports green on a miss is worse than none.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));

import { EVAL_CASES, runClassifierEval } from "@/lib/classifierEval";

describe("EVAL_CASES", () => {
  it("covers both sides, and includes today's live miss", () => {
    expect(EVAL_CASES.filter((c) => c.expectLead).length).toBeGreaterThanOrEqual(10);
    expect(EVAL_CASES.filter((c) => !c.expectLead).length).toBeGreaterThanOrEqual(10);
    expect(EVAL_CASES[0].name).toMatch(/live miss 2026-09-25/);
    expect(new Set(EVAL_CASES.map((c) => c.name)).size).toBe(EVAL_CASES.length);
  });
});

describe("EVAL_CASES, grown for the test businesses (2026-09-29)", () => {
  it("has about a hundred cases, balanced enough to catch a lean either way", () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(100);
    const leads = EVAL_CASES.filter((c) => c.expectLead).length;
    expect(leads / EVAL_CASES.length).toBeGreaterThan(0.4);
    expect(leads / EVAL_CASES.length).toBeLessThan(0.65);
  });

  it("covers many kinds of business, and languages other than English", () => {
    expect(new Set(EVAL_CASES.map((c) => c.business.industry)).size).toBeGreaterThanOrEqual(12);
    expect(EVAL_CASES.some((c) => /[\u0900-\u097F]/.test(c.messages.join(" ")))).toBe(true); // Devanagari
    expect(EVAL_CASES.some((c) => /[\u0600-\u06FF]/.test(c.messages.join(" ")))).toBe(true); // Arabic
  });

  it("the cases added on 2026-09-29 use only invented addresses", () => {
    for (const c of EVAL_CASES.slice(24)) expect(c.sender.email).toMatch(/example(\.com)?$/);
  });
});

describe("runClassifierEval", () => {
  const two = EVAL_CASES.filter((c) => c.name.startsWith("price of a coat") || c.name === "newsletter");

  it("counts a right answer as a pass", async () => {
    const judge = vi.fn(async (_m, s: { email: string }) => ({ isProspect: !s.email.startsWith("noreply"), reason: "r" }));
    const r = await runClassifierEval(judge as never, two);
    expect(r).toMatchObject({ passed: 2, failed: 0, errors: 0, failures: [] });
  });

  it("names the case, what was expected and what the model said", async () => {
    const judge = vi.fn(async () => ({ isProspect: false, reason: "not a customer of this business" }));
    const r = await runClassifierEval(judge as never, two);
    expect(r.failed).toBe(1);
    expect(r.failures[0]).toEqual({
      name: "price of a coat, trade unknown (live miss 2026-09-25)",
      expected: "lead",
      got: "set aside",
      reason: "not a customer of this business",
    });
  });

  it("reports a model error as an error, never a pass", async () => {
    const judge = vi.fn(async () => {
      throw new Error("rate limited");
    });
    const r = await runClassifierEval(judge as never, two);
    expect(r.passed).toBe(0);
    expect(r.errors).toBe(2);
  });
});

describe("the per-trade score", () => {
  it("counts right answers per kind of business", async () => {
    const two = EVAL_CASES.filter((c) => c.name.startsWith("price of a coat") || c.name === "newsletter");
    const judge = vi.fn(async () => ({ isProspect: true, reason: "r" }));
    const r = await runClassifierEval(judge as never, two);
    expect(r.byTrade).toEqual({ Other: { passed: 1, total: 1 }, "Real estate": { passed: 0, total: 1 } });
  });
});
