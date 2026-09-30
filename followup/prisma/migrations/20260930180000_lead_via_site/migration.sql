-- The lead site that passed a customer on, when it keeps their contact
-- private (backlog b018, design brain A-075): "Reply on Thumbtack" instead of
-- an email that has nowhere to go. Two nullable columns: no backfill, no
-- rewrite of existing rows.

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "viaSite" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "viaSiteUrl" TEXT;
