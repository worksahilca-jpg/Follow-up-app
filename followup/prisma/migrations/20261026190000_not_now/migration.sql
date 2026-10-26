-- "Not now" (A-329, 2026-10-26): the owner's choice for a customer who says not now, and when a customer started the
-- ask-and-check-back-once path. Additive only: two nullable columns on existing tables.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "notNowPlan" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "notNowAt" TIMESTAMP(3);
