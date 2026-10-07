/**
 * The rules of the realtor team pilot (A-103): which numbers can be called,
 * when the next call is, what the "No answer" text says, and when someone
 * on the team is flagged as behind.
 */
import { describe, it, expect } from "vitest";
import {
  MAX_UNANSWERED_CALLS,
  behindThisWeek,
  isCallablePhone,
  isNoAnswerDraft,
  nextCallAfter,
  noAnswerEmail,
  noAnswerText,
  ordinalCall,
  startOfLocalWeek,
  telHref,
} from "@/lib/callPlan";

describe("a number someone can dial", () => {
  it("is a real phone number", () => {
    expect(isCallablePhone("(905) 555-0143")).toBe(true);
    expect(isCallablePhone("+1 416 555 0199")).toBe(true);
  });
  it("is never an Instagram or Messenger id, or nothing", () => {
    expect(isCallablePhone("ig:17841400000000")).toBe(false);
    expect(isCallablePhone("fb:2345678901234")).toBe(false);
    expect(isCallablePhone(null)).toBe(false);
    expect(isCallablePhone("ext 12")).toBe(false);
  });
  it("dials the digits, keeping a leading +", () => {
    expect(telHref("(905) 555-0143")).toBe("tel:9055550143");
    expect(telHref("+1 416-555-0199")).toBe("tel:+14165550199");
  });
});

describe("the next call", () => {
  const at = new Date("2026-10-07T18:14:00Z");
  it("is a day later, at the same time", () => {
    expect(nextCallAfter(at, 1)?.toISOString()).toBe("2026-10-08T18:14:00.000Z");
    expect(nextCallAfter(at, 2)?.toISOString()).toBe("2026-10-08T18:14:00.000Z");
  });
  it(`stops after ${MAX_UNANSWERED_CALLS} calls with no answer`, () => {
    expect(nextCallAfter(at, MAX_UNANSWERED_CALLS)).toBeNull();
  });
});

describe("the text a No answer writes", () => {
  it("says who called, from where, and asks one easy question", () => {
    expect(noAnswerText("Priya", "Sam", "Maple Realty")).toBe("Hi Priya, it's Sam from Maple Realty. I just tried to call you. When's a good time to talk?");
  });
  it("still reads with a name or the business missing", () => {
    expect(noAnswerText("Priya", null, "Maple Realty")).toBe("Hi Priya, it's Maple Realty. I just tried to call you. When's a good time to talk?");
    expect(noAnswerText("", null, null)).toBe("Hi. I just tried to call you. When's a good time to talk?");
  });
  it("promises nothing: no price, no time, no figure", () => {
    expect(noAnswerText("Priya", "Sam", "Maple Realty")).not.toMatch(/\d|\$/);
  });
  it("has an email form with a subject", () => {
    const e = noAnswerEmail("Priya", "Sam", "Maple Realty");
    expect(e.subject).toBe("I tried to call you");
    expect(e.body).toBe("Hi Priya,\n\nIt's Sam from Maple Realty. I just tried to call you. When's a good time to talk?\n\nSam");
  });
  it("is recognised by its kind", () => {
    expect(isNoAnswerDraft("no_answer_text")).toBe(true);
    expect(isNoAnswerDraft("no_answer_email")).toBe(true);
    expect(isNoAnswerDraft("reminder_1")).toBe(false);
    expect(isNoAnswerDraft(null)).toBe(false);
  });
});

describe("words on the card", () => {
  it("counts calls", () => {
    expect(ordinalCall(1)).toBe("1st call");
    expect(ordinalCall(2)).toBe("2nd call");
    expect(ordinalCall(3)).toBe("3rd call");
    expect(ordinalCall(4)).toBe("4th call");
    expect(ordinalCall(11)).toBe("11th call");
  });
});

describe("this week", () => {
  it("starts on Monday at midnight in the business's own time", () => {
    // Thursday Oct 8, 2026, 10 pm in Toronto = Friday 02:00 UTC.
    const start = startOfLocalWeek(new Date("2026-10-09T02:00:00Z"), "America/Toronto");
    expect(start.toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });
  it("is today when today is Monday", () => {
    const start = startOfLocalWeek(new Date("2026-10-05T15:30:00Z"), "America/Toronto");
    expect(start.toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });

  const weekStart = new Date("2026-10-05T04:00:00Z");
  it("flags nobody with a meeting", () => {
    expect(behindThisWeek({ meetings: 1, lateCalls: 5 }, weekStart, new Date("2026-10-09T12:00:00Z"))).toBe(false);
  });
  it("flags no meetings from Wednesday on", () => {
    expect(behindThisWeek({ meetings: 0, lateCalls: 0 }, weekStart, new Date("2026-10-06T12:00:00Z"))).toBe(false);
    expect(behindThisWeek({ meetings: 0, lateCalls: 0 }, weekStart, new Date("2026-10-07T12:00:00Z"))).toBe(true);
  });
  it("flags late calls at once", () => {
    expect(behindThisWeek({ meetings: 0, lateCalls: 2 }, weekStart, new Date("2026-10-05T12:00:00Z"))).toBe(true);
  });
});
