/**
 * Two guarantees about the row → screen mapping, both of them about the
 * product admitting what it has not done.
 *
 * 2026-09-19, the case behind both. A real Instagram DM arrived on a
 * business whose plan did not cover Instagram. checkAiEligibility refused,
 * correctly, and said why. What the owner saw was a lead with no score, a
 * pill reading "No action needed", and a badge counting down to a
 * follow-up that was never coming. Every one of those three is a claim
 * the product had no basis for.
 */
import { describe, it, expect, vi } from "vitest";

// The mapping is pure; only its module's imports need standing in for.
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn() }));
vi.mock("@/lib/rescue", () => ({ getAtRiskLeads: vi.fn() }));

import { mapDbLeadToUiLead } from "@/lib/leads-data";
import type { BusinessAutomationRules } from "@/lib/automationStatus";

const RULES: BusinessAutomationRules = {
  masterEnabled: true,
  silenceTriggerDays: 5,
  unansweredEnabled: true,
  unansweredHours: 24,
  deadLeadEnabled: true,
  deadLeadDays: 45,
};

// Shaped like the Prisma payload the real query returns; only the fields
// this mapping reads are filled in.
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "lead1",
    name: "Instagram DM",
    company: null,
    email: null,
    phone: null,
    source: "Instagram",
    stage: "NEW",
    dealValue: 0,
    score: 0,
    scoreReason: null,
    scoreFactors: null,
    priority: "NONE",
    createdAt: new Date("2026-09-19T18:51:00Z"),
    lastContacted: new Date("2026-09-19T18:51:00Z"),
    nextFollowUp: null,
    assignedTo: null,
    assignedToId: null,
    notes: null,
    suggestedMessage: null,
    suggestedSubject: null,
    automationTier: "ASSISTED",
    optedOutAt: null,
    aiPausedReason: null,
    sequence: null,
    sequenceStepDueAt: null,
    conversations: [],
    ...overrides,
  } as unknown as Parameters<typeof mapDbLeadToUiLead>[0];
}

describe("a lead that FollowUp has not looked at", () => {
  // `reviewed` used to be derived at the call site as
  // Boolean(lead.scoreReason) — and scoreReason is never empty, because
  // an unscored lead is handed a placeholder sentence to render. So it
  // was always true, PriorityPill's "Not reviewed yet" had never once
  // appeared, and an unjudged lead was labelled "No action needed".
  it("says it hasn't been reviewed, even though it still renders a sentence where the reason goes", () => {
    const lead = mapDbLeadToUiLead(row(), RULES);
    expect(lead.reviewed).toBe(false);
    expect(lead.scoreReason).not.toBe("");
  });

  it("says it HAS been reviewed once a real reason is stored", () => {
    const lead = mapDbLeadToUiLead(row({ scoreReason: "Asked what a two-bed clean costs." }), RULES);
    expect(lead.reviewed).toBe(true);
  });
});

describe("a lead FollowUp deliberately skipped", () => {
  const paused = "This lead came in on instagram, which the Free plan doesn't cover, so FollowUp didn't read it or write a reply.";

  it("carries the reason into the status, instead of promising a follow-up", () => {
    const lead = mapDbLeadToUiLead(row({ aiPausedReason: paused }), RULES);
    expect(lead.automationStatus).toEqual({ kind: "ai_paused", reason: paused });
  });

  it("does not repeat the reason in the score line — it is one sentence, in one place", () => {
    const lead = mapDbLeadToUiLead(row({ aiPausedReason: paused }), RULES);
    expect(lead.scoreReason).not.toContain("Free plan");
    // ...but it must not send the owner to press "Sync now", which cannot
    // fix a plan that doesn't cover the channel.
    expect(lead.scoreReason).not.toMatch(/Sync now/);
  });

  it("still points an ordinary unscored lead at Sync now, which is the right advice there", () => {
    const lead = mapDbLeadToUiLead(row(), RULES);
    expect(lead.scoreReason).toMatch(/Sync now/);
  });
});
