-- "Missed by your CRM" (A-315): who FollowUp added to the owner's CRM, and whether new ones go in by themselves.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "crmAddedAt" TIMESTAMP(3);
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "autoAddSince" TIMESTAMP(3);
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "autoAddOff" BOOLEAN NOT NULL DEFAULT false;
