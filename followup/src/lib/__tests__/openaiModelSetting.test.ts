/**
 * The model is a setting with a safety net (founder, 2026-10-04: "we
 * should use newer models every time"). A newer model gets the request in
 * the shape it accepts, and one that refuses falls back to the known-good
 * model instead of stopping replies being written.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));
vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  create.mockReset();
  process.env.OPENAI_API_KEY = "test-key";
  delete process.env.OPENAI_MODEL;
});

async function load(model?: string) {
  if (model) process.env.OPENAI_MODEL = model;
  return import("@/lib/integrations/openaiClient");
}

describe("which model writes", () => {
  it("is the known-good model when nothing is set", async () => {
    const { MODEL, FALLBACK_MODEL } = await load();
    expect(MODEL).toBe(FALLBACK_MODEL);
  });

  it("is OPENAI_MODEL when it is set", async () => {
    const { MODEL } = await load("gpt-5.4-mini");
    expect(MODEL).toBe("gpt-5.4-mini");
  });
});

describe("the request, in the shape the model accepts", () => {
  it("leaves an older model's request as it was", async () => {
    const { adaptForModel } = await load();
    expect(adaptForModel({ model: "x", temperature: 0, max_tokens: 200 }, "gpt-4o-mini")).toEqual({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 200,
    });
  });

  it("drops temperature and gives a thinking model room to think and still answer", async () => {
    const { adaptForModel } = await load();
    const out = adaptForModel({ model: "x", temperature: 0, max_tokens: 200 }, "gpt-5.4-mini");
    expect(out.temperature).toBeUndefined();
    expect(out.max_tokens).toBeUndefined();
    expect(out.max_completion_tokens).toBeGreaterThanOrEqual(4000);
  });
});

describe("a newer model that refuses", () => {
  it("falls back to the known-good model, so the reply still gets written", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("model not found"), { status: 404 }));
    create.mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
    const { getClient, MODEL } = await load("gpt-made-up");
    const result = await getClient().chat.completions.create({ model: MODEL, messages: [], temperature: 0, max_tokens: 100 });
    expect(result).toEqual({ choices: [{ message: { content: "ok" } }] });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[1][0]).toMatchObject({ model: "gpt-4o-mini", temperature: 0, max_tokens: 100 });
  });

  it("does not hide other failures, like OpenAI being down", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("server error"), { status: 500 }));
    const { getClient, MODEL } = await load("gpt-5.4-mini");
    await expect(getClient().chat.completions.create({ model: MODEL, messages: [] })).rejects.toThrow("server error");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
