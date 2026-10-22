import { describe, expect, it } from "vitest";
import { callsWeek, callsWeekValue, dayLabel, inWeek, type WeekBooking } from "@/lib/callsWeek";

const TZ = "America/Toronto";
// Thursday, Oct 22, 2026, 6 PM in Toronto.
const NOW = new Date("2026-10-22T22:00:00Z");

const b = (id: string, name: string, iso: string, about: string | null = null, durationMinutes = 30): WeekBooking => ({
  id,
  leadId: `lead-${id}`,
  name,
  scheduledAt: new Date(iso),
  durationMinutes,
  about,
});

const WEEK = [
  b("raj", "Raj Malhotra", "2026-10-24T14:30:00Z", "Buying · Mississauga · Pre-approved up to $900k"),
  b("lucia", "Lucía Fernández", "2026-10-24T18:00:00Z", "Wants to see 3-bedroom condos downtown"),
  b("omar", "Omar Haddad", "2026-10-26T15:00:00Z", "Selling a semi in Etobicoke, before spring"),
  b("karan", "Karan Mehta", "2026-10-27T20:30:00Z", null),
  // Earlier today and over: its "How did it go?" is on Today, not here.
  b("done", "Linda Chow", "2026-10-22T17:00:00Z"),
  // The week after.
  b("later", "Ana Ruiz", "2026-10-29T14:00:00Z"),
];

describe("Calls this week (A-317)", () => {
  it("groups the next seven days by day, on the owner's clock, in time order", () => {
    const w = callsWeek(WEEK, NOW, TZ, "this");
    expect(w.total).toBe(4);
    expect(w.days.map((d) => d.label)).toEqual(["Saturday, Oct 24", "Monday, Oct 26", "Tuesday, Oct 27"]);
    expect(w.days[0].calls.map((c) => [c.time, c.name])).toEqual([
      ["10:30 AM", "Raj Malhotra"],
      ["2:00 PM", "Lucía Fernández"],
    ]);
    expect(w.days[0].calls[0]).toMatchObject({ bookingId: "raj", leadId: "lead-raj" });
  });

  it("names the days with nothing in one sentence", () => {
    expect(callsWeek(WEEK, NOW, TZ, "this").sentence).toBe(
      "4 calls, booked through your link in your free hours. Nothing today, tomorrow, Sunday or Wednesday.",
    );
  });

  it("names the busy days instead when most days are quiet", () => {
    const one = callsWeek([b("x", "Raj Malhotra", "2026-10-23T14:00:00Z")], NOW, TZ, "this");
    expect(one.sentence).toBe("1 call, booked through your link in your free hours. All tomorrow.");
    const two = callsWeek([b("x", "Raj", "2026-10-24T14:00:00Z"), b("y", "Omar", "2026-10-26T14:00:00Z")], NOW, TZ, "this");
    expect(two.sentence).toBe("2 calls, booked through your link in your free hours. All on Saturday and Monday.");
  });

  it("says plainly when nothing is booked", () => {
    expect(callsWeek([], NOW, TZ, "this")).toEqual({
      total: 0,
      days: [],
      sentence: "Nothing booked for the next 7 days. Customers book through your link, in your free hours.",
    });
    expect(callsWeek([], NOW, TZ, "next").sentence).toBe("Nothing booked for the 7 days after this week yet.");
  });

  it("keeps a call that has started and isn't over", () => {
    const now = new Date("2026-10-22T17:10:00Z");
    expect(inWeek(WEEK, now, TZ, "this").map((x) => x.id)).toContain("done");
    const w = callsWeek(WEEK, now, TZ, "this");
    expect(w.days[0].label).toBe("Today, Oct 22");
  });

  it("says what the call is about, or how long it is when nothing is known", () => {
    const w = callsWeek(WEEK, NOW, TZ, "this");
    expect(w.days[2].calls[0].about).toBe("30-minute call");
    expect(w.days[1].calls[0].about).toBe("Selling a semi in Etobicoke, before spring");
  });

  it("shows the seven days after as next week, across the clock change", () => {
    // Monday, Nov 2: Toronto is back on standard time (UTC−5) since Nov 1.
    const w = callsWeek([...WEEK, b("dst", "Sam Lee", "2026-11-02T14:00:00Z")], NOW, TZ, "next");
    expect(w.days.map((d) => d.label)).toEqual(["Thursday, Oct 29", "Monday, Nov 2"]);
    expect(w.days[1].calls[0].time).toBe("9:00 AM");
    expect(w.sentence).toBe("2 calls, booked through your link in your free hours. All on Thursday and Monday.");
  });

  it("labels today and tomorrow by name", () => {
    expect(dayLabel(0, NOW, TZ)).toBe("Today, Oct 22");
    expect(dayLabel(1, NOW, TZ)).toBe("Tomorrow, Oct 23");
  });

  it("gives Today's row its value", () => {
    expect(callsWeekValue(4)).toBe("4 booked");
    expect(callsWeekValue(0)).toBe("None yet");
  });
});
