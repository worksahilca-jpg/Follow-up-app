import { startOfLocalDay } from "@/lib/calmToday";

/**
 * "Later" (design brain A-046): the two times an owner can set a waiting
 * reply aside until, in their own time zone. Later today is 2pm, offered
 * only until 1:30pm so it is always worth choosing; tomorrow morning is
 * 9am.
 */
export type LaterChoice = "later_today" | "tomorrow_morning";

const HOUR = 3_600_000;

export function laterTime(choice: LaterChoice, now: Date, timeZone: string): Date {
  const midnight = startOfLocalDay(now, timeZone).getTime();
  return choice === "later_today" ? new Date(midnight + 14 * HOUR) : new Date(midnight + 24 * HOUR + 9 * HOUR);
}

/** Whether "Later today" still makes sense: at least half an hour before 2pm. */
export function laterTodayAvailable(now: Date, timeZone: string): boolean {
  return laterTime("later_today", now, timeZone).getTime() - now.getTime() >= HOUR / 2;
}
