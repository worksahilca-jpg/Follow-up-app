-- Plan step 4, "Check the checker" (A-321, 2026-10-23): the founder marks test replies on Admin → Train, and a check
-- that disagrees with them too often becomes advice only. Additive only: one new column, two new tables. The messages
-- in these tables are invented; no business's customer is in them.

-- The checks that were advice only in a lesson test.
ALTER TABLE "LessonTest" ADD COLUMN IF NOT EXISTS "advisory" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- One round of "Mark replies" (src/lib/checkerRounds.ts).
CREATE TABLE IF NOT EXISTS "CheckerRound" (
    "id" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'writing',
    "model" TEXT,
    "byUserId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CheckerRound_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CheckerRound_trade_createdAt_idx" ON "CheckerRound"("trade", "createdAt");

-- One reply in a round, what the checker found and what the founder said.
CREATE TABLE IF NOT EXISTS "CheckerReply" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "caseName" TEXT NOT NULL,
    "said" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "checker" TEXT[],
    "hard" TEXT[],
    "verdict" TEXT,
    "marked" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "markedAt" TIMESTAMP(3),

    CONSTRAINT "CheckerReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CheckerReply_roundId_position_idx" ON "CheckerReply"("roundId", "position");

DO $$ BEGIN
  ALTER TABLE "CheckerReply" ADD CONSTRAINT "CheckerReply_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CheckerRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Founder-only tables, read through the app's own database user; nobody reaches them through the Supabase API.
ALTER TABLE "CheckerRound" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CheckerReply" ENABLE ROW LEVEL SECURITY;
