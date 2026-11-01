-- Founder, 2026-11-01 (option B): the business's mailing address, shown at the bottom of emails FollowUp sends on its
-- own (src/lib/emailFooter.ts). Additive only: one nullable column, nothing backfilled.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "mailingAddress" TEXT;
