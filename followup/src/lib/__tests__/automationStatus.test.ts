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
  canSend: true,
  // The default fixture is an account that has ALLOWED sending, so the
  // pre-existing expectations below keep describing what they were
  // written to describe. The held case — which is every real account's
  // default since 2026-09-21 — is exercised explicitly at the bottom.
  holdAllForApproval: false,
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
    aiPausedReason: null,
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

  // The 2026-09-19 case, in three parts. A real Instagram DM arrived on a
  // business whose plan didn't cover Instagram; checkAiEligibility refused
  // correctly and every caller dropped its reason. The lead then sat with
  // no score, no draft and a badge counting down to a follow-up that was
  // never coming. Each of these would have caught a different half of it.
  it("shows ai_paused, with the reason, when FollowUp refused to read or write for this lead", () => {
    const reason = "This lead came in on instagram, which the Free plan doesn't cover, so FollowUp didn't read it or write a reply.";
    const l = lead({ aiPausedReason: reason });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "ai_paused", reason });
  });

  it("never promises a follow-up on a paused lead — ai_paused wins over due_soon, waiting and an active workflow", () => {
    const reason = "Paused.";
    // Due now on the unanswered rule: without the pause this is due_soon.
    const due = lead({ aiPausedReason: reason, conversation: [msg("outbound", 48), msg("inbound", 25)] });
    expect(computeAutomationStatus(due, RULES, NOW)).toEqual({ kind: "ai_paused", reason });

    // On a plan with a dated next step: the badge would otherwise read
    // "next step in 2d", which is the most specific promise in the product.
    const onPlan = lead({
      aiPausedReason: reason,
      automationTier: "off",
      sequence: { name: "Recommended cadence", active: true, dueAt: new Date(NOW.getTime() + 2 * 86_400_000).toISOString() },
    });
    expect(computeAutomationStatus(onPlan, RULES, NOW)).toEqual({ kind: "ai_paused", reason });
  });

  it("still shows closed for a won or lost lead that happens to carry a pause reason", () => {
    // A finished deal is not waiting on FollowUp for anything, so the
    // pause is not news — "closed" stays the one thing worth saying.
    const l = lead({ stage: "won", aiPausedReason: "Paused." });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "closed" });
  });

  // 2026-09-19. An account whose only inbox had been disconnected since
  // Sept 7: runAutomationForBusiness and runSequencesForBusiness both
  // return empty before they look at a single lead, so nothing was ever
  // going to send — and every lead still read "Following up soon". The
  // dashboard's setup strip did say "Connect your inbox", so the owner
  // was not entirely in the dark; the LEADS were the lie.
  it("says nothing is connected, rather than promising a follow-up, when the account cannot send", () => {
    const rules = { ...RULES, canSend: false };
    const due = lead({ conversation: [msg("outbound", 48), msg("inbound", 25)] });
    expect(computeAutomationStatus(due, rules, NOW)).toEqual({ kind: "no_send_channel" });

    // And over a workflow's dated next step, which sequences.ts will not
    // run either.
    const onPlan = lead({
      automationTier: "off",
      sequence: { name: "Recommended cadence", active: true, dueAt: new Date(NOW.getTime() + 2 * 86_400_000).toISOString() },
    });
    expect(computeAutomationStatus(onPlan, rules, NOW)).toEqual({ kind: "no_send_channel" });
  });

  it("still explains the lead's own pause first — that one is specific, this one is true of every lead", () => {
    const l = lead({ aiPausedReason: "Paused." });
    expect(computeAutomationStatus(l, { ...RULES, canSend: false }, NOW)).toEqual({ kind: "ai_paused", reason: "Paused." });
  });

  it("still shows closed for a won deal in an account that cannot send", () => {
    const l = lead({ stage: "won" });
    expect(computeAutomationStatus(l, { ...RULES, canSend: false }, NOW)).toEqual({ kind: "closed" });
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
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered", heldForApproval: false });
  });

  it("uses the shorter first-reply window when the only outbound so far is the instant-ack template", () => {
    const l = lead({ conversation: [msg("inbound", 4), { ...msg("outbound", 3.95), trigger: "instant_ack" }] });
    // 4h since the lead's message: past the 3h first-reply threshold, well inside the normal 24h one
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered", heldForApproval: false });
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
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered", heldForApproval: false });
  });

  it("shows account_paused(unanswered) instead of due_soon when the master switch is off", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 25)] });
    expect(computeAutomationStatus(l, { ...RULES, masterEnabled: false }, NOW)).toEqual({ kind: "account_paused", reason: "unanswered", heldForApproval: false });
  });

  it("shows waiting with a rough ETA before the unanswered threshold is reached", () => {
    const l = lead({ conversation: [msg("outbound", 48), msg("inbound", 20)] });
    const status = computeAutomationStatus(l, RULES, NOW);
    expect(status.kind).toBe("waiting");
    expect((status as { etaHours: number }).etaHours).toBe(4); // 24h threshold - 20h elapsed
  });

  it("shows due_soon(dead_lead) once lastContacted crosses the dead-lead threshold", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 46 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "dead_lead", heldForApproval: false });
  });

  it("shows due_soon(silence) once lastContacted crosses the silence threshold but not the dead-lead one", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 6 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "silence", heldForApproval: false });
  });

  it("prefers the dead-lead reactivation reason over silence once a lead crosses both thresholds", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 100 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "dead_lead", heldForApproval: false });
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
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered", heldForApproval: false });
  });

  it("falls back to the dead-lead/silence threshold when the lead wrote but the unanswered rule itself is disabled", () => {
    const l = lead({
      lastContacted: new Date(NOW.getTime() - 6 * 86_400_000).toISOString(),
      conversation: [msg("inbound", 1)],
    });
    expect(computeAutomationStatus(l, { ...RULES, unansweredEnabled: false }, NOW)).toEqual({ kind: "due_soon", reason: "silence", heldForApproval: false });
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

  // SUPERSEDED (2026-09-23) by meta_window_closing. These two asserted
  // `due_soon` at 21 hours, to kill a badge that said "in 3h" while the
  // engine was about to send into a window Meta was about to shut.
  //
  // That intent is intact and sharper: the state here says the window
  // shuts in 3 hours and what happens when it does. `due_soon` conveyed
  // urgency and stopped there — it never said the draft would become
  // UNSENDABLE, which is the fact that decides whether the owner deals
  // with it now or tomorrow. The assertions are updated rather than
  // deleted so the 21-hour boundary stays pinned.
  it("reads an Instagram lead at 21 hours as a shutting window, not as three hours away", () => {
    expect(computeAutomationStatus(dmLead(21, "instagram"), RULES, NOW)).toEqual({
      kind: "meta_window_closing",
      channel: "Instagram",
      hoursLeft: 3,
      heldForApproval: false,
    });
  });

  it("reads a Messenger lead at 21 hours the same way", () => {
    expect(computeAutomationStatus(dmLead(21, "messenger"), RULES, NOW)).toEqual({
      kind: "meta_window_closing",
      channel: "Messenger",
      hoursLeft: 3,
      heldForApproval: false,
    });
  });

  it("leaves an email lead at 21 hours still counting down, as the owner configured", () => {
    const status = computeAutomationStatus(dmLead(21, "email"), RULES, NOW);
    expect(status.kind).not.toBe("due_soon");
  });

  it("holds the ceiling against a business that configured 72 hours", () => {
    const slow: BusinessAutomationRules = { ...RULES, unansweredHours: 72 };
    // Still not "days to go" on a DM channel, whatever the business
    // configured — which is what this test has always been about.
    expect(computeAutomationStatus(dmLead(21, "instagram"), slow, NOW)).toEqual({
      kind: "meta_window_closing",
      channel: "Instagram",
      hoursLeft: 3,
      heldForApproval: false,
    });
    // …and the same lead on email genuinely does have days to go.
    expect(computeAutomationStatus(dmLead(21, "email"), slow, NOW).kind).not.toBe("due_soon");
  });

  it("still counts down on an Instagram lead at 19 hours", () => {
    const status = computeAutomationStatus(dmLead(19, "instagram"), RULES, NOW);
    expect(status.kind).not.toBe("due_soon");
    // And no warning yet either: hour 19 is an ordinary, healthy
    // conversation and must not be painted gold.
    expect(status.kind).not.toBe("meta_window_closing");
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
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({ kind: "due_soon", reason: "unanswered", heldForApproval: false });
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
    // SUPERSEDED (2026-09-23): was `due_soon`. The point of this test is
    // that typing again REVIVES a lead who had tapped out — it must not
    // read as exited or off. That holds: the lead is live, actionable and
    // now carries its deadline too. They wrote 21 hours ago on Instagram
    // and nobody has answered, which is precisely the case the warning
    // exists for.
    expect(computeAutomationStatus(l, RULES, NOW)).toEqual({
      kind: "meta_window_closing",
      channel: "Instagram",
      hoursLeft: 3,
      heldForApproval: false,
    });
  });
});

