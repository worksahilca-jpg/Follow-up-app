/**
 * task: scoreAndDraftForLead is the one chokepoint every capture path
 * (Gmail/Outlook sync, CRM sync, and — via scoreUnscoredLeads-style
 * callers — everything else) calls after creating or updating a lead's
 * conversation, which is exactly why Free tier's "AI processing pauses"
 * restriction lives here rather than at each of the ~10 capture routes
 * (research/market/2026-09-11-tier-pricing-recommendation.md §2.2).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(async () => ({})),
}));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique, update } } }));

vi.mock("@/lib/integrations/openai", () => ({
  scoreLead: vi.fn(async () => ({ score: 80, reason: "Asked about pricing", factors: [] })),
  generateFollowUpMessage: vi.fn(async () => ({ subject: "Re: your question", body: "Happy to help." })),
}));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: vi.fn(async (_first: string, _biz: string, body: string) => `Hi,\n\n${body}`),
  latestInboundText: vi.fn(() => undefined),
}));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));

// One gate for every tier since 2026-09-15, not two Free-only helpers:
// Plus's 1,500/mo and Pro's 10,000/mo were published policy with nothing
// enforcing them, so a paid account had no AI ceiling at all.
const { aiEligible } = vi.hoisted(() => ({
  aiEligible: vi.fn(async (): Promise<{ ok: true } | { ok: false; reason: string }> => ({ ok: true })),
}));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: aiEligible }));

import { scoreAndDraftForLead } from "@/lib/scoring";

function leadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    businessId: "biz1",
    name: "Priya",
    priority: "NONE",
    assignedToId: null,
    source: "Gmail",
    createdAt: new Date("2026-09-05T12:00:00Z"),
    dealValue: 0,
    lastContacted: null,
    business: { tier: "plus" },
    conversations: [
      { channel: "email", messages: [{ id: "m1", direction: "inbound", body: "What's the price?", sentAt: new Date(), opened: false }] },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  findUnique.mockResolvedValue(leadRow());
  aiEligible.mockResolvedValue({ ok: true });
});

describe("scoreAndDraftForLead — the tier's AI allowance", () => {
  // Was "without even asking the Free-tier checks" until 2026-09-15, which
  // is exactly what left Plus and Pro unbounded. A paid tier is checked
  // against its OWN ceiling, so a normal customer notices nothing.
  it("checks a paid business against its own tier, not Free's", async () => {
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(true);
    expect(aiEligible).toHaveBeenCalledWith("biz1", expect.anything(), "plus");
    expect(update).toHaveBeenCalled();
  });

  it("skips scoring once the gate refuses", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" } }));
    aiEligible.mockResolvedValue({ ok: false, reason: "past this month's 20-lead AI cap on the Free plan" });
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("passes the lead itself, so the gate can rank it and read its channel", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" }, source: "WhatsApp" }));
    await scoreAndDraftForLead("lead1");
    expect(aiEligible).toHaveBeenCalledWith(
      "biz1",
      expect.objectContaining({ source: "WhatsApp" }),
      "free"
    );
  });

  it("still scores a Free-tier lead the gate allows", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" } }));
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalled();
  });

  it("still returns false with no OPENAI_API_KEY, before ever touching the Free-tier checks", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("still returns false for a lead with no messages yet, after the Free-tier checks pass", async () => {
    findUnique.mockResolvedValue(leadRow({ conversations: [] }));
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
  });
});
