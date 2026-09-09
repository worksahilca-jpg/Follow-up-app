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
 * Deliberately its own tiny module rather than reusing src/lib/booking.ts's
 * private wallClock() — that one also resolves weekday and rounds to the
 * 30-minute slot grid a public booking page needs; this only needs the
 * local hour, and is used by src/lib/automation.ts and src/lib/sequences.ts,
 * neither of which should depend on booking.ts's internals.
 */

// 8am–6pm, exclusive end, local to the business (Business.timezone).
const SEND_WINDOW = { start: 8, end: 18 };

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
