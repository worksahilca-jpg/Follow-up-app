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

describe("runClassifierEval", () => {
  const two = EVAL_CASES.filter((c) => c.name.startsWith("price of a coat") || c.name === "newsletter");

  it("counts a right answer as a pass", async () => {
    const judge = vi.fn(async (_m, s: { email: string }) => ({ isProspect: !s.email.startsWith("noreply"), reason: "r" }));
    const r = await runClassifierEval(judge as never, two);
    expect(r).toEqual({ passed: 2, failed: 0, errors: 0, failures: [] });
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
