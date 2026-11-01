/**
 * Tests can never use up the AI credit real customers need (src/lib/testBudget.ts): a daily limit on what calls made
 * under the "test" tag may spend, checked before a run (with its price) and before each test call. Real customers'
 * calls are never stopped by it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create, aggregate } = vi.hoisted(() => ({ create: vi.fn(), aggregate: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { aiDecision: { aggregate }, testRun: { findMany: vi.fn(async () => []) } } }));

import { getClient, setAiCallSink, TestBudgetError, withAiContext } from "@/lib/integrations/openaiClient";
import { budgetVerdict, checkTestBudget, resetTestBudgetCache, testBudgetMicros, testCallAllowed } from "@/lib/testBudget";
import { runTest } from "@/lib/testRuns";

const spent = (micros: number) => aggregate.mockResolvedValue({ _sum: { costMicros: micros } });

beforeEach(() => {
  resetTestBudgetCache();
  aggregate.mockReset();
  create.mockReset();
  vi.unstubAllEnvs();
});
afterEach(() => setAiCallSink(null));

describe("the daily test limit", () => {
  it("is $10 unless set, and a bad setting falls back to $10", () => {
    expect(testBudgetMicros()).toBe(10_000_000);
    vi.stubEnv("TEST_DAILY_BUDGET_USD", "25");
    expect(testBudgetMicros()).toBe(25_000_000);
    vi.stubEnv("TEST_DAILY_BUDGET_USD", "nonsense");
    expect(testBudgetMicros()).toBe(10_000_000);
  });

  it("refuses a run once the limit is used, or when the run would go over it, and says why in plain words", () => {
    expect(budgetVerdict(2_000_000, 3_000_000, 10_000_000)).toBeNull();
    expect(budgetVerdict(10_000_000, 0, 10_000_000)).toMatch(/used today's limit \(\$10\.00 in 24 hours\)/);
    expect(budgetVerdict(8_000_000, 3_000_000, 10_000_000)).toMatch(/cost \$3\.00, and only \$2\.00 of today's \$10\.00/);
  });

  it("counts only calls tagged as tests, over the last 24 hours", async () => {
    spent(4_000_000);
    expect(await checkTestBudget(7_000_000)).toMatch(/only \$6\.00/);
    const where = aggregate.mock.calls[0][0].where;
    expect(where.purpose).toEqual({ startsWith: "test:" });
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
  });

  it("stops an accuracy run before it starts when it would go over, and never runs it", async () => {
    spent(9_900_000);
    const run = vi.fn();
    const cases = Array.from({ length: 40 }, (_, i) => ({ name: `case ${i}` }));
    const out = await runTest("conversations", {}, cases, run, () => 0);
    expect(out).toMatchObject({ ok: false, error: expect.stringMatching(/only \$0\.10 of today's \$10\.00/) });
    expect(run).not.toHaveBeenCalled();
  });

  it("lets a test call through when the total can't be read", async () => {
    aggregate.mockRejectedValue(new Error("db down"));
    expect(await testCallAllowed()).toBe(true);
  });
});

describe("at the one place every AI call goes through", () => {
  const ask = () => getClient("grade_chat").chat.completions.create({ model: "gpt-5.5", messages: [{ role: "user", content: "hi" }] });

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    create.mockResolvedValue({ id: "a", model: "gpt-5.5", usage: { prompt_tokens: 10, completion_tokens: 1 } });
    setAiCallSink({ call: async () => {}, choice: async () => {}, testCallAllowed });
  });

  it("stops a test's call once today's limit is used, without asking OpenAI", async () => {
    spent(10_000_000);
    await expect(withAiContext({ tag: "test" }, ask)).rejects.toBeInstanceOf(TestBudgetError);
    expect(create).not.toHaveBeenCalled();
  });

  it("never stops a real customer's call, whatever tests have spent", async () => {
    spent(50_000_000);
    await expect(withAiContext({ businessId: "b1", leadId: "l1" }, ask)).resolves.toMatchObject({ id: "a" });
    await expect(ask()).resolves.toMatchObject({ id: "a" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("lets a test's call through while there is limit left", async () => {
    spent(1_000_000);
    await expect(withAiContext({ tag: "test" }, ask)).resolves.toMatchObject({ id: "a" });
  });
});
