-- "FollowUp learns what you do" (founder 2026-10-06): habits the owner said
-- yes to, and a marker for messages that only say thanks. Additive only.
CREATE TABLE IF NOT EXISTS "OwnerHabit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidence" INTEGER NOT NULL DEFAULT 0,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerHabit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OwnerHabit_businessId_kind_key" ON "OwnerHabit"("businessId", "kind");

-- Locked to the app's own server connection like every other table.
ALTER TABLE "OwnerHabit" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  ALTER TABLE "OwnerHabit" ADD CONSTRAINT "OwnerHabit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "thanksOnlyAt" TIMESTAMP(3);
