import { describe, expect, it } from "vitest";
import { todaysInstruction, whoIsNext } from "@/lib/todayWords";

describe("who comes next on Today (A-243)", () => {
  it("says nothing when nobody is after", () => {
    expect(whoIsNext([])).toBeNull();
  });

  it("names one or two people by first name", () => {
    expect(whoIsNext(["Ivy Chen"])).toBe("Ivy");
    expect(whoIsNext(["Ivy Chen", "Aman Gill"])).toBe("Ivy and Aman");
  });

  it("names two, then counts the rest", () => {
    expect(whoIsNext(["Ivy Chen", "Aman Gill", "Lucía Ramos", "Raj Malhotra"])).toBe("Ivy, Aman and 2 more");
    expect(whoIsNext(["Ivy Chen", "Aman Gill", "Lucía Ramos"])).toBe("Ivy, Aman and 1 more");
  });

  it("keeps a one-word name whole", () => {
    expect(whoIsNext(["UniglassPlus"])).toBe("UniglassPlus");
  });
});

describe("what Today tells the owner to do (A-243, R-113)", () => {
  it("says who to start with when several are waiting", () => {
    expect(todaysInstruction(5, "Omar")).toBe("Reply to them one at a time. Start with Omar.");
  });

  it("says it is the last one when one is left", () => {
    expect(todaysInstruction(1, "Omar")).toBe("Reply to Omar, then you're done.");
  });

  it("says nothing when nobody is waiting", () => {
    expect(todaysInstruction(0, "Omar")).toBeNull();
    expect(todaysInstruction(3, null)).toBeNull();
  });
});
