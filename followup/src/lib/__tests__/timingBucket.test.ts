import { describe, expect, it } from "vitest";
import { timingBucketFromWords, timingDateFromWords } from "@/lib/timingBucket";

// The qualifying accuracy test's pinned day (src/lib/qualificationEval.ts).
const OCT_1 = new Date(Date.UTC(2026, 9, 1, 14));

describe("timingBucketFromWords", () => {
  it("counts the three dates the 2026-10-17 accuracy run got wrong", () => {
    expect(timingBucketFromWords("In about 2 months", OCT_1)).toBe("soon");
    expect(timingBucketFromWords("June 2027", OCT_1)).toBe("later");
    expect(timingBucketFromWords("By September 2027", OCT_1)).toBe("later");
  });

  it("takes the next month of that name when no year is given", () => {
    expect(timingBucketFromWords("Our lease ends in June", OCT_1)).toBe("later");
    expect(timingBucketFromWords("Moving by December", OCT_1)).toBe("soon");
    expect(timingBucketFromWords("We need to close before August 15", OCT_1)).toBe("later");
    expect(timingBucketFromWords("needed by next September", OCT_1)).toBe("later");
    expect(timingBucketFromWords("Hoping for March", OCT_1)).toBe("months");
  });

  it("counts days, weeks and months from today", () => {
    expect(timingBucketFromWords("Moving to Toronto for work in 6 weeks", OCT_1)).toBe("soon");
    expect(timingBucketFromWords("ready to buy in about 3 months", OCT_1)).toBe("soon");
    expect(timingBucketFromWords("within five months", OCT_1)).toBe("months");
    expect(timingBucketFromWords("in a year", OCT_1)).toBe("later");
  });

  it("leaves anything it can't pin to one date to the reader", () => {
    expect(timingBucketFromWords("this fall", OCT_1)).toBeNull();
    expect(timingBucketFromWords("next spring", OCT_1)).toBeNull();
    expect(timingBucketFromWords("as soon as possible", OCT_1)).toBeNull();
    expect(timingBucketFromWords("in 2 to 3 months", OCT_1)).toBeNull();
    expect(timingBucketFromWords("June or July", OCT_1)).toBeNull();
    expect(timingBucketFromWords("next November", OCT_1)).toBeNull();
    expect(timingBucketFromWords("", OCT_1)).toBeNull();
  });

  it("doesn't read the verb 'may' as a month", () => {
    expect(timingDateFromWords("We may buy something", OCT_1)).toBeNull();
    expect(timingBucketFromWords("Moving in May", OCT_1)).toBe("later");
  });
});
