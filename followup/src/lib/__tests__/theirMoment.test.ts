/**
 * "Their moment" (A-262), pinned one promise at a time: a time they named
 * about a plan of theirs is kept with their words; a time in the past, a
 * bare month, a viewing next week or "try me in March" is not; who may be
 * written to; and what the screens say.
 */
import { describe, it, expect } from "vitest";
import { MOMENT_WINDOW_DAYS, describeMoment, mayWriteMoment, momentSentence, readMoment, saidWhen } from "@/lib/theirMoment";

const D = 86_400_000;
/** Tuesday, October 13, 2026, in the evening. */
const OCT13 = Date.UTC(2026, 9, 13, 23, 52);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const TZ = "America/Toronto";

describe("reading a moment from their words", () => {
  it("keeps a step they named with a time, and their sentence", () => {
    const m = readMoment("Not yet, we'll talk to the bank in January. Around 1.2M", OCT13);
    expect(m).not.toBeNull();
    expect(day(m!.at)).toBe("2027-01-01");
    expect(m!.quote).toBe("Not yet, we'll talk to the bank in January.");
  });

  it("keeps a lease ending, and a season", () => {
    expect(day(readMoment("Our lease ends in March so we're hoping to move then.", OCT13)!.at)).toBe("2027-03-01");
    expect(day(readMoment("We're thinking of moving to Oakville next spring. Do you work there?", OCT13)!.at)).toBe("2027-03-20");
  });

  it("ignores a time in the past, a bare month, and a viewing next week", () => {
    expect(readMoment("The house we saw in May was nice.", OCT13)).toBeNull();
    expect(readMoment("March works for us.", OCT13)).toBeNull();
    expect(readMoment("We want to see it next week.", OCT13)).toBeNull();
  });

  it("leaves 'try me in March' to the plan's own hold", () => {
    expect(readMoment("Try me again in March.", OCT13)).toBeNull();
  });
});

describe("who may be written to when the moment comes", () => {
  const now = new Date(Date.UTC(2027, 0, 4, 14));
  const base = { stayInTouchAt: null, optedOutAt: null, saidNoAt: null, momentSaidAt: new Date(OCT13) };

  it("someone staying in touch, however long ago they wrote", () => {
    expect(mayWriteMoment({ ...base, stayInTouchAt: new Date(OCT13) }, new Date(now.getTime() - 300 * D), now)).toBe(true);
  });

  it("anyone else only while their enquiry is recent", () => {
    expect(mayWriteMoment(base, new Date(now.getTime() - 30 * D), now)).toBe(true);
    expect(mayWriteMoment(base, new Date(now.getTime() - (MOMENT_WINDOW_DAYS + 1) * D), now)).toBe(false);
    expect(mayWriteMoment(base, null, now)).toBe(false);
  });

  it("never after a no said since, or an opt-out", () => {
    expect(mayWriteMoment({ ...base, stayInTouchAt: new Date(OCT13), saidNoAt: new Date(OCT13 + 5 * D) }, new Date(now.getTime() - D), now)).toBe(false);
    expect(mayWriteMoment({ ...base, stayInTouchAt: new Date(OCT13), saidNoAt: new Date(OCT13 - 5 * D) }, new Date(now.getTime() - D), now)).toBe(true);
    expect(mayWriteMoment({ ...base, optedOutAt: new Date(OCT13) }, new Date(now.getTime() - D), now)).toBe(false);
  });
});

describe("what the screens say", () => {
  it("names the first week, or the day", () => {
    expect(describeMoment(new Date(Date.UTC(2027, 0, 1, 12)), TZ)).toBe("in the first week of January");
    expect(describeMoment(new Date(Date.UTC(2027, 2, 20, 12)), TZ)).toBe("around Mar 20");
    expect(momentSentence("Priya", new Date(Date.UTC(2027, 0, 1, 12)), TZ)).toBe("FollowUp brings Priya up on Today in the first week of January, with a note about it.");
  });

  it("says when they said it, with the year only when it differs", () => {
    expect(saidWhen(new Date(OCT13), new Date(Date.UTC(2027, 0, 4, 14)), TZ)).toBe("in October 2026");
    expect(saidWhen(new Date(OCT13), new Date(Date.UTC(2026, 11, 1, 14)), TZ)).toBe("in October");
  });
});
