/**
 * The eval harness itself (src/lib/classifierEval.ts). The eval runs
 * against the real model; these tests only prove the harness scores
 * honestly — a harness that reports green on a miss is worse than none.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));

import { EVAL_CASES, EVAL_CONCURRENCY, runClassifierEval } from "@/lib/classifierEval";

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
    // Not a rate limit, so not retried: a broken answer is reported at once.
    const judge = vi.fn(async () => {
      throw new Error("OpenAI returned no content for classifyAsProspect.");
    });
    const r = await runClassifierEval(judge as never, two);
    expect(r.passed).toBe(0);
    expect(r.errors).toBe(2);
    expect(judge).toHaveBeenCalledTimes(2);
  });
});

/**
 * Backlog b006: a run lost 20 of ~100 cases to "429 Rate limit reached",
 * each reported as an error though the classifier never got to answer.
 * The fake client below is shaped like the OpenAI SDK's APIError (status
 * 429, a fetch Headers) — no real call is made, and no real time passes.
 */
describe("runClassifierEval under the rate limit", () => {
  const two = EVAL_CASES.filter((c) => c.name.startsWith("price of a coat") || c.name === "newsletter");
  const rateLimited = (headers: Record<string, string> = {}) =>
    Object.assign(new Error("429 Rate limit reached for gpt-4o-mini on requests per min"), {
      status: 429,
      headers: new Headers(headers),
    });
  const noWait = () => {
    const waits: number[] = [];
    return { waits, sleep: vi.fn(async (ms: number) => void waits.push(ms)) };
  };

  it("waits out a 429 and scores the answer that follows, not an error", async () => {
    const refusedOnce = new Set<string>();
    const judge = vi.fn(async (_m, s: { email: string }) => {
      if (!refusedOnce.has(s.email)) {
        refusedOnce.add(s.email);
        throw rateLimited();
      }
      return { isProspect: !s.email.startsWith("noreply"), reason: "r" };
    });
    const { waits, sleep } = noWait();
    const r = await runClassifierEval(judge as never, two, { retry: { sleep, random: () => 0.5 } });

    expect(r).toMatchObject({ passed: 2, failed: 0, errors: 0, failures: [] });
    expect(judge).toHaveBeenCalledTimes(4);
    expect(waits).toHaveLength(2);
  });

  it("honours the provider's retry-after instead of its own guess", async () => {
    let calls = 0;
    const judge = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw rateLimited({ "retry-after": "7" });
      return { isProspect: true, reason: "r" };
    });
    const { waits, sleep } = noWait();
    await runClassifierEval(judge as never, two.slice(0, 1), { retry: { sleep } });
    expect(waits).toEqual([7_000]);
  });

  it("counts a case as an error only once its retries are used up", async () => {
    const judge = vi.fn(async () => {
      throw rateLimited();
    });
    const { waits, sleep } = noWait();
    const r = await runClassifierEval(judge as never, two.slice(0, 1), { retry: { sleep, maxRetries: 3, random: () => 0 } });

    expect(judge).toHaveBeenCalledTimes(4); // the first try and three retries, then it stops
    expect(waits).toHaveLength(3);
    expect(r.errors).toBe(1);
    expect(r.passed).toBe(0);
    expect(r.failures[0]).toMatchObject({ got: "error", reason: expect.stringMatching(/429/) });
  });

  it("never has more than a few cases in flight at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const judge = vi.fn(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return { isProspect: true, reason: "r" };
    });
    const r = await runClassifierEval(judge as never, EVAL_CASES.slice(0, 20));
    expect(EVAL_CONCURRENCY).toBeLessThanOrEqual(3);
    expect(peak).toBeLessThanOrEqual(EVAL_CONCURRENCY);
    expect(r.passed + r.failed).toBe(20);
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
