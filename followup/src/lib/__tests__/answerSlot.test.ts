/**
 * "Teach FollowUp your business" (A-100). The price blank, for any plain
 * question about how the business works: "[ANSWER: parking]". It keeps the
 * price blank's two guarantees (always held, never sent unfilled), and the
 * owner's answer becomes a fact for the next customer who asks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  TRANSCRIBE_MODEL: "test-transcribe",
  getClient: () => ({ chat: { completions: { create } } }),
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
import {
  ANSWER_SLOT_REASON,
  fillPriceSlot,
  filledAnswer,
  filledPrice,
  hasPriceSlot,
  isFilledDraft,
  slotOf,
  splitAtPriceSlot,
} from "@/lib/priceSlot";
import { ownerAnswerFact } from "@/lib/factLines";
import { teachQuestions } from "@/lib/teachQuestions";
import { plainHoldReason } from "@/lib/holdReasons";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  create.mockReset();
  p.lead.findUnique.mockResolvedValue({ id: "lead1", email: "ivy@example.com", phone: null, optedOutAt: null });
});

const draft = "Hi Ivy,\n\nThanks for asking. [ANSWER: parking]\n\nWould you like to see it this week?";

describe("reading the blank", () => {
  it("knows an answer blank and what it is about, however it is written", () => {
    expect(slotOf(draft)).toEqual({ kind: "answer", topic: "parking" });
    expect(slotOf("We [ answer :  Pets ] here.")).toEqual({ kind: "answer", topic: "pets" });
    expect(slotOf("It is [PRICE].")).toEqual({ kind: "price" });
    expect(slotOf("Nothing to fill.")).toBeNull();
    expect(hasPriceSlot(draft)).toBe(true);
  });

  it("cuts the draft at the blank without leaking the topic into the text", () => {
    const parts = splitAtPriceSlot(draft);
    expect(parts).toHaveLength(2);
    expect(parts.join("")).not.toContain("parking");
    expect(fillPriceSlot(draft, "One spot is included.")).toContain("Thanks for asking. One spot is included.");
  });

  it("reads back what the owner typed, and filling it is not an edit", () => {
    const sent = fillPriceSlot(draft, "One spot is included, and a second is $150 a month.");
    expect(filledAnswer(draft, sent)).toEqual({ topic: "parking", value: "One spot is included, and a second is $150 a month." });
    expect(isFilledDraft(draft, sent)).toBe(true);
    // An answer is not a price: the price-learning path leaves it alone.
    expect(filledPrice(draft, sent)).toBeNull();
    expect(filledAnswer("It is [PRICE].", "It is $40.")).toBeNull();
  });
});

describe("a draft with an answer blank is always held", () => {
  it("is judged high risk without asking the model, and says what the owner does", async () => {
    const verdict = await assessSendRisk({ conversation: [] }, draft);
    expect(verdict).toEqual({ riskLevel: "high", reason: ANSWER_SLOT_REASON, topic: "other" });
    expect(create).not.toHaveBeenCalled();
    expect(plainHoldReason(ANSWER_SLOT_REASON, { firstName: "Ivy" })).toBe("Add your answer, then send.");
  });
});

describe("a message that still has the answer blank never leaves", () => {
  it("is refused, and says what to do", async () => {
    const result = await sendFollowUpToLead("lead1", draft, { automated: true, trigger: "silence" });
    expect(result.success).toBe(false);
    expect(result.failure).toBe("refused");
    expect(result.message).toMatch(/Add your answer first/);
    expect(p.message.findFirst).not.toHaveBeenCalled();
  });
});

describe("drafting writes the blank instead of guessing", () => {
  it("tells the model about [ANSWER: topic], and keeps availability and dates out of it", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ subject: "Parking", body: draft }) } }] });
    await generateFollowUpMessage({ name: "Ivy Sohal", conversation: [] });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toContain("[ANSWER: topic]");
    expect(system).toMatch(/Never use it for whether something is available, for dates or times/);
    expect(system).toMatch(/at most one placeholder/);
  });
});

describe("the owner's answer as a fact", () => {
  it("names it after what it was about, in the owner's own words", () => {
    expect(ownerAnswerFact("parking", "One spot is included.", "Ivy Sohal")).toEqual({ label: "Parking", value: "One spot is included." });
    // Short is fine: they typed it and left it ticked.
    expect(ownerAnswerFact("pets", "Yes, pets are welcome", "Ivy Sohal")).toEqual({ label: "Pets", value: "Yes, pets are welcome" });
  });

  it("never keeps anything about this customer, because every later customer sees it", () => {
    expect(ownerAnswerFact("parking", "Ivy, your spot is P2-14", "Ivy Sohal")).toBeNull();
    expect(ownerAnswerFact("parking", "Email ivy@example.com for the spot", "Ivy Sohal")).toBeNull();
    expect(ownerAnswerFact("parking", "x".repeat(201), "Ivy Sohal")).toBeNull();
    expect(ownerAnswerFact("", "One spot", "Ivy Sohal")).toBeNull();
  });
});

describe("the short question step", () => {
  it("asks a realtor what customers ask a realtor, and about seven things, not twenty", () => {
    const qs = teachQuestions("Real estate");
    expect(qs.length).toBe(7);
    expect(qs[0]).toMatchObject({ label: "Commission", question: "What commission do you charge?" });
    expect(qs.every((q) => q.example.startsWith("e.g."))).toBe(true);
  });

  it("never asks what FollowUp already knows", () => {
    const labels = teachQuestions("Real estate", ["commission ", "Showings"]).map((q) => q.label);
    expect(labels).not.toContain("Commission");
    expect(labels).not.toContain("Showings");
    expect(labels).toHaveLength(5);
  });

  it("asks a general set for any other trade, or none set", () => {
    expect(teachQuestions("Legal").map((q) => q.label)).toEqual(teachQuestions(null).map((q) => q.label));
    expect(teachQuestions("Home services (contractor, cleaning, etc.)")[0].label).toBe("Quotes");
    expect(teachQuestions("real_estate")[0].label).toBe("Commission");
  });
});
