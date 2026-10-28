import { describe, expect, it } from "vitest";
import { clockTime, dayOffset, daySentence, doneLines, greeting, nextLine, todaysInstruction, whoIsNext, nextForYouLine } from "@/lib/todayWords";

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

  it("says the day in one sentence, leaving out what there is none of (A-266)", () => {
    const n = { calls: 0, booked: 0, nextBookedAt: null, startWith: null };
    expect(daySentence({ ...n, people: 4, startWith: "Karan" })).toBe("4 people are waiting for your reply. Start with Karan.");
    expect(daySentence({ ...n, people: 1, startWith: "Karan" })).toBe("1 person is waiting for your reply. Start with Karan.");
    expect(daySentence({ ...n, people: 4, calls: 2, booked: 1, nextBookedAt: "3:00 PM", startWith: "Karan" })).toBe(
      "4 people are waiting for your reply, and you have 2 calls to make and 1 booked call at 3:00 PM. Start with Karan."
    );
    expect(daySentence({ ...n, people: 0, calls: 1, startWith: "Mei" })).toBe("You have 1 call to make today. Start with Mei.");
    expect(daySentence({ ...n, people: 0, booked: 3, nextBookedAt: "11:30 AM" })).toBe("You have 3 booked calls, the next at 11:30 AM today.");
    // A call to look back on (A-263) is said only when it is all there is: it is a row below.
    expect(daySentence({ ...n, people: 2, lookBack: 1, startWith: "Omar" })).toBe("2 people are waiting for your reply. Start with Omar.");
    expect(daySentence({ ...n, people: 0, lookBack: 1, startWith: "Daniel" })).toBe("You have a call to look back on. Start with Daniel.");
    expect(daySentence({ ...n, people: 0 })).toBe("Nothing needs you right now.");
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

describe("nextForYouLine (A-283)", () => {
  it("names the next call today by first name and time", () => {
    expect(nextForYouLine({ name: "Raj Malhotra", time: "3:00 PM", tomorrow: false })).toBe("Next: your call with Raj at 3:00 PM.");
  });
  it("says tomorrow when the next call is tomorrow", () => {
    expect(nextForYouLine({ name: "Aisha", time: "10:00 AM", tomorrow: true })).toBe("Next: your call with Aisha tomorrow at 10:00 AM.");
  });
  it("says nothing when no call is booked", () => {
    expect(nextForYouLine(null)).toBeNull();
  });
});

describe("nextLine (A-335, Today with less on the screen)", () => {
  it("says nothing when nobody else is waiting", () => {
    expect(nextLine([])).toBeNull();
  });
  it("names up to three people by first name", () => {
    expect(nextLine(["Ethan Wu"])).toBe("Next: Ethan");
    expect(nextLine(["Ethan Wu", "Mia Gill"])).toBe("Next: Ethan and Mia");
    expect(nextLine(["Ethan Wu", "Mia Gill", "Mason Roy"])).toBe("Next: Ethan, Mia and Mason");
  });
  it("counts the rest after three", () => {
    expect(nextLine(["Ethan Wu", "Mia Gill", "Mason Roy", "Ava Singh"])).toBe("Next: Ethan, Mia, Mason · 1 more");
    expect(nextLine(Array.from({ length: 15 }, (_, i) => `Person ${i}`))).toBe("Next: Person, Person, Person · 12 more");
  });
});
