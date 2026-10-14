/**
 * Follow-up plans (A-245), pinned one rule at a time: Fast, Long and the
 * owner's own plan, who goes on which, and the four rules on every plan.
 */
import { describe, it, expect } from "vitest";
import {
  FAST_DAYS,
  checkBackDate,
  checkInName,
  choosePlan,
  cleanDays,
  followUpState,
  planLine,
  planRows,
  planSteps,
  readFollowUpPlans,
  sixMonthsAfter,
  stepHint,
  stepWords,
  usedFor,
  withinSendLimits,
  type FollowUpPlans,
  type TimelineMessage,
} from "@/lib/followUpPlans";

const H = 3_600_000;
const D = 24 * H;
// Wednesday, Oct 14, 2026, 15:00 UTC: a fixed "now" so dates read plainly.
const NOW = Date.UTC(2026, 9, 14, 15);
const t = (direction: "inbound" | "outbound", at: number, trigger: string | null = null): TimelineMessage => ({ direction, at, trigger });
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** They wrote, we answered `replyDaysAgo` days ago, and they went quiet. */
function quiet(replyDaysAgo: number, extra: TimelineMessage[] = []): TimelineMessage[] {
  const reply = NOW - replyDaysAgo * D;
  return [t("inbound", reply - H), t("outbound", reply), ...extra];
}

