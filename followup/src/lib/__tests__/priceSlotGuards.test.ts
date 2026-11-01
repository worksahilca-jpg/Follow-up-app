/**
 * The price blank's two guarantees (src/lib/priceSlot.ts, A-060):
 *
 *  1. A draft with the blank is always held for the owner. The risk check
 *     decides that itself, before any model is asked, so no answer from the
 *     model and no missing API key can turn it into "safe to send".
 *  2. A message that still has the blank never leaves. sendFollowUpToLead
 *     is the one funnel every send goes through, and it refuses before it
 *     queues, records or sends anything.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  TRANSCRIBE_MODEL: "test-transcribe",
  getClient: () => ({ chat: { completions: { create } } }),
  noteAiChoice: async () => {},
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn() },
    message: { findFirst: vi.fn(async () => null) },
    conversation: { findFirst: vi.fn(async () => null) },
  },
}));

import { prisma } from "@/lib/db";
import { assessSendRisk, generateFollowUpMessage } from "@/lib/integrations/openai";
import { sendFollowUpToLead } from "@/lib/sending";
import { PRICE_SLOT_REASON } from "@/lib/priceSlot";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  create.mockReset();
  p.lead.findUnique.mockResolvedValue({ id: "lead1", email: "sarah@example.com", phone: null, optedOutAt: null });
});

describe("a draft with the price blank is always held", () => {
  it("is judged high risk, about a price, without asking the model", async () => {
    const verdict = await assessSendRisk({ conversation: [] }, "Hi Sarah, the 3-month package is [PRICE]. Want a call first?");
    expect(verdict).toEqual({ riskLevel: "high", reason: PRICE_SLOT_REASON, topic: "price" });
    expect(create).not.toHaveBeenCalled();
  });

  it("still asks the model about an ordinary draft", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ riskLevel: "low", reason: "", topic: "none" }) } }] });
    await assessSendRisk({ conversation: [] }, "Thanks, happy to help. Which day suits you?");
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe("a message that still has the blank never leaves", () => {
  it("is refused, and says what to do", async () => {
    const result = await sendFollowUpToLead("lead1", "The package is [PRICE].", { automated: true, trigger: "silence" });
    expect(result.success).toBe(false);
    expect(result.failure).toBe("refused");
    expect(result.message).toMatch(/Add the price first/);
  });

  it("is refused in the subject line too", async () => {
    const result = await sendFollowUpToLead("lead1", "The package is $1,200.", { subject: "Your quote: [price]" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Add the price first/);
  });

  it("is refused before anything else is looked at", async () => {
    await sendFollowUpToLead("lead1", "It is [ PRICE ].", {});
    expect(p.message.findFirst).not.toHaveBeenCalled();
    expect(p.conversation.findFirst).not.toHaveBeenCalled();
  });
});

describe("a reply with two different blanks (Nov 1 2026)", () => {
  it("is refused, and says to write both in", async () => {
    const result = await sendFollowUpToLead("lead1", "The asking price is [PRICE], and parking is [ANSWER: parking].", { trigger: "manual" });
    expect(result).toMatchObject({ success: false, failure: "refused" });
    expect(result.message).toBe("This reply has two blanks. Press Change it and write in both first.");
  });
});

describe("a message with a template leftover never leaves either (Nov 1 2026)", () => {
  it("is refused on an automatic send, and names what to change", async () => {
    const result = await sendFollowUpToLead("lead1", "Happy to show it Saturday!\n\nBest,\n[Your Name]", { automated: true, trigger: "silence" });
    expect(result).toMatchObject({ success: false, failure: "refused" });
    expect(result.message).toMatch(/Change "\[Your Name\]" to the real words first/);
    expect(p.message.findFirst).not.toHaveBeenCalled();
  });

  it("is refused in the subject line too", async () => {
    const result = await sendFollowUpToLead("lead1", "Here are the details.", { subject: "Viewing on {date}" });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/\{date\}/);
  });
});

describe("drafting writes the blank instead of a number", () => {
  it("tells the model to write [PRICE] for a price it doesn't have, and never a figure", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ subject: "Your package", body: "It is [PRICE]." }) } }] });
    await generateFollowUpMessage({ name: "Sarah Johnson", conversation: [] });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toContain("[PRICE]");
    expect(system).toMatch(/never write a number, range, estimate or currency in its place/);
  });
});

