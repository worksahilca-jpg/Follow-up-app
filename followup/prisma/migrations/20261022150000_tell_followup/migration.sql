-- "Tell FollowUp about your business" (A-311): when the owner started it or said "Not now" to its card on Today.
-- Additive only.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "tellCardClosedAt" TIMESTAMP(3);