describe("the owner's settings", () => {
  it("keeps only usable days: whole, 1 to 45, no repeats, in order, eight at most", () => {
    expect(cleanDays([7, 3, 3, 0, 46, 2.5, "5", 1])).toEqual([1, 3, 7]);
    expect(cleanDays([])).toBeNull();
    expect(cleanDays([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("reads a bad row as the plans as drawn, never as a plan nobody chose", () => {
    expect(readFollowUpPlans(null)).toEqual({});
    expect(readFollowUpPlans("fast")).toEqual({});
    expect(readFollowUpPlans({ fast: "1,2", own: { days: [] } })).toEqual({});
    expect(readFollowUpPlans({ own: { days: [2, 5], after: "sometimes", useFor: "everyone" } })).toEqual({ own: { days: [2, 5], after: "stop", useFor: "picked" } });
  });
});

describe("who goes on which plan", () => {
  it("puts Later customers on Long and everyone else on Fast", () => {
    expect(choosePlan({}, null, "later")).toBe("long");
    expect(choosePlan({}, null, "warm")).toBe("fast");
    expect(choosePlan({}, null, null)).toBe("fast");
  });

  it("lets the owner's pick on the customer's page win", () => {
    expect(choosePlan({}, "long", "warm")).toBe("long");
    expect(choosePlan({}, "fast", "later")).toBe("fast");
  });

  it("uses My own for whom the owner said, and falls back when it was deleted", () => {
    const own: FollowUpPlans = { own: { days: [2, 5], after: "stop", useFor: "most" } };
    expect(choosePlan(own, null, "warm")).toBe("own");
    expect(choosePlan(own, null, "later")).toBe("long");
    expect(choosePlan({ own: { ...own.own!, useFor: "later" } }, null, "later")).toBe("own");
    expect(choosePlan({ own: { ...own.own!, useFor: "picked" } }, null, "warm")).toBe("fast");
    expect(choosePlan({}, "own", "warm")).toBe("fast");
    expect(usedFor(own)).toEqual({ fast: null, long: "later", own: "most" });
  });
});

describe("the steps", () => {
  it("Fast: day 1 answers what's open, 3 something new, 7 one easy step, 14 new again, 30 closes the loop", () => {
    expect(planSteps({}, "fast")).toEqual([
      { day: 1, kind: "open" },
      { day: 3, kind: "new" },
      { day: 7, kind: "step" },
      { day: 14, kind: "new" },
      { day: 30, kind: "close" },
    ]);
  });

  it("Long: the Fast days, then once a month, the last one before six months closing the loop", () => {
    const steps = planSteps({}, "long", NOW, sixMonthsAfter(NOW));
    expect(steps.map((s) => s.day)).toEqual([1, 3, 7, 14, 30, 60, 90, 120, 150, 180]);
    expect(steps[steps.length - 1].kind).toBe("close");
    expect(steps.slice(5, -1).every((s) => s.kind === "new")).toBe(true);
  });

  it("lists the plans the way the drawing does", () => {
    expect(planRows({}, "fast").map((r) => `${r.day} | ${r.what}`)).toEqual([
      "Day 1 | Answer anything left open",
      "Day 3 | Something new that fits what they want",
      "Day 7 | One easy next step",
      "Day 14 | Something new again",
      "Day 30 | Close the loop: keep going, or close their file?",
    ]);
    expect(planRows({}, "long", true).map((r) => `${r.day} | ${r.what}`)).toEqual([
      "Day 1–30 | The same five as Fast",
      "Monthly | Something new each time, like a home that fits",
      "Month 6 | Close the loop, then stop",
    ]);
    expect(planLine({}, "fast")).toBe("Fast: day 1, 3, 7, 14, 30.");
    expect(planLine({}, "long")).toBe("Long: the Fast days, then once a month.");
    expect(planLine({ own: { days: [2, 5, 10, 21], after: "monthly", useFor: "most" } }, "own")).toBe("My own: day 2, 5, 10, 21, then once a month.");
  });
});

describe("where a quiet customer is", () => {
  it("is nowhere when they wrote last: they're owed a reply, not a follow-up", () => {
    expect(followUpState([t("outbound", NOW - 5 * D), t("inbound", NOW - H)], 0, {}, {}, NOW, 45)).toBeNull();
  });

  it("sends Fast's first message a day after the message they went quiet on", () => {
    const s = followUpState(quiet(0.5), 0, {}, {}, NOW, 45)!;
    expect(s).toMatchObject({ plan: "fast", step: 0, total: 5, kind: "open", stopped: null });
    expect(s.dueAt).toBe(NOW - 0.5 * D + 1 * D);
  });

  it("moves on once a message has gone, however it went", () => {
    const reply = NOW - 4 * D;
    const s = followUpState([...quiet(4), t("outbound", reply + 1 * D)], 0, {}, {}, NOW, 45)!;
    expect(s).toMatchObject({ step: 1, kind: "new" });
    expect(s.dueAt).toBe(reply + 3 * D);
  });

  it("closes the loop on day 30, then is finished", () => {
    const reply = NOW - 40 * D;
    const sent = [1, 3, 7, 14].map((d) => t("outbound", reply + d * D));
    const s = followUpState([...quiet(40), ...sent], 0, {}, {}, NOW, 45)!;
    expect(s).toMatchObject({ step: 4, kind: "close", final: true });
    const done = followUpState([...quiet(40), ...sent, t("outbound", reply + 30 * D)], 0, {}, {}, NOW, 45)!;
    expect(done).toMatchObject({ stopped: "finished", dueAt: null });
  });

  it("keeps a Later customer going once a month after day 30", () => {
    const reply = NOW - 40 * D;
    const sent = FAST_DAYS.map((d) => t("outbound", reply + d * D));
    const s = followUpState([...quiet(40), ...sent], 0, {}, { tier: "later" }, NOW, 45)!;
    expect(s).toMatchObject({ plan: "long", step: 5, kind: "new", final: false });
    expect(s.dueAt).toBe(reply + 60 * D);
  });

  it("stops when they book, or have a booking coming up", () => {
    const reply = NOW - 2 * D;
    expect(followUpState(quiet(2), 0, {}, { bookings: [{ createdAt: reply + H, scheduledAt: NOW - D }] }, NOW, 45)!.stopped).toBe("booked");
    expect(followUpState(quiet(2), 0, {}, { bookings: [{ createdAt: reply - 30 * D, scheduledAt: NOW + D }] }, NOW, 45)!.stopped).toBe("booked");
    // An old booking, before they last wrote, and already past: the plan runs.
    expect(followUpState(quiet(2), 0, {}, { bookings: [{ createdAt: reply - 30 * D, scheduledAt: reply - 20 * D }] }, NOW, 45)!.stopped).toBeNull();
  });

  it("stops six months after their last message", () => {
    // They last wrote in March; we answered in late August.
    const theyWrote = Date.UTC(2026, 2, 1, 12);
    const reply = Date.UTC(2026, 7, 28, 12);
    const s = followUpState([t("inbound", theyWrote), t("outbound", reply), t("outbound", reply + D)], 0, {}, {}, NOW, 45)!;
    expect(s.capAt).toBe(Date.UTC(2026, 8, 1, 12));
    expect(s).toMatchObject({ stopped: "six_months", dueAt: null });
  });

  it("never sends more than 1 a day or 3 a week", () => {
    expect(withinSendLimits(NOW, [NOW - 2 * H])).toBe(NOW - 2 * H + D);
    expect(withinSendLimits(NOW, [NOW - 5 * D, NOW - 3 * D, NOW - 2 * D])).toBe(NOW - 5 * D + 7 * D);
    // A split answer is one message to the person reading it.
    expect(withinSendLimits(NOW, [NOW - 5 * D, NOW - 5 * D + 60_000, NOW - 2 * D])).toBe(NOW);
    // My own, day 1, 2, 3, 4: the fourth waits for the week.
    const reply = NOW - 4 * D;
    const own: FollowUpPlans = { own: { days: [1, 2, 3, 4], after: "stop", useFor: "most" } };
    const s = followUpState([...quiet(4), ...[1, 2, 3].map((d) => t("outbound", reply + d * D))], 0, own, {}, NOW, 45)!;
    expect(s.step).toBe(3);
    expect(s.dueAt).toBe(reply + 1 * D + 7 * D);
  });

  it("holds everything until the day they asked for, then writes that day and carries on", () => {
    const march = Date.UTC(2027, 2, 1, 12);
    const held = followUpState(quiet(1), 0, {}, { tier: "later", notBeforeMs: march }, NOW, 45)!;
    expect(held).toMatchObject({ plan: "long", step: 0, kind: "checkback", heldUntil: march });
    expect(held.dueAt).toBe(march);
    // Back in touch on Mar 1; the next one follows on Long's calendar.
    const after = followUpState([...quiet(1), t("outbound", march)], 0, {}, { tier: "later", notBeforeMs: march }, march + 2 * D, 45)!;
    expect(after).toMatchObject({ step: 1, kind: "new", heldUntil: null });
    expect(after.dueAt).toBe(march + 2 * D);
  });

  it("does not start again after a welcome back went unanswered", () => {
    const s = followUpState([t("inbound", NOW - 100 * D), t("outbound", NOW - 99 * D), t("outbound", NOW - 40 * D)], 0, {}, {}, NOW, 45)!;
    expect(s.stopped).toBe("welcome_back");
  });

  it("ignores the instant 'got your message', which is not a follow-up", () => {
    const reply = NOW - 2 * D;
    const s = followUpState([t("inbound", reply - H), t("outbound", reply - H + 60_000, "instant_ack"), t("outbound", reply)], 0, {}, {}, NOW, 45)!;
    expect(s.step).toBe(0);
  });
});

describe("the words for each message", () => {
  it("gives each step its own job, and the rules on every one", () => {
    const hints = (["open", "new", "step", "close", "checkback"] as const).map((kind) => stepHint({ step: 1, total: 5, kind, final: false }, 4));
    expect(new Set(hints).size).toBe(5);
    for (const h of hints) {
      expect(h).toMatch(/Do not apologise/);
      expect(h).toMatch(/just checking in/);
      expect(h).toMatch(/Never state a price, date, time or fact/);
    }
    expect(stepHint({ step: 4, total: 5, kind: "close", final: true }, 30)).toMatch(/last message/);
  });

  it("names the next one plainly", () => {
    expect(stepWords(0, 5)).toBe("the first of 5");
    expect(stepWords(4, 5)).toBe("the last of 5");
    expect(checkInName({ step: 0, total: 5, kind: "open" })).toBe("First check-in");
    expect(checkInName({ step: 4, total: 5, kind: "close" })).toBe("Last check-in");
    expect(checkInName({ step: 2, total: 10, kind: "step" })).toBe("Check-in 3 of 10");
  });
});

describe("the day they asked to hear back", () => {
  const at = (text: string) => {
    const d = checkBackDate(text, NOW);
    return d === null ? null : day(d);
  };

  it("reads a clear ask, counted from when they wrote", () => {
    expect(at("Probably a 2 bed. Try me again in March, we'll know more by then.")).toBe("2027-03-01");
    expect(at("We're not looking until the spring")).toBe("2027-03-20");
    expect(at("Can you check back in a few months?")).toBe("2027-01-14");
    expect(at("Let's talk after the holidays")).toBe("2027-01-02");
    expect(at("text me next week")).toBe("2026-10-19");
    expect(at("Reach out early January please")).toBe("2027-01-01");
    expect(at("I'll be in touch in two weeks")).toBe("2026-10-28");
    expect(at("The end of November works better for us")).toBe("2026-11-20");
    expect(at("We won't be ready before May 2027")).toBe("2027-05-01");
  });

  it("holds nothing on a time that isn't an ask to wait", () => {
    expect(at("We're moving in March")).toBeNull();
    expect(at("We saw a house in May that we loved")).toBeNull();
    expect(at("I may call you later")).toBeNull();
    expect(at("Is the open house in October?")).toBeNull();
    expect(at("Talk in October?")).toBeNull();
    expect(at("We bought our last place in the spring of 2019")).toBeNull();
  });
});