/**
 * `holdAllForApproval` — the account-wide "nothing sends without my OK",
 * `@default(true)` since 2026-09-21 and therefore on for every real
 * account today.
 *
 * It is NOT a second masterEnabled, and the whole point of these tests is
 * that it must never be treated as one. With the master off nothing
 * happens; with hold on everything happens except the send. A lead is
 * still claimed, still drafted for — it is just held. So the status must
 * stay `due_soon` (something IS coming) and carry the flag that tells the
 * badge to describe a draft rather than a send.
 *
 * The badge's own sentences are pinned in
 * components/__tests__/AutomationStatusBadge.test.ts; this file pins that
 * the flag reaches it at all.
 */
describe("an account that holds every message for approval", () => {
  const HELD: BusinessAutomationRules = { ...RULES, holdAllForApproval: true };

  it("still reports a due lead as due, not as paused or off", () => {
    // The overcorrection this guards against: downgrading a held lead to
    // a stopped one. A reply really is being written for it.
    const l = lead({ lastContacted: new Date(NOW.getTime() - 10 * 86_400_000).toISOString() });
    const status = computeAutomationStatus(l, HELD, NOW);
    expect(status.kind).toBe("due_soon");
  });

  it("marks a due lead as held, so the badge can say a draft is coming", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 10 * 86_400_000).toISOString() });
    expect(computeAutomationStatus(l, HELD, NOW)).toEqual({ kind: "due_soon", reason: "silence", heldForApproval: true });
  });

  it("marks a waiting lead as held", () => {
    const l = lead({ conversation: [msg("inbound", 2)] });
    const status = computeAutomationStatus(l, HELD, NOW);
    expect(status).toMatchObject({ kind: "waiting", heldForApproval: true });
  });

  it("marks an account-paused lead as held, since the master switch is not the only thing stopping it", () => {
    const l = lead({ lastContacted: new Date(NOW.getTime() - 10 * 86_400_000).toISOString() });
    const status = computeAutomationStatus(l, { ...HELD, masterEnabled: false }, NOW);
    expect(status).toEqual({ kind: "account_paused", reason: "silence", heldForApproval: true });
  });

  it("does not resurrect a lead that is stopped for its own reasons", () => {
    // Holding is about what happens at the END of the pipeline. It must
    // not reorder anything above it: a paused lead, a lead with no send
    // channel and a closed deal are all unaffected.
    const reason = "This lead came in on instagram, which the Free plan doesn't cover.";
    expect(computeAutomationStatus(lead({ aiPausedReason: reason }), HELD, NOW)).toEqual({ kind: "ai_paused", reason });
    expect(computeAutomationStatus(lead(), { ...HELD, canSend: false }, NOW)).toEqual({ kind: "no_send_channel" });
    expect(computeAutomationStatus(lead({ stage: "won" }), HELD, NOW)).toEqual({ kind: "closed" });
    expect(computeAutomationStatus(lead({ automationTier: "off" }), HELD, NOW)).toEqual({ kind: "off" });
  });

  it("reports a lead awaiting their reply the same way — nothing is held, because nothing is due", () => {
    const l = lead({ conversation: [msg("outbound", 2)] });
    expect(computeAutomationStatus(l, HELD, NOW)).toEqual({ kind: "sent" });
  });
});
