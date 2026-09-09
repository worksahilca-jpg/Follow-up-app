/**
 * computeAutomationStatus() is read-only guesswork about what
 * runAutomationForBusiness() (automation.ts) would do — these guarantees
 * matter because a wrong answer here is a lie on the lead's own page, not
 * just a wrong automated send: never say "will follow up soon" when the
 * master switch is actually off (task #63's real finding), never hide an
 * active workflow behind automationTier === "off" just because enrolling
 * always sets that field, and never let a closed deal show any status
 * at all.
 */
import { describe, it, expect } from "vitest";
import { computeAutomationStatus, type AutomationStatusLead, type BusinessAutomationRules } from "@/lib/automationStatus";
import type { Message } from "@/lib/types";

const RULES: BusinessAutomationRules = {
  masterEnabled: true,
  silenceTriggerDays: 5,
  unansweredEnabled: true,
  unansweredHours: 24,
  deadLeadEnabled: true,
  deadLeadDays: 45,
};

const NOW = new Date("2026-09-09T17:00:00Z");

function lead(overrides: Partial<AutomationStatusLead> = {}): AutomationStatusLead {
  return {
    stage: "contacted",
    automationTier: "assisted",
    lastContacted: NOW.toISOString(),
    conversation: [],
    followUpTriggers: [],
    sequence: null,
    ...overrides,
  };
}

function msg(direction: "inbound" | "outbound", hoursAgo: number): Message {
  return { id: "m", direction, channel: "email", body: "x", date: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString() };
}

describe("computeAutomationStatus", () => {
  it("shows closed for a won or lost lead regardless of anything else that would otherwise apply", () => {
    const l = lead({ stage: "won", conversation: [msg("inbound", 1000)], lastContacted: new Date(NOW.getTime() - 1000 * 3_600_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "closed" });
  });

  it("shows workflow (not off) for a lead enrolled in an active sequence, even though enrolling sets automationTier to off", () => {
    const l = lead({
      automationTier: "off",
      sequence: { name: "Recommended cadence", active: true, dueAt: new Date(NOW.getTime() + 2 * 86_400_000).toISOString() },
    });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "workflow", sequenceName: "Recommended cadence", dueInDays: 2 });
  });

  it("floors a same-day-due workflow step to 0 days, not a negative number", () => {
    const l = lead({
      automationTier: "off",
      sequence: { name: "Recommended cadence", active: true, dueAt: new Date(NOW.getTime() - 60_000).toISOString() },
    });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "workflow", sequenceName: "Recommended cadence", dueInDays: 0 });
  });

  it("shows workflow_paused for a lead still enrolled in a sequence the business paused", () => {
    const l = lead({ automationTier: "off", sequence: { name: "Recommended cadence", active: false, dueAt: null } });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "workflow_paused", sequenceName: "Recommended cadence" });
  });

  it("shows off for a lead with automation explicitly turned off and no workflow enrollment", () => {
    const l = lead({ automationTier: "off" });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "off" });
  });

  it("shows due_soon(unanswered) once the lead's own message is older than the unanswered threshold", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 25)], followUpTriggers: ["manual"] });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("uses the shorter first-reply window when the only outbound so far is the instant-ack template", () => {
    const l = lead({ conversation: [msg("outbound", 5), msg("inbound", 4)], followUpTriggers: ["instant_ack"] });
    // 4h since the lead's message: past the 3h first-reply threshold, well inside the normal 24h one
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("shows account_paused(unanswered) instead of due_soon when the master switch is off", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 25)], followUpTriggers: ["manual"] });
    expect(computeAutomationStatus(l, { ...RULES, masterEnabled: false }, NOW)).toEqual({ kind: "account_paused", reason: "unanswered" });
  });

  it("shows waiting with a rough ETA before the unanswered threshold is reached", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 20)], followUpTriggers: ["manual"] });
    const status = computeAutomationStatus(l, RULES, NOW);
    expect(status.kind).toBe("waiting");
    expect((status as { etaHours: number }).etaHours).toBe(4); // 24h threshold - 20h elapsed
  });

  it("shows due_soon(dead_lead) once lastContacted crosses the dead-lead threshold", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 46 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "dead_lead" });
  });

  it("shows due_soon(silence) once lastContacted crosses the silence threshold but not the dead-lead one", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 6 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "silence" });
  });

  it("prefers the dead-lead reactivation reason over silence once a lead crosses both thresholds", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 100 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "dead_lead" });
  });

  it("prefers unanswered over dead-lead reactivation when a lead qualifies for both", () => {
    // Our last real send was 100 days ago (past dead-lead), but the lead
    // just wrote back 30 hours ago (past unanswered) — the more urgent,
    // human-neglect framing should win, exactly like automation.ts's own
    // unansweredIds-excludes-from-deadIds merge.
    const l = lead({
      lastContacted: new Date(NOW.getTime() - 100 * 86_400_000).toISOString(),
      conversation: [msg("outbound", 200), msg("inbound", 30)],
      followUpTriggers: ["manual"],
    });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("falls back to the dead-lead/silence threshold when the lead wrote but the unanswered rule itself is disabled", () => {
    const l = lead({
      lastContacted: new Date(NOW.getTime() - 6 * 86_400_000).toISOString(),
      conversation: [msg("inbound", 1)],
      followUpTriggers: [],
    });
    expect(computeAutomationStatus(l, { ...RULES, unansweredEnabled: false }, NOW)).toEqual({ kind: "due_soon", reason: "silence" });
  });

  it("shows sent when we already replied and nothing else is currently due", () => {
    const l = lead({ conversation: [msg("inbound", 10), msg("outbound", 1)], lastContacted: new Date(NOW.getTime() - 3_600_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "sent" });
  });

  it("treats a lead with no messages at all as sent (nothing inbound to answer) rather than waiting forever", () => {
    const l = lead({ conversation: [], lastContacted: NOW.toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "sent" });
  });
});
