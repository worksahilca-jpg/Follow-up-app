import { startOfLocalDay } from "@/lib/calmToday";
import { clockTime, dayOffset } from "@/lib/todayWords";

/**
 * "Calls this week" (A-317): FollowUp's own calendar as one page. Every call booked through the owner's link for the
 * next seven days (today first), grouped by day on the owner's own clock, and one sentence that names the days with
 * none, so a quiet day is a word, not an empty box. "Next week" is the seven days after that.
 *
 * Pure: the page and Today's "Calls this week" row load the bookings and pass them in.
 */

export const DAYS_IN_WEEK = 7;

/** Which seven days: this week (today and the six after) or the seven after those. */
export type WhichWeek = "this" | "next";

/** One booking as the page needs it. `about` is the one line on what the call is about, already chosen. */
export type WeekBooking = {
  id: string;
  leadId: string;
  name: string;
  scheduledAt: Date;
  durationMinutes: number;
  about: string | null;
};

export type WeekCall = { bookingId: string; leadId: string; name: string; time: string; about: string };
export type WeekDay = { offset: number; label: string; calls: WeekCall[] };
export type CallsWeek = { total: number; days: WeekDay[]; sentence: string };

const firstOffset = (week: WhichWeek) => (week === "this" ? 0 : DAYS_IN_WEEK);

/**
 * The bookings that belong to the week, in time order. This week leaves out a call that is already over (it was
 * today, and its "How did it go?" is on Today), so the count on Today's row is what's still to come.
 */
export function inWeek<T extends Pick<WeekBooking, "scheduledAt" | "durationMinutes">>(
  bookings: T[],
  now: Date,
  timeZone: string,
  week: WhichWeek,
): T[] {
  const from = firstOffset(week);
  return bookings
    .filter((b) => {
      const d = dayOffset(b.scheduledAt, now, timeZone);
      if (d < from || d >= from + DAYS_IN_WEEK) return false;
      return b.scheduledAt.getTime() + b.durationMinutes * 60_000 > now.getTime();
    })
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/** Noon on the day `offset` days from today, on the owner's clock: safely inside that day whatever DST does. */
function noonOf(offset: number, now: Date, timeZone: string): Date {
  return new Date(startOfLocalDay(now, timeZone).getTime() + (12 + offset * 24) * 3_600_000);
}

/** A day by name: "today" and "tomorrow" for the first two, then the weekday ("Friday"). */
function dayWord(offset: number, now: Date, timeZone: string): string {
  if (offset === 0) return "today";
  if (offset === 1) return "tomorrow";
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(noonOf(offset, now, timeZone));
}

/** "today, Friday, Sunday or Wednesday". */
function list(words: string[], last: "or" | "and"): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} ${last} ${words[words.length - 1]}`;
}

/** The heading over a day: "Today, Oct 22", "Tomorrow, Oct 23", "Saturday, Oct 24" (shown in capitals). */
export function dayLabel(offset: number, now: Date, timeZone: string): string {
  const at = noonOf(offset, now, timeZone);
  const date = new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(at);
  const name = offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(at);
  return `${name}, ${date}`;
}

/** The whole page: the calls by day and the sentence under the title. */
export function callsWeek(bookings: WeekBooking[], now: Date, timeZone: string, week: WhichWeek): CallsWeek {
  const calls = inWeek(bookings, now, timeZone, week);
  const from = firstOffset(week);
  const byDay = new Map<number, WeekCall[]>();
  for (const b of calls) {
    const d = dayOffset(b.scheduledAt, now, timeZone);
    const row: WeekCall = {
      bookingId: b.id,
      leadId: b.leadId,
      name: b.name,
      time: clockTime(b.scheduledAt, timeZone),
      about: b.about?.trim() || `${b.durationMinutes}-minute call`,
    };
    byDay.set(d, [...(byDay.get(d) ?? []), row]);
  }
  const days: WeekDay[] = [...byDay.entries()].sort(([a], [b]) => a - b).map(([offset, c]) => ({ offset, label: dayLabel(offset, now, timeZone), calls: c }));

  const total = calls.length;
  if (total === 0) {
    return {
      total,
      days,
      sentence:
        week === "this"
          ? "Nothing booked for the next 7 days. Customers book through your link, in your free hours."
          : "Nothing booked for the 7 days after this week yet.",
    };
  }
  const offsets = Array.from({ length: DAYS_IN_WEEK }, (_, i) => from + i);
  const quiet = offsets.filter((o) => !byDay.has(o)).map((o) => dayWord(o, now, timeZone));
  // "on Saturday and Monday", "today and on Saturday": one "on", before the first weekday.
  const firstWeekday = days.findIndex((d) => d.offset > 1);
  const busy = days.map((d, i) => (i === firstWeekday ? "on " : "") + dayWord(d.offset, now, timeZone));
  const count = `${total} ${total === 1 ? "call" : "calls"}, booked through your link in your free hours.`;
  // Name the shorter list: the days with nothing when there are a few, otherwise the days that have calls.
  const rest = quiet.length === 0 ? "" : quiet.length <= 4 ? ` Nothing ${list(quiet, "or")}.` : ` All ${list(busy, "and")}.`;
  return { total, days, sentence: count + rest };
}

/** Today's row in Later (A-317): "4 booked", or "None yet". */
export function callsWeekValue(count: number): string {
  return count > 0 ? `${count} booked` : "None yet";
}
