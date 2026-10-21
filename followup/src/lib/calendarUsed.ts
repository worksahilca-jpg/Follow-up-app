/**
 * Which calendar the owner books in (A-305, founder 2026-10-21: "for booking, we'll be asking them which calendar they
 * use. Otherwise, they can use ours or Google's", then "coll build it" to the drawing).
 *
 * Asked once, as the one question on Today (A-101). FollowUp books into Google Calendar today (with Gmail connected)
 * and into its own calendar; every other answer is noted, and until FollowUp can book into it the owner picks one of
 * those two (Business.bookingCalendarSource). Pure: the route, the card and Settings all read the same list.
 */

/** The name this question goes by in Business.questionsSkipped. */
export const CALENDAR_LABEL = "Your calendar";

export type CalendarKey = "google" | "outlook" | "gohighlevel" | "brokerbay" | "showingtime" | "calendly" | "other" | "none";

type Calendar = {
  key: CalendarKey;
  /** The pill, and the name in "FollowUp can't book into … yet". */
  label: string;
  /** Only realtors are shown it (a showing service, not a calendar anyone else uses). */
  realtorOnly?: boolean;
};

/** In the drawn order. "Something else" and "I don't use one" stay last. */
export const CALENDARS: readonly Calendar[] = [
  { key: "google", label: "Google Calendar" },
  { key: "outlook", label: "Outlook" },
  { key: "gohighlevel", label: "GoHighLevel" },
  { key: "brokerbay", label: "BrokerBay", realtorOnly: true },
  { key: "showingtime", label: "ShowingTime", realtorOnly: true },
  { key: "calendly", label: "Calendly" },
  { key: "other", label: "Something else" },
  { key: "none", label: "I don't use one" },
];

const KEYS = new Set<string>(CALENDARS.map((c) => c.key));

export function isCalendarKey(value: unknown): value is CalendarKey {
  return typeof value === "string" && KEYS.has(value);
}

/** The pills for this business: the showing services only for a realtor. */
export function calendarsFor(realtor: boolean): readonly Calendar[] {
  return CALENDARS.filter((c) => realtor || !c.realtorOnly);
}

export function calendarLabel(key: CalendarKey): string {
  return CALENDARS.find((c) => c.key === key)?.label ?? "Something else";
}

/** The question's title: showings for a realtor, meetings for everyone else. */
export function calendarQuestion(realtor: boolean): string {
  return realtor ? "Which calendar do you book showings in?" : "Which calendar do you book meetings in?";
}

export const CALENDAR_WHY = "So the times FollowUp offers are times you're really free, and bookings land where you look.";

/**
 * What answering means for where customers book:
 *  - "google": FollowUp books straight into it (Gmail connected).
 *  - "connect_gmail": it will, once Gmail is connected; until then nothing changes.
 *  - "followup": they don't use one, so FollowUp's own calendar.
 *  - "choose": FollowUp can't book into it yet; the owner picks FollowUp's calendar or Google's meanwhile.
 */
export type CalendarOutcome = "google" | "connect_gmail" | "followup" | "choose";

export function calendarOutcome(key: CalendarKey, gmailConnected: boolean): CalendarOutcome {
  if (key === "google") return gmailConnected ? "google" : "connect_gmail";
  if (key === "none") return "followup";
  return "choose";
}

/** The booking source an answer sets on its own, or null when the owner still has to choose (or connect Gmail). */
export function sourceForOutcome(outcome: CalendarOutcome): "google" | "followup" | null {
  return outcome === "google" ? "google" : outcome === "followup" ? "followup" : null;
}

/** "FollowUp can't book into BrokerBay yet." — "that calendar" for "Something else". */
export function cantBookYet(key: CalendarKey): string {
  return `FollowUp can't book into ${key === "other" ? "that calendar" : calendarLabel(key)} yet.`;
}

/**
 * The line under "Your calendar" in Settings: what FollowUp does with it today. Null when nothing needs saying.
 */
export function calendarFootnote(key: CalendarKey | null, source: string, gmailConnected: boolean): string | null {
  if (!key) return "Tell FollowUp which calendar you use, so bookings land where you look.";
  if (key === "none") return null;
  if (key === "google") {
    if (!gmailConnected) return "Connect Gmail and FollowUp books straight into it. Until then, customers book in FollowUp's calendar.";
    return source === "google" ? "FollowUp books straight into it." : null;
  }
  const name = key === "other" ? "that calendar" : calendarLabel(key);
  return `FollowUp can't book into ${name} yet, so customers book in the one you pick below.`;
}
