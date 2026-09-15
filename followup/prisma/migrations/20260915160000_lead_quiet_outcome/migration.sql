-- What an AI judged happened to a lead's conversation before it went quiet.
-- Kept strictly apart from Lead."stage": stage is the owner's own record and
-- theirs to set; this is an inference from thread text that can be wrong, and
-- writing a guessed WON/LOST into stage would rewrite a real pipeline on the
-- strength of it. Nullable with no default — null means "never judged", which
-- is every existing lead and every lead that isn't a quiet imported one.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QuietOutcome" AS ENUM ('COLD', 'CLOSED', 'OFF_PLATFORM', 'UNCLEAR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "quietOutcome" "QuietOutcome";
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "quietOutcomeReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "quietOutcomeAt" TIMESTAMP(3);

-- Backs the reactivation batch's only query: "this business's leads by
-- verdict". Plain rather than partial (WHERE "quietOutcome" IS NOT NULL)
-- so it matches what schema.prisma can express — Prisma has no partial-index
-- syntax, and an index the schema can't describe shows up as drift on every
-- later migrate.
CREATE INDEX IF NOT EXISTS "Lead_businessId_quietOutcome_idx"
  ON "Lead"("businessId", "quietOutcome");
