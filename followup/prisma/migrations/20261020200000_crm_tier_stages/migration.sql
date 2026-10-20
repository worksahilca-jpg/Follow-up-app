-- GoHighLevel kept in step (A-303): stages for Ready / Warm / Later, and reading the owner's notes. Additive only.
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "tierStages" JSONB;
ALTER TABLE "CrmConnection" ADD COLUMN IF NOT EXISTS "readNotes" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "crmTierMoved" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "crmNotesCheckedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "crmNotesSeenAt" TIMESTAMP(3);
