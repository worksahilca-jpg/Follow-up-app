/**
 * "Practise with FollowUp" (A-288) answers with the real reply path and stores nothing (src/lib/practiceReply.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: vi.fn(async () => ({ name: "MJ Homes", industry: "real_estate" })) },
    lead: { create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    message: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));
vi.mock("@/lib/acknowledge", () => ({ buildAckLine: vi.fn(async () => ({ line: "Thanks for asking about Elm Street.", source: "generated", reason: "ok" })) }));
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Elm Street", body: "Happy to help. Are you buying soon?" })),
  assessSendRisk: vi.fn(async () => ({ riskLevel: "low", reason: "", topic: "other" })),
  extractQualificationFacts: vi.fn(async () => null),
}));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: vi.fn(async (first: string, _b: string, body: string) => `Hi ${first},\n\n${body}\n\nBest,\nManoj`),
  getSenderFirstName: vi.fn(async () => "Manoj"),
  latestInboundText: (c: { direction: string; body: string }[]) => [...c].reverse().find((m) => m.direction === "inbound")?.body,
}));
vi.mock("@/lib/businessFacts", () => ({ draftingContext: vi.fn(async () => ({ trade: "real estate", facts: [] })) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/leadLanguage", () => ({ detectLeadLanguage: vi.fn(async () => null) }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://app.example" }));

import { prisma } from "@/lib/db";
import { buildAckLine } from "@/lib/acknowledge";
import { assessSendRisk, generateFollowUpMessage } from "@/lib/integrations/openai";
import { BOOKING_LINK_SHOWN, practiceConversation, practiceReply } from "@/lib/practiceReply";

const ack = buildAckLine as unknown as ReturnType<typeof vi.fn>;
const draft = generateFollowUpMessage as unknown as ReturnType<typeof vi.fn>;
const risk = assessSendRisk as unknown as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  ack.mockClear();
  draft.mockClear();
  risk.mockReset();
  risk.mockResolvedValue({ riskLevel: "low", reason: "", topic: "other" });
});

describe("practiceReply", () => {
  it("answers the first message with the instant reply every new customer gets", async () => {
    const r = await practiceReply("biz1", "Sahil Kumar", [{ from: "customer", text: "Is the 3 bed on Elm Street available?" }], null);
    expect(ack).toHaveBeenCalledTimes(1);
    expect(draft).not.toHaveBeenCalled();
    expect(r.reply).toContain("Hi Sahil");
    expect(r.verdict.sends).toBe(true);
  });

  it("answers later messages with the real reply writer and its send check", async () => {
    const r = await practiceReply(
      "biz1",
      "Sahil",
      [
        { from: "customer", text: "Is the 3 bed on Elm Street available?" },
        { from: "followup", text: "Thanks for asking about Elm Street." },
        { from: "customer", text: "Great, what's the price?" },
      ],
      null
    );
    expect(draft).toHaveBeenCalledTimes(1);
    expect(risk).toHaveBeenCalledTimes(1);
    expect(r.verdict.sends).toBe(true);
  });

  it("says why a reply would wait, in the check's own words", async () => {
    risk.mockResolvedValue({ riskLevel: "high", reason: "the reply needs the price from you", topic: "price" });
    const r = await practiceReply("biz1", "Sahil", [
      { from: "customer", text: "Hi" },
      { from: "followup", text: "Hello" },
      { from: "customer", text: "What's the price?" },
    ], null);
    expect(r.verdict).toEqual({ sends: false, reason: "the reply needs the price from you" });
  });

  it("waits when the check can't run, rather than guessing", async () => {
    risk.mockRejectedValue(new Error("down"));
    const r = await practiceReply("biz1", "Sahil", [
      { from: "customer", text: "Hi" },
      { from: "followup", text: "Hello" },
      { from: "customer", text: "Ok" },
    ], null);
    expect(r.verdict.sends).toBe(false);
  });

  it("a reply with the booking page always waits, and shows the link as a placeholder", async () => {
    draft.mockResolvedValueOnce({ subject: "", body: "Pick a time here: https://app.example/book/practice" });
    const r = await practiceReply("biz1", "Sahil", [
      { from: "customer", text: "Hi" },
      { from: "followup", text: "Would you like to see it this week?" },
      { from: "customer", text: "Yes please" },
    ], null);
    expect(r.verdict.sends).toBe(false);
    expect(r.reply).toContain(BOOKING_LINK_SHOWN);
    expect(r.reply).not.toContain("/book/practice");
    expect(risk).not.toHaveBeenCalled();
  });

  it("stores and sends nothing", async () => {
    await practiceReply("biz1", "Sahil", [
      { from: "customer", text: "Hi" },
      { from: "followup", text: "Hello" },
      { from: "customer", text: "Ok" },
    ], null);
    expect(p.lead.create).not.toHaveBeenCalled();
    expect(p.lead.update).not.toHaveBeenCalled();
    expect(p.message.create).not.toHaveBeenCalled();
    expect(p.auditEvent.create).not.toHaveBeenCalled();
  });
});

describe("practiceConversation", () => {
  it("is oldest first, a customer's words inbound and FollowUp's first reply marked as the instant reply", () => {
    const c = practiceConversation(
      [
        { from: "customer", text: "a" },
        { from: "followup", text: "b" },
        { from: "customer", text: "c" },
      ],
      new Date("2026-10-18T12:00:00Z")
    );
    expect(c.map((m) => m.direction)).toEqual(["inbound", "outbound", "inbound"]);
    expect(c[1].trigger).toBe("instant_ack");
    expect(new Date(c[0].date) < new Date(c[2].date)).toBe(true);
  });
});
