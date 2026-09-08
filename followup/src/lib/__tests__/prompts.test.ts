/**
 * Guarantees in the AI layer (src/lib/integrations/openai.ts): the
 * drafting prompt forbids invented facts, the risk prompt treats invented
 * facts as never "low", and the fixed-text localizer can only translate —
 * never expand — and degrades to the original text.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    audio = { transcriptions: { create } };
  },
}));

import { generateFollowUpMessage, assessSendRisk, localizeFixedText } from "@/lib/integrations/openai";

const conversation = [
  { id: "m1", direction: "inbound" as const, channel: "email" as const, body: "How old is the roof? Is it original?", date: new Date().toISOString(), opened: false },
];

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  create.mockReset();
});

describe("no-invention drafting", () => {
  it("instructs the model to never state facts absent from the conversation", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: "Your roof question", body: "I will confirm the roof details for you." }) } }],
    });
    await generateFollowUpMessage({ name: "Young Son", conversation });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/Never invent facts/);
    expect(system).toMatch(/must appear in the conversation/);
    expect(system).toMatch(/do not make up an answer/);
    expect(system).toMatch(/same language as the lead/);
  });
});

describe("send-risk gate", () => {
  it("tells the model that invented specifics are never low risk", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ riskLevel: "high", reason: "invented roof age" }) } }] });
    const r = await assessSendRisk({ conversation }, "The roof is 5 years old and not original.");
    expect(r.riskLevel).toBe("high");
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/does not appear in the conversation is fabricated/);
    expect(system).toMatch(/never 'low'/);
  });
});

describe("fixed-text localizer", () => {
  const template = "Hi! Thanks for reaching out to MJ Homes. We got your message and Manoj will get back to you shortly.";

  it("returns the text untouched without an API key", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await localizeFixedText(template, "¿Está disponible la casa?")).toBe(template);
    expect(create).not.toHaveBeenCalled();
  });

  it("returns the translation when the model behaves", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "¡Hola! Gracias por contactar a MJ Homes. Recibimos su mensaje y Manoj le responderá en breve." } }] });
    expect(await localizeFixedText(template, "¿Está disponible la casa?")).toMatch(/^¡Hola!/);
  });

  it("refuses an output that grew far beyond the template (the model \"helped\")", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: template + " ".repeat(10) + "x".repeat(template.length * 3) } }] });
    expect(await localizeFixedText(template, "¿Está disponible la casa?")).toBe(template);
  });

  it("degrades to the original text if the API call fails", async () => {
    create.mockRejectedValue(new Error("rate limited"));
    expect(await localizeFixedText(template, "Bonjour")).toBe(template);
  });
});
