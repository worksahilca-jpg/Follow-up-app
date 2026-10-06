/**
 * "Later" (design brain A-046): the two times an owner can set a waiting
 * reply aside until, in their own time zone. Later today is 2pm, offered
 * only until 1:30pm so it is always worth choosing; tomorrow morning is
 * 9am.
 */
export type LaterChoice = "later_today" | "tomorrow_morning";

const HOUR = 3_600_000;

/** The wall-clock reading of `instant` in `timeZone`, as if that reading were UTC. */
function wallClockAsUtc(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/**
 * The instant it is `hour`:00 on the local calendar day `daysAhead` after
 * today's, in `timeZone`.
 *
 * Found by the zone's own offset at that moment, not by counting hours
 * from local midnight. Counting was an hour out on the days the clocks
 * change: the Sunday in March has 23 hours, so midnight + 14h is 3pm, and
 * "tomorrow 9am" set on the Saturday was 10am (8am in November).
 */
function localTimeOn(now: Date, daysAhead: number, hour: number, timeZone: string): Date {
  const today = new Date(wallClockAsUtc(now.getTime(), timeZone));
  const target = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + daysAhead, hour);
  // Offset of the zone near the target, then again at the first guess, so
  // a guess that lands on the other side of a clock change corrects itself.
  const first = target - (wallClockAsUtc(target, timeZone) - target);
  return new Date(target - (wallClockAsUtc(first, timeZone) - first));
}

export function laterTime(choice: LaterChoice, now: Date, timeZone: string): Date {
  return choice === "later_today" ? localTimeOn(now, 0, 14, timeZone) : localTimeOn(now, 1, 9, timeZone);
}

/** Whether "Later today" still makes sense: at least half an hour before 2pm. */
export function laterTodayAvailable(now: Date, timeZone: string): boolean {
  return laterTime("later_today", now, timeZone).getTime() - now.getTime() >= HOUR / 2;
}

/** The day of the week at `instant` in `timeZone`: 0 = Sunday … 6 = Saturday. */
export function localWeekday(instant: Date, timeZone: string): number {
  const d = new Date(wallClockAsUtc(instant.getTime(), timeZone));
  return d.getUTCDay();
}

/** Saturday or Sunday at `instant`, in the business's time zone. */
export function isLocalWeekend(instant: Date, timeZone: string): boolean {
  const day = localWeekday(instant, timeZone);
  return day === 0 || day === 6;
}

/**
 * 9 am on the Monday after a weekend `now` — what the "weekend_wait" habit
 * (src/lib/habits.ts) holds weekend messages until. Only meaningful on a
 * Saturday or Sunday; on any other day it is the next Monday.
 */
export function mondayMorning(now: Date, timeZone: string): Date {
  const day = localWeekday(now, timeZone);
  const ahead = day === 0 ? 1 : (8 - day) % 7 || 7;
  return localTimeOn(now, ahead, 9, timeZone);
}
