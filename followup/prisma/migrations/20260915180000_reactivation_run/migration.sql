-- One press of "Send all" on the reactivation batch, plus the per-lead claim
-- that guarantees nobody is messaged twice.
--
-- The run is a ROW rather than in-memory state for one reason: STOP has to
-- work. The owner presses Stop in one serverless invocation while the sending
-- loop runs in another — no shared memory, no shared process. The loop
-- re-reads this row's status before every send, and Stop is a one-field
-- UPDATE. Without a row there is nothing for the loop to read, and Stop can
-- only hide its own button while the remaining messages go out anyway.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ReactivationRunStatus" AS ENUM ('RUNNING', 'STOPPED', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ReactivationRun" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "status" "ReactivationRunStatus" NOT NULL DEFAULT 'RUNNING',
  "totalPlanned" INTEGER NOT NULL,
  "sent" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "skipped" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "stoppedById" TEXT,
  CONSTRAINT "ReactivationRun_pkey" PRIMARY KEY ("id")
);

-- The "is a batch already running for this business" guard, and the run
-- history a business's own screen lists.
CREATE INDEX IF NOT EXISTS "ReactivationRun_businessId_status_idx" ON "ReactivationRun"("businessId", "status");
CREATE INDEX IF NOT EXISTS "ReactivationRun_businessId_startedAt_idx" ON "ReactivationRun"("businessId", "startedAt");

-- AddForeignKey
ALTER TABLE "ReactivationRun" DROP CONSTRAINT IF EXISTS "ReactivationRun_businessId_fkey";
ALTER TABLE "ReactivationRun" ADD CONSTRAINT "ReactivationRun_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SET NULL, not CASCADE: deleting the teammate who pressed Stop must not
-- delete the record that the batch was stopped.
ALTER TABLE "ReactivationRun" DROP CONSTRAINT IF EXISTS "ReactivationRun_stoppedById_fkey";
ALTER TABLE "ReactivationRun" ADD CONSTRAINT "ReactivationRun_stoppedById_fkey"
  FOREIGN KEY ("stoppedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable — the real "never message the same person twice" guarantee.
-- Claimed atomically before each send and never cleared, so it holds across
-- separate runs, a stopped run that is restarted, a double-tapped button, and
-- two overlapping invocations.
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "reactivationSentAt" TIMESTAMP(3);
