/**
 * Someone FollowUp is switched off for still shows up in Today when they
 * write (founder, 2026-10-05: a friend's test email went to a person
 * switched off in September, and it was nowhere to be seen).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const leadRow = vi.fn();
const recordAudit = vi.fn(async () => true);
const heldSince = vi.fn(async () => false);

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: (...a: unknown[]) => leadRow(...a), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({})) },
    notification: { create: vi.fn(async () => ({})) },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit: (...a: unknown[]) => (recordAudit as (...x: unknown[]) => unknown)(...a) }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince: (...a: unknown[]) => (heldSince as (...x: unknown[]) => unknown)(...a) }));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/leadLanguage", () => ({ detectLeadLanguage: vi.fn(async () => null), leadLanguageOf: vi.fn(() => null) }));
vi.mock("@/lib/tradePlaybooks", () => ({ businessTrade: vi.fn(async () => null) }));
vi.mock("@/lib/slack", () => ({ notifySlack: vi.fn(), escapeSlackText: (s: string) => s }));
vi.mock("@/lib/sender", () => ({ composeFollowUpEmail: vi.fn(async (_n: string, _b: string, body: string) => `Hi Vansh,\n\n${body}\n\nBest,\nSahil`), latestInboundText: vi.fn(() => "Is it still available?") }));
vi.mock("@/lib/integrations/openai", () => ({
  scoreLead: vi.fn(async () => ({ score: 80, reason: "Wants a viewing", factors: [] })),
  generateFollowUpMessage: vi.fn(async () => ({ subject: "The condo", body: "I'll confirm it's available. Which days suit you?" })),
}));

import { scoreAndDraftForLead } from "@/lib/scoring";

function lead(tier: "OFF" | "ASSISTED", direction: "inbound" | "outbound" = "inbound") {
  return {
    id: "lead1", businessId: "biz1", name: "Vansh Goura", automationTier: tier, dealValue: 0, priority: "MEDIUM",
    lastContacted: new Date(), createdAt: new Date(), assignedToId: null,
    business: { tier: "pro", name: "FollowUp" },
    conversations: [{ channel: "email", messages: [{ id: "m1", direction, body: "Is it still available? Can I see it this weekend?", sentAt: new Date("2026-10-05T04:39:47Z"), opened: false }] }],
  };
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test";
  recordAudit.mockClear();
  heldSince.mockReset();
  heldSince.mockResolvedValue(false);
});

describe("a switched-off customer who writes", () => {
  it("is put on Today, held for the owner, never sent", async () => {
    leadRow.mockResolvedValue(lead("OFF"));
    await scoreAndDraftForLead("lead1");
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const [, action, details] = recordAudit.mock.calls[0] as unknown as [unknown, string, { targetId: string; meta: Record<string, string> }];
    expect(action).toBe("ai.hold");
    expect(details.targetId).toBe("lead1");
    expect(details.meta.reason).toMatch(/switched off for Vansh/);
    // Not "routine": Send all leaves it alone.
    expect(details.meta.riskLevel).toBe("medium");
  });

  it("is not put on Today twice for the same message", async () => {
    leadRow.mockResolvedValue(lead("OFF"));
    heldSince.mockResolvedValue(true);
    await scoreAndDraftForLead("lead1");
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("changes nothing for everyone else, whose holds the automation writes as before", async () => {
    leadRow.mockResolvedValue(lead("ASSISTED"));
    await scoreAndDraftForLead("lead1");
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("does nothing when the newest message is the owner's own", async () => {
    leadRow.mockResolvedValue(lead("OFF", "outbound"));
    await scoreAndDraftForLead("lead1");
    expect(recordAudit).not.toHaveBeenCalled();
  });
});
