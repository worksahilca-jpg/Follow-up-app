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
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 25)] });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("uses the shorter first-reply window when the only outbound so far is the instant-ack template", () => {
    const l = lead({ conversation: [msg("inbound", 4), { ...msg("outbound", 3.95), trigger: "instant_ack" }] });
    // 4h since the lead's message: past the 3h first-reply threshold, well inside the normal 24h one
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  // findUnansweredLeads() in automation.ts counts TWO kinds of substantive
  // outbound reply: a FollowUp row whose trigger isn't "instant_ack", and a
  // directly-captured Instagram/Messenger echo (Message.source set, no
  // FollowUp row ever created — see captureDirectReply). This badge only
  // counted the first, so an owner who answered in the Instagram app got
  // the 3h first-reply threshold here while automation was really waiting
  // the full 24h — "Following up soon" for ~21h before anything happened.
  it("counts a directly-captured Instagram/Messenger reply as substantive outbound, matching automation.ts", () => {
    const echo: Message = { ...msg("outbound", 5), channel: "instagram", source: "instagram_direct" };
    const l = lead({ conversation: [echo, msg("inbound", 4)] });

    // 4h since the lead wrote: past the 3h first-reply window, but the
    // owner HAS replied, so the business's real 24h window applies.
    const status = computeAutomationStatus(l, RULES, NOW);
    expect(status.kind).toBe("waiting");
    expect((status as { etaHours: number }).etaHours).toBe(20);
  });

  it("still uses the short first-reply window when the only outbound echo is inbound-direction noise", () => {
    // An INBOUND message carrying a source must not be mistaken for a reply
    // the business sent.
    const l = lead({
      conversation: [{ ...msg("inbound", 4), channel: "instagram", source: "instagram_direct" }],
    });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("shows account_paused(unanswered) instead of due_soon when the master switch is off", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 25)] });
    expect(computeAutomationStatus(l, { ...RULES, masterEnabled: false }, NOW)).toEqual({ kind: "account_paused", reason: "unanswered" });
  });

  it("shows waiting with a rough ETA before the unanswered threshold is reached", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 20)] });
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
    });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("falls back to the dead-lead/silence threshold when the lead wrote but the unanswered rule itself is disabled", () => {
    const l = lead({
      lastContacted: new Date(NOW.getTime() - 6 * 86_400_000).toISOString(),
      conversation: [msg("inbound", 1)],
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

/**
 * The badge and the engine must agree about Meta's 24-hour window.
 *
 * This file's own header says a wrong answer here is "a lie on the lead's
 * own page". The Meta ceiling (UNANSWERED_META_DM_MAX_HOURS) made that a
 * live risk again: it shortens the wait on Instagram and Messenger below
 * whatever the business configured, so a badge still counting down from 24
 * would tell the owner "Following up in 3h" about a lead the next hourly
 * tick is going to send. Both sides now call effectiveUnansweredHours().
 */
describe("the unanswered badge against Meta's window ceiling", () => {
  function dmMsg(direction: "inbound" | "outbound", hoursAgo: number, channel: Message["channel"]): Message {
    return { id: `m-${direction}-${hoursAgo}`, direction, channel, body: "x", date: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString() };
  }

  /** A lead in a real back-and-forth, so it's on the long window, last word theirs. */
  function dmLead(hoursAgo: number, channel: Message["channel"]) {
    return lead({
      conversation: [dmMsg("outbound", hoursAgo + 5, channel), dmMsg("inbound", hoursAgo, channel)],
      lastContacted: new Date(NOW.getTime() - (hoursAgo + 5) * 3_600_000).toISOString(),
    });
  }

  it("reads an Instagram lead at 21 hours as due, not as three hours away", () => {
    // The exact lie this guards against: at 24h the badge said "in 3h"
    // while the engine was about to send — and Meta was about to refuse.
    expect(computeAutomationStatus(dmLead(21, "instagram"), RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("reads a Messenger lead at 21 hours as due", () => {
    expect(computeAutomationStatus(dmLead(21, "messenger"), RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("leaves an email lead at 21 hours still counting down, as the owner configured", () => {
    const status = computeAutomationStatus(dmLead(21, "email"), RULES, NOW);
    expect(status.kind).not.toBe("due_soon");
  });

  it("holds the ceiling against a business that configured 72 hours", () => {
    const slow: BusinessAutomationRules = { ...RULES, unansweredHours: 72 };
    expect(computeAutomationStatus(dmLead(21, "instagram"), slow, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
    // …and the same lead on email genuinely does have days to go.
    expect(computeAutomationStatus(dmLead(21, "email"), slow, NOW).kind).not.toBe("due_soon");
  });

  it("still counts down on an Instagram lead at 19 hours", () => {
    expect(computeAutomationStatus(dmLead(19, "instagram"), RULES, NOW).kind).not.toBe("due_soon");
  });
});

/**
 * The badge must agree with the engine about the instant ack (F2). It read
 * "sent" for a lead who wrote once and got the ack — the exact lead the
 * engine was also failing to pick up — so nothing anywhere said the
 * 3-hour rule was due.
 */
describe("the instant ack does not make a lead read as answered", () => {
  it("shows the first-reply countdown for a lead who wrote once and got only the ack", () => {
    const l = lead({ conversation: [msg("inbound", 2), { ...msg("outbound", 1.95), trigger: "instant_ack" }] });
    const s = computeAutomationStatus(l, RULES, NOW);
    expect(s.kind).not.toBe("sent");
  });

  it("reads that lead as due once 3 hours have passed", () => {
    const l = lead({ conversation: [msg("inbound", 4), { ...msg("outbound", 3.95), trigger: "instant_ack" }] });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });

  it("reads an owner's synced Gmail reply (no trigger) as answered", () => {
    const l = lead({ conversation: [msg("inbound", 30), msg("outbound", 29)] });
    expect(computeAutomationStatus(l, RULES, NOW).kind).toBe("sent");
  });
});

/**
 * A tap on the honest-no chip stops the automatic follow-ups (see
 * handleQuickReplyTap in src/lib/inbound/meta.ts and findUnansweredLeads in
 * src/lib/automation.ts). The badge must read the same stored payload, or
 * it counts down to a message the engine will never send.
 */
describe("a 'Not now' tap on the lead's own page", () => {
  const EXIT = "fu1;unanswered;interest_last;not_now;x";
  const ANSWER = "fu1;unanswered;availability_unanswered;morning;a";

  it("shows no countdown after an exit tap — FollowUp has stopped", () => {
    const l = lead({ conversation: [{ ...msg("outbound", 6), trigger: "unanswered", channel: "instagram" }, { ...msg("inbound", 5), channel: "instagram", quickReplyPayload: EXIT }] });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "sent" });
  });

  it("still counts down after an ANSWER tap — the owner is expected to reply, and FollowUp will if they don't", () => {
    const l = lead({ conversation: [{ ...msg("outbound", 6), trigger: "unanswered", channel: "instagram" }, { ...msg("inbound", 5), channel: "instagram", quickReplyPayload: ANSWER }] });
    const status = computeAutomationStatus(l, RULES, NOW);
    expect(status.kind).toBe("waiting");
  });

  it("restarts everything once the lead types again after an exit tap", () => {
    const l = lead({
      conversation: [
        { ...msg("outbound", 30), trigger: "unanswered", channel: "instagram" },
        { ...msg("inbound", 29), channel: "instagram", quickReplyPayload: EXIT },
        { ...msg("inbound", 21), channel: "instagram", body: "actually, can you do next week?" },
      ],
    });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered" });
  });
});
