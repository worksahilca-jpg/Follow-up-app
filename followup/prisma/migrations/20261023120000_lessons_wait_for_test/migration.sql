-- A-319 (2026-10-23): a lesson the founder teaches waits for a test and their OK before every business of that kind
-- gets it. Additive only: one new column, one new table. Rules and examples already in use stay in use.

-- New wording for a rule in use waits as a rule of its own; this is the rule it takes over from when put to work.
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "replacesId" TEXT;

-- One test of the lessons waiting for a kind of business (src/lib/lessonTest.ts). The test messages are invented.
CREATE TABLE IF NOT EXISTS "LessonTest" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "lessons" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'running',
    "cases" INTEGER NOT NULL DEFAULT 0,
    "tries" INTEGER NOT NULL DEFAULT 0,
    "passedWithout" INTEGER,
    "passedWith" INTEGER,
    "better" INTEGER,
    "worse" INTEGER,
    "results" JSONB,
    "error" TEXT,
    "model" TEXT,
    "byUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LessonTest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LessonTest_trade_createdAt_idx" ON "LessonTest"("trade", "createdAt");

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "LessonTest" ENABLE ROW LEVEL SECURITY;
