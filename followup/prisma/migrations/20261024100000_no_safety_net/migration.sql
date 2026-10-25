-- Plan step 5, the "no" safety net (A-326, 2026-10-24): how a no was read, and when the owner overruled one.
-- Additive only: two nullable columns on an existing table.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "saidNoHow" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "keepFollowingAt" TIMESTAMP(3);
