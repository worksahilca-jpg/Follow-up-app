/**
 * "Stay in touch" (A-260), pinned one promise at a time: only after a yes to
 * the close-the-loop question, no plan message or welcome back while it
 * holds, notes spaced out, every note says how to stop, and Today says
 * plainly what was written and what wasn't.
 */
import { describe, it, expect } from "vitest";
import {
  STOP_LINE,
  cleanStayDays,
  mayAskForNews,
  namesList,
  newsQuestion,
  newsResultLines,
  noteDue,
  stayEvery,
  withStopLine,
} from "@/lib/stayInTouch";
import { closedTheLoop, followUpState, quietLeadNext, type TimelineMessage } from "@/lib/followUpPlans";

const H = 3_600_000;
const D = 24 * H;
const NOW = Date.UTC(2026, 9, 15, 15);
const t = (direction: "inbound" | "outbound", at: number): TimelineMessage => ({ direction, at, trigger: null });

/** They wrote, we answered, then `sent` plan messages went out on the Fast days (1, 3, 7, 14, 30). */
function fastSpell(sent: number): { timeline: TimelineMessage[]; asOf: number } {
  const reply = NOW - 40 * D;
  const days = [1, 3, 7, 14, 30].slice(0, sent);
  const timeline = [t("inbound", reply - H), t("outbound", reply), ...days.map((d) => t("outbound", reply + d * D))];
  return { timeline, asOf: reply + (days[days.length - 1] ?? 0) * D + 2 * H };
}

describe("how often", () => {
  it("is every 2 weeks or once a month, nothing else", () => {
    expect(cleanStayDays(14)).toBe(14);
    expect(cleanStayDays(30)).toBe(30);
    expect(cleanStayDays(3)).toBe(30);
    expect(cleanStayDays(undefined)).toBe(30);
    expect(stayEvery(14)).toBe("every 2 weeks");
    expect(stayEvery(30)).toBe("once a month");
  });

  it("spaces the notes: one per period per customer", () => {
    const now = new Date(NOW);
    expect(noteDue(null, 30, now)).toBe(true);
    expect(noteDue(new Date(NOW - 10 * D), 30, now)).toBe(false);
    expect(noteDue(new Date(NOW - 30 * D), 30, now)).toBe(true);
    expect(noteDue(new Date(NOW - 14 * D), 14, now)).toBe(true);
  });

  it("asks the owner for news at most twice a period", () => {
    const now = new Date(NOW);
    expect(mayAskForNews(null, 30, now)).toBe(true);
    expect(mayAskForNews(new Date(NOW - 5 * D), 30, now)).toBe(false);
    expect(mayAskForNews(new Date(NOW - 15 * D), 30, now)).toBe(true);
    expect(mayAskForNews(new Date(NOW - 7 * D), 14, now)).toBe(true);
  });
});

describe("the plan knows when it closed the loop", () => {
  it("Day 30 on Fast is the close-the-loop message; Day 7 isn't", () => {
    const five = fastSpell(5);
    expect(closedTheLoop(followUpState(five.timeline, NOW - 40 * D, {}, {}, five.asOf, 45), {})).toBe(true);
    const three = fastSpell(3);
    expect(closedTheLoop(followUpState(three.timeline, NOW - 40 * D, {}, {}, three.asOf, 45), {})).toBe(false);
  });

  it("Day 30 closes the loop on Long too, before its monthly part", () => {
    const five = fastSpell(5);
    expect(closedTheLoop(followUpState(five.timeline, NOW - 40 * D, {}, { tier: "later" }, five.asOf, 45), {})).toBe(true);
  });

  it("a booked customer was never asked", () => {
    const five = fastSpell(5);
    const state = followUpState(five.timeline, NOW - 40 * D, {}, { bookings: [{ createdAt: five.asOf - D, scheduledAt: NOW + D }] }, five.asOf, 45);
    expect(closedTheLoop(state, {})).toBe(false);
  });
});

describe("while they're staying in touch", () => {
  it("no plan message and no welcome back go, ever", () => {
    const five = fastSpell(2);
    const state = followUpState(five.timeline, NOW - 40 * D, {}, { stayingSince: NOW - 20 * D }, NOW, 45);
    expect(state?.stopped).toBe("staying");
    expect(state?.dueAt).toBeNull();
    expect(quietLeadNext(state, { pastWelcomeBackWait: true, welcomeBackOn: true, welcomeBackSent: false, nowMs: NOW })).toBeNull();
  });

  it("someone who just wrote is still owed a reply", () => {
    const state = followUpState([t("outbound", NOW - 2 * D), t("inbound", NOW - H)], NOW - 3 * D, {}, { stayingSince: NOW - 20 * D }, NOW, 45);
    expect(state).toBeNull();
  });
});

describe("every note says how to stop", () => {
  it("adds the stop line to an English note that lacks one", () => {
    expect(withStopLine("Hi Anika, a 4-bed in Glen Abbey just listed at $1.19M.", "en")).toBe(`Hi Anika, a 4-bed in Glen Abbey just listed at $1.19M. ${STOP_LINE}`);
    expect(withStopLine("Hi Anika, new one in Oakville", null)).toBe(`Hi Anika, new one in Oakville. ${STOP_LINE}`);
  });

  it("leaves a note that already says it alone", () => {
    const note = "Hi Anika, a new listing in Oakville. If you'd like me to stop these, just say.";
    expect(withStopLine(note, "en")).toBe(note);
  });

  it("never bolts English onto a note in another language", () => {
    const note = "Hola Ana, hay una casa nueva en Oakville.";
    expect(withStopLine(note, "es")).toBe(note);
  });
});

describe("what Today says", () => {
  it("names who it fits, and who it doesn't and why", () => {
    const lines = newsResultLines({ fit: ["Anika", "Raj"], notFit: [{ first: "Tom", why: "wants a 2-bed condo in Liberty Village." }], notDue: 0, waiting: 0 });
    expect(lines[0]).toBe("Saved. It fits Anika and Raj, so each gets a note written for them. Both are on Today, waiting for your OK.");
    expect(lines[1]).toBe("Nothing for Tom this time: wants a 2-bed condo in Liberty Village.");
  });

  it("says plainly when nothing was written", () => {
    expect(newsResultLines({ fit: [], notFit: [], notDue: 0, waiting: 0 })[0]).toMatch(/doesn't fit anyone/);
  });

  it("never calls a failed note a misfit", () => {
    const lines = newsResultLines({ fit: [], notFit: [], notDue: 0, waiting: 0, failed: 1 });
    expect(lines[0]).toBe("Saved.");
    expect(lines[1]).toMatch(/couldn't write one of the notes just now/);
  });

  it("says who was left and why", () => {
    const lines = newsResultLines({ fit: ["Anika"], notFit: [], notDue: 2, waiting: 1, unreachable: 1 });
    expect(lines).toContain("One customer already has a message waiting for your OK, so FollowUp didn't write another.");
    expect(lines).toContain("2 customers had a note recently, so they're left for now.");
    expect(lines.some((l) => /Instagram or Messenger/.test(l))).toBe(true);
  });

  it("asks with names, never a bare count for one", () => {
    expect(newsQuestion(1, ["Anika"])).toBe("Anything new for Anika, who's staying in touch?");
    expect(newsQuestion(3, ["Anika", "Raj", "Tom"])).toBe("Anything new for the 3 customers staying in touch?");
    expect(namesList(["Anika", "Raj", "Tom", "Mei", "Jo"])).toBe("Anika, Raj and 3 more");
  });
});
