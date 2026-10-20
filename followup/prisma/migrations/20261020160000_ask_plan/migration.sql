-- "What FollowUp asks" (A-302): the owner's own questions for a new buyer, in their order. Additive only: one empty column.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "askPlan" JSONB;
