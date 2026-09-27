/**
 * "Add to Google Calendar" and "Add to Apple / Outlook" on the booking
 * page's confirmation (design brain A-065). Built in the customer's browser
 * from the booked time alone: nothing is sent anywhere, and the business's
 * own calendar is untouched (that is createCalendarEvent's job, in
 * src/lib/booking.ts).
 */
export type CalendarEvent = { title: string; startIso: string; minutes: number; details?: string };

/** 20260929T143000Z — the UTC stamp both Google and iCalendar take. */
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function endOf(e: CalendarEvent): Date {
  return new Date(new Date(e.startIso).getTime() + e.minutes * 60_000);
}

export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(new Date(e.startIso))}/${stamp(endOf(e))}`,
  });
  if (e.details) params.set("details", e.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** iCalendar text escaping (RFC 5545 §3.3.11): backslash, semicolon, comma, newline. */
function escapeText(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A one-event .ics file, which Apple Calendar and Outlook both open. */
export function icsFile(e: CalendarEvent, uid: string, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FollowUp//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(new Date(e.startIso))}`,
    `DTEND:${stamp(endOf(e))}`,
    `SUMMARY:${escapeText(e.title)}`,
    ...(e.details ? [`DESCRIPTION:${escapeText(e.details)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
