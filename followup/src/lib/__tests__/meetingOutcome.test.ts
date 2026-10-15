/**
 * "How did it go?" (A-263), the words and the rules: which calls are asked
 * about, when they were, what each answer makes FollowUp do, and the plan
 * carrying on with a thank-you for someone still deciding.
 */
import { describe, it, expect } from "vitest";
import { endedMeetings, meetingWhen, missedNote, outcomeWords } from "@/lib/meetingOutcome";
import { followUpState, stepHint, stepLabel, checkInName } from "@/lib/followUpPlans";
import type { TimelineMessage } from "@/lib/followUpPlans";

const H = 3_600_000;
const D = 24 * H;
/** Thursday, October 15, 2026, 15:00 UTC (11:00 in Toronto). */
const NOW = new Date(Date.UTC(2026, 9, 15, 15));
const TZ = "America/Toronto";
const booking = (scheduledAt: Date, extra: Partial<{ durationMinutes: number; status: string; outcome: string | null }> = {}) => ({
  scheduledAt,
  durationMinutes: 30,
  status: "confirmed",
  outcome: null,
  ...extra,
});

describe("which calls are asked about", () => {
  it("a call that is over, within the week, not yet answered; newest first", () => {
    const yesterday = new Date(NOW.getTime() - D);
    const lastWeek = new Date(NOW.getTime() - 6 * D);
    const list = endedMeetings([booking(lastWeek), booking(yesterday)], NOW);
    expect(list.map((b) => b.scheduledAt)).toEqual([yesterday, lastWeek]);
  });

  it("not one still running, still ahead, canceled, answered, or older than the week", () => {
    expect(endedMeetings([booking(new Date(NOW.getTime() - 10 * 60_000))], NOW)).toEqual([]);
    expect(endedMeetings([booking(new Date(NOW.getTime() + D))], NOW)).toEqual([]);
    expect(endedMeetings([booking(new Date(NOW.getTime() - D), { status: "canceled" })], NOW)).toEqual([]);
    expect(endedMeetings([booking(new Date(NOW.getTime() - D), { outcome: "deciding" })], NOW)).toEqual([]);
    expect(endedMeetings([booking(new Date(NOW.getTime() - 9 * D))], NOW)).toEqual([]);
  });
});

describe("the card's words", () => {
  it("says when the call was, on the owner's clock", () => {
    expect(meetingWhen(new Date(Date.UTC(2026, 9, 14, 18)), NOW, TZ)).toBe("yesterday at 2:00 PM");
    expect(meetingWhen(new Date(Date.UTC(2026, 9, 15, 13, 30)), NOW, TZ)).toBe("today at 9:30 AM");
    expect(meetingWhen(new Date(Date.UTC(2026, 9, 12, 18)), NOW, TZ)).toBe("on Mon, Oct 12 at 2:00 PM");
  });

  it("says what FollowUp does after each answer", () => {
    expect(outcomeWords("working", "Raj", "Fast")).toEqual({ headline: "Raj is now your client.", body: "FollowUp stays out of the chat. If Raj writes, it comes to you." });
    expect(outcomeWords("deciding", "Raj", "Fast").body).toBe("FollowUp sends Raj a short thank-you tomorrow. Then the Fast plan carries on until Raj books again or says no.");
    expect(outcomeWords("not_going", "Raj", "Fast").body).toMatch(/^Marked Lost\. FollowUp sends nothing more\./);
    expect(outcomeWords("didnt_happen", "Raj", "Fast")).toEqual({ headline: "The call with Raj didn't happen.", body: "FollowUp offers Raj one new time, once, then waits." });
  });

  it("the note after a missed call carries the link and no blame", () => {
    const note = missedNote("Raj", "https://followupbase.io/book/abc", "Priya");
    expect(note).toBe(
      "Priya here, Raj. Sorry we missed each other. Pick any time that suits you here and I'll confirm it: https://followupbase.io/book/abc\nIf the day you want isn't there, tell me and I'll make it work."
    );
    expect(missedNote("Raj", "https://followupbase.io/book/abc", null)).toMatch(/^Hi, Raj\./);
  });
});

describe("the plan after a call they are still deciding about", () => {
  const t = (direction: "inbound" | "outbound", at: number): TimelineMessage => ({ direction, at, trigger: null });
  const nowMs = NOW.getTime();
  // They wrote, we answered, they booked through the link and the call was yesterday.
  const theyWrote = nowMs - 6 * D;
  const thread = [t("inbound", theyWrote), t("outbound", theyWrote + H)];
  const call = nowMs - D;

  it("starts again from the call: a thank-you due the day after, then the plan's own days", () => {
    const s = followUpState(thread, 0, {}, { bookings: [{ createdAt: theyWrote + 2 * H, scheduledAt: call, outcome: "deciding" }] }, nowMs, 45)!;
    expect(s.stopped).toBeNull();
    expect(s.kind).toBe("thanks");
    expect(s.step).toBe(0);
    expect(s.dueAt).toBe(call + D);
  });

  it("counts the thank-you once it has gone, and carries on with day 3", () => {
    const after = [...thread, t("outbound", call + D)];
    const s = followUpState(after, 0, {}, { bookings: [{ createdAt: theyWrote + 2 * H, scheduledAt: call, outcome: "deciding" }] }, nowMs + 2 * D, 45)!;
    expect(s.step).toBe(1);
    expect(s.kind).toBe("new");
  });

  it("still stops for a call that is ahead, unanswered, or didn't happen", () => {
    expect(followUpState(thread, 0, {}, { bookings: [{ createdAt: theyWrote + 2 * H, scheduledAt: nowMs + D }] }, nowMs, 45)!.stopped).toBe("booked");
    expect(followUpState(thread, 0, {}, { bookings: [{ createdAt: theyWrote + 2 * H, scheduledAt: call }] }, nowMs, 45)!.stopped).toBe("booked");
    expect(followUpState(thread, 0, {}, { bookings: [{ createdAt: theyWrote + 2 * H, scheduledAt: call, outcome: "didnt_happen" }] }, nowMs, 45)!.stopped).toBe("booked");
  });

  it("has words of its own for the thank-you", () => {
    expect(stepHint({ step: 0, total: 5, kind: "thanks", final: false }, 1)).toMatch(/^You met or spoke with them yesterday/);
    expect(stepLabel("thanks")).toBe("A thank-you the day after you met");
    expect(checkInName({ step: 0, total: 5, kind: "thanks" })).toBe("Thank-you after your call");
  });
});
