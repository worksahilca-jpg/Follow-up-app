/**
 * The decision log (step 1 of research/product/2026-10-23-self-improving-loop.md): every AI call gets a row with the
 * job, the business and customer, the model asked and the dated version that answered, the cost and what it decided,
 * and never the words of the prompt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { create, prisma } = vi.hoisted(() => ({
  create: vi.fn(),
  prisma: { aiDecision: { create: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma }));

import { getClient, noteAiChoice, setAiCallSink, withAiContext, FALLBACK_MODEL, type AiCall } from "@/lib/integrations/openaiClient";
import { estimateCostMicros, installAiDecisionLog, saveAiCall, saveAiChoice } from "@/lib/aiDecisionLog";

const sink = { call: vi.fn<(c: AiCall) => Promise<void>>(), choice: vi.fn<(id: string, choice: string) => Promise<void>>() };
const answer = { id: "chatcmpl-1", model: "gpt-4o-mini-2024-07-18", usage: { prompt_tokens: 1200, completion_tokens: 80 } };
const ask = (purpose?: string, lessons?: Parameters<typeof getClient>[1], said = "Is the condo on King St still available?") =>
  getClient(purpose, lessons).chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: said }] });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  create.mockResolvedValue(answer);
  sink.call.mockResolvedValue(undefined);
  sink.choice.mockResolvedValue(undefined);
  setAiCallSink(sink);
});
afterEach(() => setAiCallSink(null));

describe("every AI call gets a row", () => {
  it("names the job, the model asked and the dated version that answered, the tokens and the time", async () => {
    await ask("score_lead");
    expect(sink.call).toHaveBeenCalledTimes(1);
    const row = sink.call.mock.calls[0][0];
    expect(row).toMatchObject({
      purpose: "score_lead",
      businessId: null,
      leadId: null,
      modelRequested: "gpt-4o-mini",
      modelUsed: "gpt-4o-mini-2024-07-18",
      fellBack: false,
      ok: true,
      errorStatus: null,
      inputTokens: 1200,
      outputTokens: 80,
      lessonsHash: null,
      rules: null,
      examples: null,
      responseId: "chatcmpl-1",
    });
    expect(row.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("keeps the prompt only as a fingerprint: never the customer's words, and the same prompt has the same one", async () => {
    await ask("draft_reply");
    await ask("draft_reply");
    await ask("draft_reply", undefined, "Do you have anything in Leslieville?");
    const [a, b, c] = sink.call.mock.calls.map((call) => call[0]);
    expect(JSON.stringify(a)).not.toContain("King St");
    expect(a.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.promptHash).toBe(b.promptHash);
    expect(c.promptHash).not.toBe(a.promptHash);
  });

  it("tells one set of rules and examples from another, by fingerprint and count", async () => {
    await ask("draft_reply", { rules: ["Answer about the home first."], examples: [{ customerSaid: "hi", reply: "Hi!" }] });
    await ask("draft_reply", { rules: ["Answer about the home first.", "Offer a call last."] });
    const [one, two] = sink.call.mock.calls.map((call) => call[0]);
    expect(one).toMatchObject({ rules: 1, examples: 1 });
    expect(two).toMatchObject({ rules: 2, examples: 0 });
    expect(one.lessonsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(one.lessonsHash).not.toBe(two.lessonsHash);
  });

  it("knows the business and customer when the caller says, and marks test and practice runs apart", async () => {
    await withAiContext({ businessId: "b1" }, () => withAiContext({ leadId: "l1" }, () => ask("draft_reply")));
    await withAiContext({ tag: "test" }, () => ask("grade_reply"));
    const [live, test] = sink.call.mock.calls.map((call) => call[0]);
    expect(live).toMatchObject({ businessId: "b1", leadId: "l1", purpose: "draft_reply" });
    expect(test).toMatchObject({ businessId: null, purpose: "test:grade_reply" });
  });

  it("logs a failed call as failed, with its status, and still fails the call", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }));
    await expect(ask("score_lead")).rejects.toThrow("rate limited");
    expect(sink.call.mock.calls[0][0]).toMatchObject({ ok: false, errorStatus: 429, modelUsed: null, responseId: null });
  });

  it("writes with the model a reply test is trying, and only the writing jobs: the grader keeps the usual one", async () => {
    await withAiContext({ tag: "test", writeWith: "gpt-5.4" }, async () => {
      await ask("draft_reply");
      await ask("draft_first_reply");
      await ask("grade_reply");
    });
    expect(create.mock.calls.map((call) => call[0].model)).toEqual(["gpt-5.4", "gpt-5.4", "gpt-4o-mini"]);
    expect(sink.call.mock.calls.map((call) => call[0].modelRequested)).toEqual(["gpt-5.4", "gpt-5.4", "gpt-4o-mini"]);
    await ask("draft_reply");
    expect(create.mock.calls[3][0].model).toBe("gpt-5.5"); // outside a test, replies are written by the reply model
  });

  it("never quietly falls back while a model is being tried: the test must not score the old model under the new name", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("unknown model"), { status: 404 }));
    await expect(withAiContext({ tag: "test", writeWith: "gpt-5.4" }, () => ask("draft_reply"))).rejects.toThrow("unknown model");
    expect(create).toHaveBeenCalledTimes(1);
    expect(sink.call.mock.calls[0][0]).toMatchObject({ modelRequested: "gpt-5.4", ok: false, fellBack: false });
  });

  it("logs a call the known-good model answered after the chosen one refused it as one row, fallen back", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("unknown model"), { status: 404 })).mockResolvedValueOnce(answer);
    await getClient("draft_reply").chat.completions.create({ model: "gpt-9-imaginary", messages: [] });
    expect(sink.call).toHaveBeenCalledTimes(1);
    expect(sink.call.mock.calls[0][0]).toMatchObject({ modelRequested: "gpt-9-imaginary", modelUsed: answer.model, fellBack: true, ok: true });
    expect(create.mock.calls[1][0].model).toBe(FALLBACK_MODEL);
  });

  it("never holds up or breaks a reply when the log can't save", async () => {
    sink.call.mockRejectedValueOnce(new Error("database down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(ask("draft_reply")).resolves.toBe(answer);
    expect(warn).toHaveBeenCalledWith("AI decision log: couldn't save a row:", "database down");
  });

  it("writes nothing when no log is installed, as in tests and scripts", async () => {
    setAiCallSink(null);
    await ask("draft_reply");
    await noteAiChoice("chatcmpl-1", "hot");
    expect(sink.call).not.toHaveBeenCalled();
    expect(sink.choice).not.toHaveBeenCalled();
  });
});

describe("what a call decided", () => {
  it("is added to its row by OpenAI's id for the answer, and only when there is one", async () => {
    await noteAiChoice("chatcmpl-1", "hold");
    await noteAiChoice(undefined, "hold");
    expect(sink.choice).toHaveBeenCalledTimes(1);
    expect(sink.choice).toHaveBeenCalledWith("chatcmpl-1", "hold");
  });
});

describe("the rows in the database", () => {
  it("estimates the cost from the version that answered, in millionths of a dollar", async () => {
    prisma.aiDecision.create.mockResolvedValue({});
    await saveAiCall({ ...rowOf(), modelUsed: "gpt-4o-mini-2024-07-18", inputTokens: 1_000_000, outputTokens: 100_000 });
    expect(prisma.aiDecision.create.mock.calls[0][0].data).toMatchObject({ purpose: "draft_reply", costMicros: 210_000 });
  });

  it("keeps a decision to a short label", async () => {
    prisma.aiDecision.updateMany.mockResolvedValue({ count: 1 });
    await saveAiChoice("chatcmpl-1", "x".repeat(100));
    expect(prisma.aiDecision.updateMany).toHaveBeenCalledWith({ where: { responseId: "chatcmpl-1" }, data: { choice: "x".repeat(40) } });
  });

  it("is what the server installs", async () => {
    installAiDecisionLog();
    prisma.aiDecision.create.mockResolvedValue({});
    await ask("score_lead");
    expect(prisma.aiDecision.create).toHaveBeenCalledTimes(1);
  });
});

describe("estimateCostMicros", () => {
  it("prices a model and its dated versions, and never guesses one it doesn't know", () => {
    expect(estimateCostMicros("gpt-4o-mini", 1_000_000, 0)).toBe(150_000);
    expect(estimateCostMicros("gpt-4o-mini-2024-07-18", 0, 1_000_000)).toBe(600_000);
    expect(estimateCostMicros("gpt-4o-2024-08-06", 1_000_000, 0)).toBe(2_500_000);
    expect(estimateCostMicros("gpt-5.4-mini-2026-03-17", 1_000_000, 0)).toBe(750_000);
    expect(estimateCostMicros("gpt-5.5", 0, 1_000_000)).toBe(30_000_000);
    expect(estimateCostMicros("gpt-9-imaginary", 1000, 1000)).toBeNull();
    expect(estimateCostMicros("gpt-4o-mini", null, 10)).toBeNull();
  });
});

function rowOf(): AiCall {
  return {
    purpose: "draft_reply",
    businessId: "b1",
    leadId: "l1",
    modelRequested: "gpt-4o-mini",
    modelUsed: null,
    fellBack: false,
    ok: true,
    errorStatus: null,
    latencyMs: 900,
    inputTokens: null,
    outputTokens: null,
    promptHash: "f".repeat(64),
    lessonsHash: null,
    rules: null,
    examples: null,
    responseId: "chatcmpl-1",
  };
}
