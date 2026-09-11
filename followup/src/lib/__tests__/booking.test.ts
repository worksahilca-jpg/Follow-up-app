/**
 * getAvailableSlots()/createBooking() (src/lib/booking.ts) — the logic
 * behind a lead's public booking link. Covers the fixed business-hours
 * grid (the original behavior, still the default) and the newer
 * "check my real Google Calendar too" mode (Business.bookingCalendarSource
 * === "google"): a lead should never be offered, or able to confirm, a
 * slot that collides with a real busy block on the owner's calendar.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn() },
    business: { findUnique: vi.fn() },
    booking: { findMany: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({
  createCalendarEvent: vi.fn(async () => ({ created: true })),
  getGoogleCalendarBusyTimes: vi.fn(async () => []),
}));

import { prisma } from "@/lib/db";
import { getGoogleCalendarBusyTimes } from "@/lib/integrations/gmail";
import { getAvailableSlots, createBooking } from "@/lib/booking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const googleBusy = getGoogleCalendarBusyTimes as unknown as ReturnType<typeof vi.fn>;

// A Monday, 12:00 UTC = 8:00am America/New_York (EDT, UTC-4 in September).
// MIN_NOTICE_MINUTES (60) pushes the earliest offerable slot to 13:00 UTC
// = 9:00am EDT — exactly business-hours open, which keeps the math in
// these tests simple (first slot == business-hours start, no partial hour
// to account for).
const MONDAY_8AM_ET_UTC = new Date("2026-09-14T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(MONDAY_8AM_ET_UTC);
  p.booking.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAvailableSlots — FollowUp's own calendar (default)", () => {
  it("returns the fixed business-hours grid, starting at 9am ET", async () => {
    p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", bookingCalendarSource: "followup" });

    const slots = await getAvailableSlots("lead1");

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toBe("2026-09-14T13:00:00.000Z"); // 9:00am ET
    expect(googleBusy).not.toHaveBeenCalled();
  });

  it("excludes a slot already booked in FollowUp's own table", async () => {
    p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", bookingCalendarSource: "followup" });
    p.booking.findMany.mockResolvedValue([{ scheduledAt: new Date("2026-09-14T13:00:00.000Z") }]);

    const slots = await getAvailableSlots("lead1");

    expect(slots).not.toContain("2026-09-14T13:00:00.000Z");
    expect(slots[0]).toBe("2026-09-14T13:30:00.000Z");
  });

  it("returns nothing for an unknown lead or business", async () => {
    p.lead.findUnique.mockResolvedValue(null);
    expect(await getAvailableSlots("ghost")).toEqual([]);

    p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
    p.business.findUnique.mockResolvedValue(null);
    expect(await getAvailableSlots("lead1")).toEqual([]);
  });
});

describe("getAvailableSlots — bookingCalendarSource: 'google'", () => {
  it("also excludes slots that overlap a real Google Calendar busy block", async () => {
    p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", bookingCalendarSource: "google" });
    // Busy 9:00-10:00am ET — should knock out the 9:00 and 9:30 slots but
    // leave 10:00 open.
    googleBusy.mockResolvedValue([{ start: "2026-09-14T13:00:00.000Z", end: "2026-09-14T14:00:00.000Z" }]);

    const slots = await getAvailableSlots("lead1");

    expect(slots).not.toContain("2026-09-14T13:00:00.000Z");
    expect(slots).not.toContain("2026-09-14T13:30:00.000Z");
    expect(slots).toContain("2026-09-14T14:00:00.000Z");
    expect(googleBusy).toHaveBeenCalledWith("biz1", expect.any(String), expect.any(String));
  });

  it("falls back to the fixed grid when Google Calendar returns no busy times (not connected, or a read error)", async () => {
    p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", bookingCalendarSource: "google" });
    googleBusy.mockResolvedValue([]);

    const slots = await getAvailableSlots("lead1");

    expect(slots[0]).toBe("2026-09-14T13:00:00.000Z");
  });

  it("never calls the Google Calendar read when the source is 'followup'", async () => {
    p.lead.findUnique.mockResolvedValue({ businessId: "biz1" });
    p.business.findUnique.mockResolvedValue({ timezone: "America/New_York", bookingCalendarSource: "followup" });

    await getAvailableSlots("lead1");

    expect(googleBusy).not.toHaveBeenCalled();
  });
});

describe("createBooking", () => {
  function lead() {
    return {
      id: "lead1",
      name: "Jamie",
      email: "jamie@example.com",
      businessId: "biz1",
      business: { name: "Acme", timezone: "America/New_York" },
    };
  }

  it("rejects a booking link for an unknown lead", async () => {
    p.lead.findUnique.mockResolvedValue(null);
    const result = await createBooking("ghost", "2026-09-14T13:00:00.000Z");
    expect(result.success).toBe(false);
  });

  it("rejects a time that's already in the past", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    const result = await createBooking("lead1", "2020-01-01T13:00:00.000Z");
    expect(result.success).toBe(false);
  });

  it("rejects a time outside business hours", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    const result = await createBooking("lead1", "2026-09-14T02:00:00.000Z"); // ~10pm ET the night before
    expect(result.success).toBe(false);
  });

  it("books a valid slot and creates a calendar event", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.booking.create.mockResolvedValue({ scheduledAt: new Date("2026-09-14T13:00:00.000Z") });
    p.lead.update.mockResolvedValue({});

    const result = await createBooking("lead1", "2026-09-14T13:00:00.000Z");

    expect(result).toEqual({ success: true, scheduledAt: "2026-09-14T13:00:00.000Z" });
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { nextFollowUp: expect.any(Date) } });
  });

  it("reports the slot as taken when two leads race for it (unique constraint)", async () => {
    p.lead.findUnique.mockResolvedValue(lead());
    p.booking.create.mockRejectedValue(new Error("Unique constraint failed"));

    const result = await createBooking("lead1", "2026-09-14T13:00:00.000Z");

    expect(result.success).toBe(false);
  });
});
