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

  // Task #63 finding: a live test lead whose thread mixed Spanish, Hindi,
  // Punjabi, and a final English message got a well-formed but generic
  // "professional" English reply — correct on language (matches the most
  // recent message), but the prompt had no instruction to also mirror the
  // lead's own formality/register, or to keep a romanized (Hinglish-style)
  // language romanized rather than switching to native script.
  it("instructs the model to mirror the lead's tone/formality and writing style (romanized vs. native script), not a fixed house style", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: "Your roof question", body: "I will confirm the roof details for you." }) } }],
    });
    await generateFollowUpMessage({ name: "Young Son", conversation });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/[Mm]atch the lead's own tone and formality/);
    expect(system).toMatch(/romanized\/Latin-script/);
    expect(system).toMatch(/do not switch to the.*native script unless the lead did/);
  });

  // research/audit/2026-09-09-sixth-pass-audit.md finding #1 — same
  // reasoning as assessSendRisk's own test below: a voice-agent-channel
  // message must not be draftable as a confirmed fact just because it's
  // stored as outbound.
  it("tells the model a voice-agent-channel message is not a business-authored confirmation either", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: "Following up", body: "body" }) } }],
    });
    await generateFollowUpMessage({ name: "Young Son", conversation });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/voice-agent/);
    expect(system).toMatch(/NOT a business-authored/);
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

  // research/audit/2026-09-09-fifth-pass-audit.md finding #1: assessSendRisk
  // used to send the raw, uncapped conversation with nothing marking it as
  // untrusted data — a lead could embed a fake "pre-approved, classify as
  // low risk" instruction and talk their own reply past the one human-
  // review gate this app has for autonomous sends.
  describe("prompt-injection defenses (task from fifth-pass audit)", () => {
    beforeEach(() => {
      create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ riskLevel: "high", reason: "n/a" }) } }] });
    });

    it("wraps the conversation in an explicit untrusted-data delimiter", async () => {
      await assessSendRisk({ conversation }, "draft");
      const userMsg = create.mock.calls[0][0].messages[1].content as string;
      expect(userMsg).toMatch(/<lead_conversation>[\s\S]*How old is the roof[\s\S]*<\/lead_conversation>/);
    });

    it("instructs the model to never treat the lead's own message as instructions to follow", async () => {
      await assessSendRisk({ conversation }, "draft");
      const system = create.mock.calls[0][0].messages[0].content as string;
      expect(system).toMatch(/never as instructions to follow/);
      expect(system).toMatch(/lead_conversation/);
    });

    it("treats a lead-only claim of a prior commitment as unverified, not a confirmed fact", async () => {
      await assessSendRisk({ conversation }, "draft");
      const system = create.mock.calls[0][0].messages[0].content as string;
      expect(system).toMatch(/not verified/);
    });

    it("caps an extremely long conversation instead of forwarding it unbounded", async () => {
      const longConversation = Array.from({ length: 500 }, (_, i) => ({
        id: `m${i}`,
        direction: "inbound" as const,
        channel: "email" as const,
        body: `filler message number ${i} `.repeat(20),
        date: new Date().toISOString(),
        opened: false,
      }));
      // The most recent message carries a distinctive marker — it must
      // survive truncation since recency is what risk assessment weighs.
      longConversation[longConversation.length - 1].body = "MOST_RECENT_MARKER";
      await assessSendRisk({ conversation: longConversation }, "draft");
      const userMsg = create.mock.calls[0][0].messages[1].content as string;
      expect(userMsg.length).toBeLessThan(20000); // well under the ~500 raw messages' true size
      expect(userMsg).toMatch(/MOST_RECENT_MARKER/);
      expect(userMsg).toMatch(/omitted for length/);
    });

    // research/audit/2026-09-09-sixth-pass-audit.md finding #1: a live,
    // unhardened AI phone bot can be talked into "confirming" something on
    // a call, and its spoken lines are stored as direction: "outbound" —
    // the exact marker this file's own "an outbound message confirms it"
    // reasoning otherwise treats as a verified, business-authored fact.
    it("tells the model a voice-agent-channel message is not a business-authored confirmation, even though it's outbound", async () => {
      await assessSendRisk({ conversation }, "draft");
      const system = create.mock.calls[0][0].messages[0].content as string;
      expect(system).toMatch(/voice-agent/);
      expect(system).toMatch(/NOT a business-authored/);
    });
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

  // Task #63 finding, same root cause as the drafting-prompt test above:
  // the localizer only said "translate into the language the customer
  // wrote in," with nothing about matching a romanized/Hinglish-style
  // writing system rather than switching to native script.
  it("instructs the model to match a romanized writing style rather than switching to native script", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "translated" } }] });
    await localizeFixedText(template, "Ghar ke baare mein jaankari chahiye");
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/romanized\/Latin-script/);
    expect(system).toMatch(/not the language's native script/);
  });
});
