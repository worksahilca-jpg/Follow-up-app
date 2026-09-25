/**
 * Send-window gate for automated sends — research/product/2026-09-09-
 * followup-cadence-best-practices.md §5, recommendation #5. An automated
 * follow-up that becomes eligible outside typical waking hours (an
 * automated text or email landing at 3am local to the business) is a
 * clearly bad case regardless of exactly how much weight the specific
 * day/time lift numbers in that research deserve — this is the cheap,
 * low-risk fix: gate the SEND itself on local time, not the eligibility
 * check, so a lead due at 2am still gets a message, just at the next
 * in-window hour rather than immediately.
 *
 * What it gates, since the founder's follow-up strategy (2026-09-25):
 * messages FollowUp starts on its own — the four quiet-lead reminders, the
 * 45-day welcome back, a workflow step, and a reply to a message that is
 * no longer fresh. It does NOT gate drafting or holding (a draft is ready
 * on Today at any hour), and it does not gate a reply to a message the
 * customer sent minutes ago: they are awake, they just wrote, and on
 * Instagram, Messenger and WhatsApp the 24-hour window is already running.
 *
 * Deliberately its own tiny module rather than reusing src/lib/booking.ts's
 * private wallClock() — that one also resolves weekday and rounds to the
 * 30-minute slot grid a public booking page needs; this only needs the
 * local hour, and is used by src/lib/automation.ts and src/lib/sequences.ts,
 * neither of which should depend on booking.ts's internals.
 */

// 8am–8pm, exclusive end, local to the business (Business.timezone).
// Widened from 6pm on 2026-09-25 (founder's follow-up strategy): an evening
// reminder is still a reasonable hour for a customer to read one, and the
// old 6pm end pushed every reminder due after work to the next morning.
const SEND_WINDOW = { start: 8, end: 20 };

/** The wall-clock hour (0-23) for this UTC instant in the given IANA timezone. */
export function localHour(instant: Date, timeZone: string): number {
  const hourStr = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hour12: false }).format(instant);
  // Intl can format midnight as "24" with hour12: false.
  return Number(hourStr) % 24;
}

export function isWithinSendWindow(instant: Date, timeZone: string): boolean {
  const hour = localHour(instant, timeZone);
  return hour >= SEND_WINDOW.start && hour < SEND_WINDOW.end;
}

/**
 * The business's local calendar date for this instant, as "YYYY-MM-DD".
 *
 * What "at most one automated message per lead per calendar day" compares
 * (src/lib/sending.ts). A string rather than a Date on purpose: two
 * instants are on the same local day exactly when these are equal, and
 * that needs no midnight arithmetic — which is where a DST change would
 * otherwise put an off-by-an-hour bug.
 */
export function localDateKey(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}
