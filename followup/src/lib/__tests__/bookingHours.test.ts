/**
 * src/lib/bookingHours.ts — the days, hours and time zone behind a
 * business's booking link (A-078). The Settings card and the engine both
 * read these, so what they agree on is pinned here.
 */
import { describe, it, expect } from "vitest";
import {
  DEFAULT_BOOKING_HOURS,
  bookingHoursOf,
  bookingHoursProblem,
  describeBookingHours,
  describeDays,
  formatMinute,
  isValidTimeZone,
  normalizeBookingHours,
  timeOptions,
} from "@/lib/bookingHours";

describe("the default", () => {
  it("is Mon–Sat, 9am–7pm (founder, 2026-10-01)", () => {
    expect(DEFAULT_BOOKING_HOURS).toEqual({ days: [1, 2, 3, 4, 5, 6], startMinute: 540, endMinute: 1140 });
    expect(describeBookingHours(DEFAULT_BOOKING_HOURS)).toBe("Mon–Sat, 9:00 am–7:00 pm");
  });
});

describe("what can be saved", () => {
  it("accepts a sensible set", () => {
    expect(bookingHoursProblem({ days: [1, 3, 5], startMinute: 600, endMinute: 720 })).toBeNull();
  });
  it("needs at least one day", () => {
    expect(bookingHoursProblem({ days: [], startMinute: 540, endMinute: 1140 })).toMatch(/at least one day/i);
  });
  it("refuses a day that isn't 0–6, or one listed twice", () => {
    expect(bookingHoursProblem({ days: [7], startMinute: 540, endMinute: 1140 })).toMatch(/day of the week/i);
    expect(bookingHoursProblem({ days: [1, 1], startMinute: 540, endMinute: 1140 })).toMatch(/twice/i);
  });
  it("keeps times on the half hour and inside the day", () => {
    expect(bookingHoursProblem({ days: [1], startMinute: 545, endMinute: 1140 })).toMatch(/half hour/i);
    expect(bookingHoursProblem({ days: [1], startMinute: 540, endMinute: 1500 })).toMatch(/half hour/i);
  });
  it("needs the end after the start", () => {
    expect(bookingHoursProblem({ days: [1], startMinute: 600, endMinute: 600 })).toMatch(/after the start/i);
  });
});

describe("normalizing and reading a row", () => {
  it("sorts and de-duplicates days", () => {
    expect(normalizeBookingHours({ days: [6, 1, 3, 1], startMinute: 540, endMinute: 600 }).days).toEqual([1, 3, 6]);
  });
  it("reads a Business row, and falls back to the default when the row is missing or broken", () => {
    expect(bookingHoursOf({ bookingDays: [0, 6], bookingStartMinute: 600, bookingEndMinute: 900 })).toEqual({ days: [0, 6], startMinute: 600, endMinute: 900 });
    expect(bookingHoursOf({})).toEqual(DEFAULT_BOOKING_HOURS);
    expect(bookingHoursOf({ bookingDays: [], bookingStartMinute: 600, bookingEndMinute: 900 })).toEqual(DEFAULT_BOOKING_HOURS);
    expect(bookingHoursOf({ bookingDays: [1], bookingStartMinute: 900, bookingEndMinute: 600 })).toEqual(DEFAULT_BOOKING_HOURS);
  });
});

describe("how it reads to an owner", () => {
  it("collapses runs of days and names the odd ones", () => {
    expect(describeDays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(describeDays([1, 2, 3, 4, 5, 6])).toBe("Mon–Sat");
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeDays([1, 3, 5])).toBe("Mon, Wed, Fri");
    expect(describeDays([1, 2, 6, 0])).toBe("Mon, Tue, Sat, Sun");
    expect(describeDays([6])).toBe("Sat");
  });
  it("formats minutes as 12-hour times", () => {
    expect(formatMinute(0)).toBe("12:00 am");
    expect(formatMinute(540)).toBe("9:00 am");
    expect(formatMinute(720)).toBe("12:00 pm");
    expect(formatMinute(1170)).toBe("7:30 pm");
    expect(formatMinute(1440)).toBe("12:00 am");
  });
  it("offers every half hour from midnight to midnight", () => {
    const opts = timeOptions();
    expect(opts[0]).toEqual({ value: 0, label: "12:00 am" });
    expect(opts[opts.length - 1]).toEqual({ value: 1440, label: "12:00 am" });
    expect(opts).toHaveLength(49);
  });
});

describe("time zones", () => {
  it("accepts what Intl knows and refuses the rest", () => {
    expect(isValidTimeZone("America/Toronto")).toBe(true);
    expect(isValidTimeZone("America/Vancouver")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
