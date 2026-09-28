-- What a lead's automationTier was before a follow-up plan set it OFF, so
-- it can be put back when the plan ends (src/lib/sequences.ts,
-- leaveSequence; founder 2026-09-28). One nullable column on an existing
-- table: no backfill, no lock beyond the brief ALTER.
ALTER TABLE "Lead" ADD COLUMN "tierBeforeSequence" "AutomationTier";
