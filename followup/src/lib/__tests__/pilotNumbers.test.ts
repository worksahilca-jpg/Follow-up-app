/**
 * The pilot's numbers (founder, 2026-10-22: "do 2"): whether FollowUp's calls were right, how much of the owner's
 * work it took, whether its next steps worked, what came of the appointments, and before FollowUp against since.
 */
import { describe, it, expect } from "vitest";
import {
  answering,
  beforeAndSince,
  countAppointments,
  countCalls,
  countReplies,
  hoursWords,
  MINUTES,
  percent,
  readOwnerBaseline,
  stepOf,
  type HistoryMessage,
} from "@/lib/pilotNumbers";

const H = 3_600_000;
const DAY = 24 * H;
const at = (iso: string) => new Date(iso);

describe("replies", () => {
  it("splits what went out by who wrote it, and guesses the minutes saved from MINUTES", () => {
    const r = countReplies([
      { automated: false, draftEdited: false, trigger: "unanswered", replied: true },
      { automated: false, draftEdited: true, trigger: "silence", replied: false },
      { automated: true, draftEdited: null, trigger: "instant_ack", replied: true },
      { automated: false, draftEdited: null, trigger: null, replied: false },
    ]);
    expect(r).toMatchObject({ asWritten: 1, changed: 1, onItsOwn: 1 });
    expect(r.minutesSaved).toBe(Math.round(MINUTES.write + (MINUTES.write - MINUTES.check) + (MINUTES.write - MINUTES.change)));
  });

  it("counts each next step FollowUp chose, and whether the customer wrote back after it", () => {
    const r = countReplies([
      { automated: true, draftEdited: null, trigger: "instant_ack", replied: true },
      { automated: false, draftEdited: false, trigger: "dm_handoff", replied: false },
      { automated: false, draftEdited: false, trigger: "sequence", replied: true },
      { automated: false, draftEdited: false, trigger: "stay_in_touch", replied: false },
      { automated: false, draftEdited: false, trigger: "something_new", replied: true },
    ]);
    expect(r.steps).toEqual({
      first_reply: { sent: 2, wroteBack: 1 },
      follow_up: { sent: 1, wroteBack: 1 },
      bring_back: { sent: 1, wroteBack: 0 },
    });
    expect(stepOf(null)).toBeNull();
    expect(stepOf("dead_lead_reactivation")).toBe("bring_back");
  });
});

describe("calls", () => {
  it("counts set-aside customers as let in (they are deleted), and brought-back ones as kept out", () => {
    const c = countCalls(
      [
        { tier: "ready", won: false, booked: true },
        { tier: "ready", won: false, booked: false },
        { tier: "warm", won: true, booked: false },
        { tier: null, won: false, booked: false },
      ],
      { setAside: 1, keptOut: 5, broughtBack: 1 }
    );
    // 4 here, 1 of them brought back (FollowUp kept it out), plus 1 set aside: 4 let in. 5 still out + 1 brought back: 6.
    expect(c).toMatchObject({ letIn: 4, setAside: 1, keptOut: 6, broughtBack: 1, ready: 2, readyBookedOrWon: 1 });
    expect(c.rightPercent).toBe(80);
  });

  it("counts every kind of call, and the customers whose plan the owner changed (A-310)", () => {
    const c = countCalls(
      [
        { tier: "ready", won: false, booked: false },
        { tier: "warm", won: false, booked: false, planPicked: true },
        { tier: "later", won: false, booked: false },
        { tier: "later", won: false, booked: false },
        { tier: "agent", won: false, booked: false },
      ],
      { setAside: 0, keptOut: 0, broughtBack: 0 }
    );
    expect(c).toMatchObject({ ready: 1, warm: 1, later: 2, agent: 1, planPicked: 1 });
  });

  it("has no percent before any call", () => {
    expect(countCalls([], { setAside: 0, keptOut: 0, broughtBack: 0 }).rightPercent).toBeNull();
  });
});

describe("appointments", () => {
  it("says what the owner told FollowUp happened, and what is still to come", () => {
    const now = at("2026-10-22T12:00:00Z");
    const a = countAppointments(
      [
        { scheduledAt: at("2026-10-10T15:00:00Z"), outcome: "working" },
        { scheduledAt: at("2026-10-11T15:00:00Z"), outcome: "didnt_happen" },
        { scheduledAt: at("2026-10-12T15:00:00Z"), outcome: null },
        { scheduledAt: at("2026-10-25T15:00:00Z"), outcome: null },
      ],
      now
    );
    expect(a).toEqual({ booked: 4, happened: 1, didnt: 1, notAnswered: 1, upcoming: 1 });
  });
});

describe("before FollowUp and since", () => {
  const connectedAt = at("2026-10-01T00:00:00Z");
  const now = at("2026-10-22T00:00:00Z");
  const m = (leadId: string, direction: string, iso: string): HistoryMessage => ({ leadId, direction, at: at(iso) });
  const history = [
    // Before: one answered in 10 h, one never answered, one that only the business wrote to.
    m("a", "inbound", "2026-09-01T08:00:00Z"),
    m("a", "outbound", "2026-09-01T18:00:00Z"),
    m("b", "inbound", "2026-09-10T08:00:00Z"),
    m("c", "outbound", "2026-09-12T08:00:00Z"),
    // Since: answered in 6 minutes.
    m("d", "inbound", "2026-10-05T08:00:00Z"),
    m("d", "outbound", "2026-10-05T08:06:00Z"),
  ];

  it("takes the 90 days before connecting, and the time since", () => {
    const r = beforeAndSince(history, connectedAt, now, 30);
    expect(r.before).toEqual({ wrote: 2, answered: 1, medianHours: 10 });
    expect(r.since).toEqual({ wrote: 1, answered: 1, medianHours: 0.1 });
  });

  it("ignores messages outside the window and a reply sent before the customer wrote", () => {
    const r = answering([m("e", "outbound", "2026-09-01T07:00:00Z"), m("e", "inbound", "2026-09-01T08:00:00Z")], at("2026-09-01T00:00:00Z"), at("2026-09-02T00:00:00Z"));
    expect(r).toEqual({ wrote: 1, answered: 0, medianHours: null });
    expect(answering(history, at("2026-01-01T00:00:00Z"), at("2026-02-01T00:00:00Z")).wrote).toBe(0);
  });

  it("keeps since inside the window when FollowUp connected long ago", () => {
    const r = beforeAndSince(history, at("2026-05-01T00:00:00Z"), now, 30);
    expect(r.since.wrote).toBe(1);
    expect(now.getTime() - 30 * DAY).toBeGreaterThan(at("2026-09-12T08:00:00Z").getTime());
  });
});

describe("the owner's own numbers", () => {
  it("keeps only numbers that make sense, and nothing when all are missing", () => {
    expect(readOwnerBaseline({ inquiriesPerMonth: 60, appointmentsPerMonth: "8", hoursPerWeek: -1 })).toEqual({
      inquiriesPerMonth: 60,
      appointmentsPerMonth: null,
      hoursPerWeek: null,
    });
    expect(readOwnerBaseline({})).toBeNull();
    expect(readOwnerBaseline(null)).toBeNull();
  });
});

describe("words", () => {
  it("says hours plainly", () => {
    expect(hoursWords(null)).toBe("—");
    expect(hoursWords(0.1)).toBe("6 min");
    expect(hoursWords(9.6)).toBe("10 h");
    expect(hoursWords(72)).toBe("3 days");
    expect(percent(1, 3)).toBe("33%");
    expect(percent(0, 0)).toBe("—");
  });
});
