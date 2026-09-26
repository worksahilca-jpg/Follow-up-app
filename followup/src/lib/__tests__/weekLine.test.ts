import { describe, it, expect } from "vitest";
import { weekLine } from "@/lib/weekLine";

describe("weekLine (A-045)", () => {
  it("puts every non-zero number in one line", () => {
    expect(weekLine({ answered: 11, cameBack: 2, booked: 1, asWritten: 18, sent: 21 })).toBe(
      "This week: 11 customers answered · 2 came back · 1 booked · 18 of 21 sent without changing a word"
    );
  });
  it("leaves out the parts that are zero", () => {
    expect(weekLine({ answered: 1, cameBack: 0, booked: 0, asWritten: 0, sent: 3 })).toBe(
      "This week: 1 customer answered · 0 of 3 sent without changing a word"
    );
  });
  it("is null when there is nothing to say", () => {
    expect(weekLine({ answered: 0, cameBack: 0, booked: 0, asWritten: 0, sent: 0 })).toBeNull();
  });
});
