-- Follow-up plans (A-245): Fast, Long or the owner's own; a plan picked for
-- one customer; and a day the customer asked to hear back. Additive only:
-- every existing row reads as "the plans as drawn" and "FollowUp picks".
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "followUpPlans" JSONB;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "followUpPlan" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "followUpNotBefore" TIMESTAMP(3);
