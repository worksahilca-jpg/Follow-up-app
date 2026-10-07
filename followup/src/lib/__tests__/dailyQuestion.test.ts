/**
 * One question a day on Today (A-101). Never before FollowUp has had an hour
 * with the inbox, never twice in a day, "what do you do?" first for everyone,
 * then the trade's questions minus what is known or set aside.
 */
import { describe, it, expect } from "vitest";
import { businessAbout, isAskableLabel, pickDailyQuestion, whyAsk, WHAT_YOU_DO_LABEL } from "@/lib/dailyQuestion";

const now = new Date("2026-10-07T15:00:00Z");
const base = {
  trade: "Real estate",
  createdAt: new Date("2026-10-07T12:00:00Z"),
  questionAfter: null,
  questionsSkipped: [] as string[],
  knownLabels: [] as string[],
};

describe("when a question shows", () => {
  it("not in the first hour after setup", () => {
    expect(pickDailyQuestion({ ...base, createdAt: new Date("2026-10-07T14:30:00Z") }, now)).toBeNull();
  });

  it("not again until tomorrow after an answer or a Not now", () => {
    expect(pickDailyQuestion({ ...base, questionAfter: new Date("2026-10-08T09:00:00Z") }, now)).toBeNull();
    expect(pickDailyQuestion({ ...base, questionAfter: new Date("2026-10-07T09:00:00Z") }, now)).not.toBeNull();
  });
});

describe("which question", () => {
  it("asks what the business does first, for every trade", () => {
    expect(pickDailyQuestion(base, now)?.label).toBe(WHAT_YOU_DO_LABEL);
    expect(pickDailyQuestion({ ...base, trade: "Other" }, now)?.question).toBe("In a few words, what does your business do?");
  });

  it("then the trade's questions, skipping what is known or set aside", () => {
    const q = pickDailyQuestion({ ...base, knownLabels: ["what you do", "Commission"], questionsSkipped: ["Area you cover"] }, now);
    expect(q?.label).toBe("Showings");
  });

  it("nothing once every question is answered or set aside", () => {
    const all = ["What you do", "Commission", "Area you cover", "Showings", "How to book a viewing", "Home evaluation", "Who you work with", "Languages"];
    expect(pickDailyQuestion({ ...base, knownLabels: all }, now)).toBeNull();
  });
});

describe("the words", () => {
  it("says why in one line, in the trade's own terms", () => {
    expect(whyAsk({ label: "Commission", question: "", example: "" }, "Real estate")).toBe(
      "Realtors get asked this a lot. FollowUp will answer with your exact words."
    );
    expect(whyAsk({ label: "Prices", question: "", example: "" }, "Other")).toMatch(/^Customers ask this a lot\./);
    expect(whyAsk({ label: WHAT_YOU_DO_LABEL, question: "", example: "" }, null)).toMatch(/real customers from newsletters/);
  });

  it("only knows the questions it asks", () => {
    expect(isAskableLabel("Real estate", "what you do")).toBe(true);
    expect(isAskableLabel("Real estate", "Commission")).toBe(true);
    expect(isAskableLabel("Real estate", "Secret discount")).toBe(false);
  });

  it("finds the owner's own description among the facts", () => {
    expect(businessAbout([{ label: "Commission", value: "2.5%" }, { label: "What you do", value: " Homes in Brampton " }])).toBe("Homes in Brampton");
    expect(businessAbout([])).toBeNull();
  });
});
