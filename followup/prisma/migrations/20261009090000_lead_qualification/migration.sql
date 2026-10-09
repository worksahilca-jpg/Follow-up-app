-- The qualification checklist on a lead (src/lib/qualification.ts): what
-- FollowUp has learned about what the customer wants, with their own words
-- as proof, and when they first became ready. Additive only.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "qualification" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "qualifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Lead_qualifiedAt_idx" ON "Lead"("qualifiedAt");
