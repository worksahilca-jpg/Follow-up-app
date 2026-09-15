-- Stamps the cached AI draft with the newest message it was written
-- against, so a lead held for approval stops paying for an identical
-- redraft every 20 hours. Additive and nullable: existing rows get NULL,
-- which the application treats as "provenance unknown, redraft once",
-- so the first pass after deploy rebuilds each draft and stamps it.
ALTER TABLE "Lead" ADD COLUMN "suggestedDraftedFor" TIMESTAMP(3);
