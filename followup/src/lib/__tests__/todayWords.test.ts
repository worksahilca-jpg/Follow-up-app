import { describe, expect, it } from "vitest";
import { clockTime, dayLine, dayOffset, dayParts, dayProgress, doneLines, greeting, todaysInstruction, whoIsNext } from "@/lib/todayWords";

const TZ = "America/Toronto";

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

describe("the whole day (A-244, R-114)", () => {
  it("greets by the owner's own clock, by first name", () => {
    // 22:30 UTC is 6:30 PM in Toronto in October.
    expect(greeting(new Date("2026-10-14T22:30:00Z"), TZ, "Priya Sharma")).toBe("Good evening, Priya.");
    expect(greeting(new Date("2026-10-14T13:00:00Z"), TZ, "Priya")).toBe("Good morning, Priya.");
    expect(greeting(new Date("2026-10-14T17:00:00Z"), TZ, null)).toBe("Good afternoon.");
  });

  it("says who to start with, or that nothing needs the owner", () => {
    expect(dayLine("Raj", true)).toBe("Here is your day. Start with Raj.");
    expect(dayLine(null, true)).toBe("Here is your day.");
    expect(dayLine(null, false)).toBe("Nothing needs you right now.");
  });

  it("says what the day is made of once, leaving out what there is none of (A-250)", () => {
    expect(dayParts({ replies: 4, calls: 0, booked: 0, nextBookedAt: null })).toBe("4 replies to send. No calls or bookings today.");
    expect(dayParts({ replies: 1, calls: 0, booked: 0, nextBookedAt: null })).toBe("1 reply to send. No calls or bookings today.");
    // A call to look back on (A-263) comes first and keeps the replies in the line.
    expect(dayParts({ replies: 5, calls: 0, booked: 0, nextBookedAt: null, lookBack: 1 })).toBe("1 call to look back on · 5 replies to send. Nothing else booked today.");
    expect(dayParts({ replies: 0, calls: 1, booked: 0, nextBookedAt: null, lookBack: 2 })).toBe("2 calls to look back on · 1 call to make");
    expect(dayParts({ replies: 4, calls: 2, booked: 1, nextBookedAt: "3:00 PM" })).toBe("4 replies to send · 2 calls to make · 1 booked call at 3:00 PM");
    expect(dayParts({ replies: 0, calls: 1, booked: 0, nextBookedAt: null })).toBe("1 call to make");
    expect(dayParts({ replies: 0, calls: 0, booked: 3, nextBookedAt: "11:30 AM" })).toBe("3 booked calls, the next at 11:30 AM");
    // A booked call already over today keeps its count but not a time.
    expect(dayParts({ replies: 2, calls: 0, booked: 1, nextBookedAt: null })).toBe("2 replies to send · 1 booked call");
    expect(dayParts({ replies: 0, calls: 0, booked: 0, nextBookedAt: null })).toBeNull();
  });

  it("counts the day's progress, and shows none for an empty day", () => {
    expect(dayProgress(3, 8)).toEqual({ done: 3, total: 11, toGo: 8, pct: 27 });
    expect(dayProgress(0, 0)).toBeNull();
    expect(dayProgress(2, 0)).toEqual({ done: 2, total: 2, toGo: 0, pct: 100 });
  });

  it("puts a time on the owner's today or tomorrow, by their own calendar", () => {
    const now = new Date("2026-10-15T02:00:00Z"); // 10 PM Oct 14 in Toronto
    expect(dayOffset(new Date("2026-10-15T03:30:00Z"), now, TZ)).toBe(0); // 11:30 PM Oct 14
    expect(dayOffset(new Date("2026-10-15T14:30:00Z"), now, TZ)).toBe(1); // 10:30 AM Oct 15
    expect(clockTime(new Date("2026-10-15T14:30:00Z"), TZ)).toBe("10:30 AM");
  });

  it("says only what happened today", () => {
    expect(doneLines({ handled: 0, wroteFor: 0, booked: [] })).toEqual([]);
    expect(doneLines({ handled: 1, wroteFor: 2, booked: [{ name: "Jen Park", when: "tomorrow at 2:00 PM" }] })).toEqual([
      "You handled 1 customer.",
      "FollowUp wrote to 2 customers for you.",
      "Jen Park booked a call for tomorrow at 2:00 PM.",
    ]);
  });
});
