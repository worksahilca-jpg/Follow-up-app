-- FollowUp reads the owner's website (A-328, 2026-10-26): the link they gave, and when they answered the ask.
-- Additive only: two nullable columns on an existing table.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "websiteAskedAt" TIMESTAMP(3);
