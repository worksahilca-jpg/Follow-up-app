/** Round 2 (A-088): the work line and the end-of-day results only ever say what happened. */
import { describe, it, expect } from "vitest";
import { resultsLine, workLine } from "@/lib/workDone";

describe("workLine", () => {
  it("says what FollowUp did, in one sentence", () => {
    expect(workLine({ customersFound: 3, repliesWritten: 3, setAside: 39 })).toBe(
      "Since yesterday, FollowUp found 3 customers, wrote 3 replies, and set aside 39 emails that weren't customers."
    );
  });
  it("leaves out what is zero, and gets one right", () => {
    expect(workLine({ customersFound: 1, repliesWritten: 1, setAside: 0 })).toBe("Since yesterday, FollowUp found 1 customer and wrote 1 reply.");
    expect(workLine({ customersFound: 0, repliesWritten: 0, setAside: 1 })).toBe(
      "Since yesterday, FollowUp set aside 1 email that wasn't a customer."
    );
  });
  it("says nothing when nothing happened", () => {
    expect(workLine({ customersFound: 0, repliesWritten: 0, setAside: 0 })).toBeNull();
  });
});

describe("resultsLine", () => {
  it("says what came of the week", () => {
    expect(resultsLine({ answered: 11, cameBack: 2, booked: 1, heardBackMs: 12 * 60_000 })).toBe(
      "This week: 11 customers answered · 2 came back after a follow-up · 1 booked a call · customers heard back in 12 min."
    );
  });
  it("never shows a zero", () => {
    expect(resultsLine({ answered: 1, cameBack: 0, booked: 0, heardBackMs: null })).toBe("This week: 1 customer answered.");
    expect(resultsLine({ answered: 0, cameBack: 0, booked: 0, heardBackMs: null })).toBeNull();
  });
});
