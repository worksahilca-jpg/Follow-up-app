-- The "we got you" message (src/lib/holdingMessage.ts, founder 2026-09-26).
-- Two nullable columns on an existing table: no backfill, no lock beyond
-- the brief ALTER, and nothing reads them until the risk check writes a topic.
ALTER TABLE "Lead" ADD COLUMN "suggestedRiskTopic" TEXT;
ALTER TABLE "Lead" ADD COLUMN "holdingSentFor" TIMESTAMP(3);
