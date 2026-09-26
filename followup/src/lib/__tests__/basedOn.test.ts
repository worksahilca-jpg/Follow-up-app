/** "Based on" (A-043) only ever names what is really in the conversation. */
import { describe, it, expect } from "vitest";
import { describeBasis, findAmounts } from "@/lib/basedOn";

const now = new Date("2026-09-26T15:00:00Z");
const tz = "UTC";

describe("findAmounts", () => {
  it("finds amounts as written", () => {
    expect(findAmounts("Around $6,500 or 6500 dollars, maybe $7k")).toEqual(["$6,500", "6500 dollars", "$7k"]);
    expect(findAmounts("Thursday at 10")).toEqual([]);
  });
});

describe("describeBasis", () => {
  const base = [
    { direction: "outbound" as const, body: "A full redo is usually $6,500.", sentAt: new Date("2026-09-20T14:00:00Z"), channel: "instagram" },
    { direction: "inbound" as const, body: "Is Thursday still possible?", sentAt: new Date("2026-09-26T08:12:00Z"), channel: "instagram" },
  ];

  it("names the latest message and where a price was quoted", () => {
    expect(describeBasis({ draft: "Thursday works. Still around $6,500.", leadFirstName: "Priya", messages: base, now, timeZone: tz })).toBe(
      "Based on Priya's message on Instagram this morning and the $6,500 you quoted on Sep 20."
    );
  });

  it("leaves out an amount that appears nowhere earlier", () => {
    expect(describeBasis({ draft: "That would be $9,000.", leadFirstName: "Priya", messages: base, now, timeZone: tz })).toBe(
      "Based on Priya's message on Instagram this morning."
    );
  });

  it("credits a price the customer wrote to the customer", () => {
    const msgs = [{ direction: "inbound" as const, body: "My budget is $5,000", sentAt: new Date("2026-09-25T10:00:00Z"), channel: "email" }];
    expect(describeBasis({ draft: "We can work with $5,000.", leadFirstName: "Omar", messages: msgs, now, timeZone: tz })).toBe(
      "Based on Omar's message on email yesterday and the $5,000 Omar mentioned yesterday."
    );
  });

  it("never calls the phone agent's or an outside reply the owner's quote", () => {
    const msgs = [
      { direction: "outbound" as const, body: "It's $300", sentAt: new Date("2026-09-24T10:00:00Z"), channel: "call" },
      { direction: "inbound" as const, body: "ok", sentAt: new Date("2026-09-25T10:00:00Z"), channel: "text" },
    ];
    expect(describeBasis({ draft: "Yes, $300.", leadFirstName: "Dan", messages: msgs, now, timeZone: tz })).toBe("Based on Dan's message on text yesterday.");
  });

  it("says nothing when there is nothing to point at", () => {
    expect(describeBasis({ draft: "Hi!", leadFirstName: "Ana", messages: [], now, timeZone: tz })).toBeNull();
  });
});
