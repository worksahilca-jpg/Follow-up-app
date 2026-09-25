/**
 * The quiet-lead reminder calendar, with no server imports, so the Settings
 * screen can show the owner the exact days the engine will use
 * (src/lib/automation.ts re-exports all of this).
 */

/**
 * The Settings "first reminder after N days" value every account is seeded
 * with (auth.ts) and the settings route falls back to. It is reminder 1's
 * day, literally — the number on screen is the day the owner gets.
 *
 * Was 5 until 2026-09-25, when the follow-up strategy moved the first
 * reminder to day 3; migration 20260925130000_quiet_reminder_default moved
 * every row still on the old default. A special case that read 5 as "the
 * default, so day 3" was tried and dropped the same day: it made the
 * Settings field show 5 while the first reminder went on day 3, and made 5
 * impossible to choose.
 */
export const SILENCE_DEFAULT_TRIGGER_DAYS = 3;

/**
 * Four reminders, at days 3, 7, 14 and 30 after the message the customer
 * went quiet on, and then nothing.
 *
 * This replaced one flat trigger that nudged every `triggerDays` forever
 * with the same generic draft. research/product/2026-09-09-followup-
 * cadence-best-practices.md §2 and prioritized change #1: the category has
 * converged on an escalating, widening cadence (day 3, 7, 14, 21–30) with
 * a different angle each time, and on a ceiling — a person who has not
 * answered four different messages is not answering, and a fifth is the
 * point where persistence becomes pestering.
 *
 * Days are counted from the ANCHOR (see quietReminderPlan in
 * automation.ts), not from the previous reminder, so the calendar a
 * customer sees is the one above.
 */
export const QUIET_REMINDER_DEFAULT_DAYS: readonly number[] = [3, 7, 14, 30];

/**
 * The day each reminder is due, for this business.
 *
 * The Settings value is reminder 1's day (founder's call, 2026-09-25). The
 * later reminders keep the default calendar where they can, and are pushed
 * back only as far as it takes to keep at least the default gap after the
 * one before — an owner who asked for 10 days before the first nudge did
 * not ask for the second one four days later. At the default of 3 this is
 * exactly 3, 7, 14, 30.
 */
export function quietReminderDays(triggerDays: number): number[] {
  const defaults = QUIET_REMINDER_DEFAULT_DAYS;
  if (!Number.isFinite(triggerDays)) return [...defaults];
  const days = [Math.max(1, Math.round(triggerDays))];
  for (let i = 1; i < defaults.length; i++) {
    days.push(Math.max(defaults[i], days[i - 1] + (defaults[i] - defaults[i - 1])));
  }
  return days;
}
