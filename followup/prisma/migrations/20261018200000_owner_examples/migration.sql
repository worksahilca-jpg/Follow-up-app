-- "Write it better" (A-290): replies the owner wrote in "Try it yourself" to show how FollowUp should answer. Additive only: one new table.
CREATE TABLE IF NOT EXISTS "OwnerExample" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "customerSaid" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OwnerExample_businessId_createdAt_idx" ON "OwnerExample"("businessId", "createdAt");

DO $$ BEGIN
    ALTER TABLE "OwnerExample" ADD CONSTRAINT "OwnerExample_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "OwnerExample" ENABLE ROW LEVEL SECURITY;
