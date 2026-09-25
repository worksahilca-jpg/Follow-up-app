-- The follow-up strategy (2026-09-25) moved the first quiet-lead reminder
-- from day 5 to day 3. Every account was seeded with triggerDays = 5 for the
-- "Auto follow-up on silence" rule (src/lib/auth.ts), so a row still on 5 is
-- the old default, not a choice. Moved to 3 so the Settings field shows the
-- day the first reminder actually goes out (src/lib/reminderCadence.ts).
-- Data only; no schema change.
UPDATE "Automation" SET "triggerDays" = 3 WHERE "action" = 'auto_send' AND "triggerDays" = 5;
