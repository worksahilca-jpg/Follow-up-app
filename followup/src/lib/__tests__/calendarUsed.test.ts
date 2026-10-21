/**
 * Which calendar the owner books in (A-305): asked once, and until FollowUp can book into it, FollowUp's calendar or
 * Google's.
 */
import { describe, it, expect } from "vitest";
import { calendarFootnote, calendarOutcome, calendarQuestion, calendarsFor, cantBookYet, isCalendarKey, sourceForOutcome } from "@/lib/calendarUsed";

describe("the choices", () => {
  it("in the drawn order; the showing services only for a realtor", () => {
    expect(calendarsFor(true).map((c) => c.label)).toEqual([
      "Google Calendar",
      "Outlook",
      "GoHighLevel",
      "BrokerBay",
      "ShowingTime",
      "Calendly",
      "Something else",
      "I don't use one",
    ]);
    expect(calendarsFor(false).map((c) => c.key)).not.toContain("brokerbay");
    expect(calendarsFor(false).map((c) => c.key)).not.toContain("showingtime");
  });

  it("showings for a realtor, meetings for everyone else", () => {
    expect(calendarQuestion(true)).toBe("Which calendar do you book showings in?");
    expect(calendarQuestion(false)).toBe("Which calendar do you book meetings in?");
  });

  it("only a calendar on the list is an answer", () => {
    expect(isCalendarKey("brokerbay")).toBe(true);
    expect(isCalendarKey("BrokerBay")).toBe(false);
    expect(isCalendarKey(null)).toBe(false);
  });
});

describe("what the answer does", () => {
  it("Google Calendar: books into it with Gmail connected; otherwise asks for Gmail and changes nothing", () => {
    expect(calendarOutcome("google", true)).toBe("google");
    expect(sourceForOutcome("google")).toBe("google");
    expect(calendarOutcome("google", false)).toBe("connect_gmail");
    expect(sourceForOutcome("connect_gmail")).toBeNull();
  });

  it("no calendar: FollowUp's own", () => {
    expect(calendarOutcome("none", false)).toBe("followup");
    expect(sourceForOutcome("followup")).toBe("followup");
  });

  it("any other: FollowUp can't book into it yet, so the owner chooses", () => {
    for (const key of ["outlook", "gohighlevel", "brokerbay", "showingtime", "calendly", "other"] as const) {
      expect(calendarOutcome(key, true)).toBe("choose");
    }
    expect(sourceForOutcome("choose")).toBeNull();
    expect(cantBookYet("brokerbay")).toBe("FollowUp can't book into BrokerBay yet.");
    expect(cantBookYet("other")).toBe("FollowUp can't book into that calendar yet.");
  });
});

describe("the line in Settings", () => {
  it("says whether FollowUp can book into it", () => {
    expect(calendarFootnote("brokerbay", "followup", true)).toBe("FollowUp can't book into BrokerBay yet, so customers book in the one you pick below.");
    expect(calendarFootnote("google", "google", true)).toBe("FollowUp books straight into it.");
    expect(calendarFootnote("google", "followup", false)).toMatch(/^Connect Gmail and FollowUp books straight into it/);
    expect(calendarFootnote("none", "followup", false)).toBeNull();
    expect(calendarFootnote(null, "followup", false)).toBe("Tell FollowUp which calendar you use, so bookings land where you look.");
  });
});
