-- Night plan A1 + A4 (2026-10-31): every accuracy test run is kept, so a result survives a refresh, is compared with
-- the last one, and its failures can be run again alone. Additive only: one new table. The cases are invented.
CREATE TABLE IF NOT EXISTS "TestRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "test" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'full',
    "recheckOf" TEXT,
    "version" TEXT,
    "cases" INTEGER NOT NULL,
    "passed" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "ran" TEXT[],
    "failed" TEXT[],
    "calls" INTEGER,
    "costMicros" INTEGER,
    "result" JSONB,

    CONSTRAINT "TestRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TestRun_test_createdAt_idx" ON "TestRun"("test", "createdAt");

-- Closed to Supabase's Data API like every other table (docs/least-privilege-db-role.md): no policies, so no access.
ALTER TABLE "TestRun" ENABLE ROW LEVEL SECURITY;
