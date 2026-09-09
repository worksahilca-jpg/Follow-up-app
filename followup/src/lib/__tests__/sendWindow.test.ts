import { describe, it, expect } from "vitest";
import { localHour, isWithinSendWindow } from "@/lib/sendWindow";

// Fixed UTC instants, checked against a couple of real IANA timezones —
// deliberately not mocking Intl, since the whole point is to trust the
// platform's own DST-aware conversion rather than reimplement it.
describe("localHour", () => {
  it("converts a UTC instant to the correct local hour, DST included", () => {
    // 2026-01-15T15:00:00Z — mid-January, EST (UTC-5): 10am local.
    expect(localHour(new Date("2026-01-15T15:00:00Z"), "America/New_York")).toBe(10);
    // 2026-07-15T15:00:00Z — mid-July, EDT (UTC-4): 11am local.
    expect(localHour(new Date("2026-07-15T15:00:00Z"), "America/New_York")).toBe(11);
  });

  it("handles a timezone crossing midnight correctly", () => {
    // 2026-01-15T15:00:00Z is 2026-01-16T00:00:00+09:00 in Tokyo — hour 0, not 24.
    expect(localHour(new Date("2026-01-15T15:00:00Z"), "Asia/Tokyo")).toBe(0);
  });
});

describe("isWithinSendWindow", () => {
  it("allows a send at 10am local", () => {
    expect(isWithinSendWindow(new Date("2026-01-15T15:00:00Z"), "America/New_York")).toBe(true);
  });

  it("blocks a send at 3am local", () => {
    // 2026-01-15T08:00:00Z = 3am EST.
    expect(isWithinSendWindow(new Date("2026-01-15T08:00:00Z"), "America/New_York")).toBe(false);
  });

  it("blocks exactly at the window's exclusive end (6pm)", () => {
    // 2026-01-15T23:00:00Z = 6pm EST.
    expect(isWithinSendWindow(new Date("2026-01-15T23:00:00Z"), "America/New_York")).toBe(false);
  });

  it("allows exactly at the window's inclusive start (8am)", () => {
    // 2026-01-15T13:00:00Z = 8am EST.
    expect(isWithinSendWindow(new Date("2026-01-15T13:00:00Z"), "America/New_York")).toBe(true);
  });
});
