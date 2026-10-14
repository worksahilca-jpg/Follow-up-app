/**
 * The Settings "first reminder after N days" value every account is seeded
 * with (auth.ts) and the settings route falls back to. Kept because the
 * auto_send row still carries it; since the follow-up plans (A-245,
 * 2026-10-14) the days a customer gets come from their plan instead
 * (src/lib/followUpPlans.ts: Fast is day 1, 3, 7, 14, 30), and nothing
 * reads this number to schedule a message.
 *
 * History: 5 until 2026-09-25, then 3 with the four-reminder cadence (day
 * 3, 7, 14, 30) that the plans replaced.
 */
export const SILENCE_DEFAULT_TRIGGER_DAYS = 3;
