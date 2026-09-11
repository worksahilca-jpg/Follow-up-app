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

const { channelOk, capOk } = vi.hoisted(() => ({
  channelOk: vi.fn(() => true),
  capOk: vi.fn(async () => true),
}));
vi.mock("@/lib/billing", () => ({ isChannelAvailableOnFreeTier: channelOk, isWithinFreeTierLeadCap: capOk }));

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
  channelOk.mockReturnValue(true);
  capOk.mockResolvedValue(true);
});

describe("scoreAndDraftForLead — Free tier gate", () => {
  it("scores normally for a Plus/Pro business, without even asking the Free-tier checks", async () => {
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(true);
    expect(channelOk).not.toHaveBeenCalled();
    expect(capOk).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it("skips scoring for a Free-tier lead over the monthly cap", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" } }));
    capOk.mockResolvedValue(false);
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("skips scoring for a Free-tier lead captured on a channel Free doesn't cover", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" }, source: "WhatsApp" }));
    channelOk.mockReturnValue(false);
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("still scores a Free-tier lead that's within cap and on an eligible channel", async () => {
    findUnique.mockResolvedValue(leadRow({ business: { tier: "free" } }));
    const ok = await scoreAndDraftForLead("lead1");
    expect(ok).toBe(true);
    expect(channelOk).toHaveBeenCalledWith("Gmail");
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
