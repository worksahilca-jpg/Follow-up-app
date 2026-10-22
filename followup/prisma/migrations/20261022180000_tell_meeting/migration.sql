-- "Tell FollowUp" as a 5-minute meeting (A-314): the answers wait here until the owner's one "Looks right".
-- Additive only.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "tellDraft" JSONB;
