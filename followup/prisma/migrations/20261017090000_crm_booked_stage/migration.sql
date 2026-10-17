-- "When they book a meeting, move them to" (A-275): the owner's chosen stage in their CRM, and its name.
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "bookedStage" TEXT;
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "bookedStageLabel" TEXT;
