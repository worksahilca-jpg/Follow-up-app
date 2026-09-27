import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile } from "@/lib/calendarLinks";

const call = { title: "Call with Harbour Home Services", startIso: "2026-09-29T14:30:00.000Z", minutes: 30 };

describe("the customer's own calendar links", () => {
  it("gives Google the booked half hour, in UTC", () => {
    const url = new URL(googleCalendarUrl(call));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Call with Harbour Home Services");
    expect(url.searchParams.get("dates")).toBe("20260929T143000Z/20260929T150000Z");
  });

  it("writes an .ics Apple Calendar and Outlook can open", () => {
    const ics = icsFile(call, "booking-abc@followup", new Date("2026-09-27T12:00:00.000Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20260929T143000Z\r\n");
    expect(ics).toContain("DTEND:20260929T150000Z\r\n");
    expect(ics).toContain("UID:booking-abc@followup\r\n");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes a business name that would break the file", () => {
    const ics = icsFile({ ...call, title: "Call with Smith, Jones; Co" }, "u");
    expect(ics).toContain("SUMMARY:Call with Smith\\, Jones\\; Co\r\n");
  });
});
