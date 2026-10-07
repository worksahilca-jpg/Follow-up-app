-- One question a day on Today (A-101, founder 2026-10-07): when the next
-- question may show, and the ones the owner said "Not now" to. Additive only.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "questionAfter" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "questionsSkipped" TEXT[] DEFAULT ARRAY[]::TEXT[];
