/**
 * "Good morning" has to mean the OWNER's morning.
 *
 * The dashboard is a server component, so `new Date().getHours()` read
 * the server's clock — UTC on Vercel. A Toronto owner opening FollowUp
 * after dinner was greeted with "Good morning"; a Vancouver owner got it
 * through most of their working day. It is the first thing on the screen,
 * and getting it wrong tells the owner, in two words, that this product
 * does not know what time it is — in an app whose entire claim is knowing
 * when things happened and when to act.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { getGreeting } from "@/lib/demo-data";

afterEach(() => vi.useRealTimers());

/** A fixed instant, then read through different owners' wall clocks. */
function at(utcIso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(utcIso));
}

describe("getGreeting", () => {
  it("says good evening to a Toronto owner at 8pm, while UTC is still tomorrow morning", () => {
    // 2026-09-21T00:30Z is 8:30pm on the 20th in Toronto (UTC-4).
    at("2026-09-21T00:30:00Z");
    expect(getGreeting("America/Toronto")).toBe("Good evening");
    // The bug, stated: the same instant read on the server's own clock.
    expect(getGreeting("UTC")).toBe("Good morning");
  });

  it("says good afternoon to a Vancouver owner while UTC has moved to evening", () => {
    // 2026-09-20T22:00Z is 3pm in Vancouver (UTC-7).
    at("2026-09-20T22:00:00Z");
    expect(getGreeting("America/Vancouver")).toBe("Good afternoon");
    expect(getGreeting("UTC")).toBe("Good evening");
  });

  it("covers the three bands on one owner's clock", () => {
    at("2026-09-20T13:00:00Z"); // 9am Toronto
    expect(getGreeting("America/Toronto")).toBe("Good morning");
    at("2026-09-20T18:00:00Z"); // 2pm Toronto
    expect(getGreeting("America/Toronto")).toBe("Good afternoon");
    at("2026-09-20T23:00:00Z"); // 7pm Toronto
    expect(getGreeting("America/Toronto")).toBe("Good evening");
  });

  it("handles midnight, where Intl can report hour 24", () => {
    at("2026-09-21T04:00:00Z"); // 12:00am Toronto
    expect(getGreeting("America/Toronto")).toBe("Good morning");
  });
});
