-- "Stay in touch" (A-260). Additive only: three empty columns on Lead, two on Business, one new table.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stayInTouchAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stayInTouchMessageId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "stayInTouchNoteAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "stayInTouchDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "stayInTouchAskedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "StayInTouchNews" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StayInTouchNews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StayInTouchNews_businessId_createdAt_idx" ON "StayInTouchNews"("businessId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "StayInTouchNews" ADD CONSTRAINT "StayInTouchNews_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "StayInTouchNews" ENABLE ROW LEVEL SECURITY;
