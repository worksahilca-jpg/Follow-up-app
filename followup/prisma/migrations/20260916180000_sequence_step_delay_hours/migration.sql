-- Workflow steps count in hours now, not whole days.
--
-- Additive and nullable: one new column, backfilled from delayDays so every
-- existing plan keeps exactly the timing it had. delayDays is not dropped —
-- the scheduler reads delayHours and falls back to delayDays * 24, and
-- writes keep both in step. See SequenceStep in schema.prisma for why hours:
-- Meta's 24-hour messaging window on Instagram and Messenger cannot be
-- scheduled into by a plan whose smallest unit is one day.

ALTER TABLE "SequenceStep" ADD COLUMN "delayHours" INTEGER;

UPDATE "SequenceStep" SET "delayHours" = "delayDays" * 24 WHERE "delayHours" IS NULL;
