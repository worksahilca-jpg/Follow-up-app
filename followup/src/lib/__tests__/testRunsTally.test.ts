/**
 * The cost of an accuracy-test run is counted call by call as it happens (src/lib/integrations/openaiClient.ts) and
 * priced with the decision log's rates (src/lib/testRuns.ts), so the founder sees what a run cost.
 */
import { describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

import { getClient, setAiCallSink, withAiContext } from "@/lib/integrations/openaiClient";
import { runCounted, tallyCostMicros } from "@/lib/testRuns";

describe("counting a test run's calls", () => {
  it("prices the tokens each model used, and leaves out a model with no known price", () => {
    // gpt-5.5: $5 in, $30 out per million tokens.
    expect(tallyCostMicros({ calls: 2, tokens: { "gpt-5.5-2026-04-01": { input: 1000, output: 200 } } })).toBe(11_000);
    expect(tallyCostMicros({ calls: 1, tokens: { "made-up-model": { input: 1000, output: 200 } } })).toBeNull();
  });

  it("counts every call made inside a run, nested contexts included, a failed one with no tokens, all tagged as a test", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const purposes: string[] = [];
    setAiCallSink({ call: async (c) => void purposes.push(c.purpose), choice: async () => {} });
    create.mockResolvedValueOnce({ id: "a", model: "gpt-5.5", usage: { prompt_tokens: 100, completion_tokens: 10 } });
    create.mockResolvedValueOnce({ id: "b", model: "gpt-5.5", usage: { prompt_tokens: 50, completion_tokens: 5 } });
    create.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }));
    create.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }));
    const ask = (purpose: string) => getClient(purpose).chat.completions.create({ model: "gpt-5.5", messages: [{ role: "user", content: "hi" }] });
    const { tally } = await runCounted(async () => {
      await ask("grade_chat");
      await withAiContext({ leadId: null }, () => ask("grade_chat"));
      await ask("grade_chat").catch(() => null);
    });
    setAiCallSink(null);
    expect(tally.calls).toBeGreaterThanOrEqual(3);
    expect(tally.tokens["gpt-5.5"]).toEqual({ input: 150, output: 15 });
    expect(purposes.every((p) => p.startsWith("test:"))).toBe(true);
  });
});
