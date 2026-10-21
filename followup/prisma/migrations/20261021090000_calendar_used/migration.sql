-- Which calendar the owner books in (A-305). Additive only.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "calendarUsed" TEXT;
