-- Shared claimable lead pool ("Ponds" — see
-- research/market/2026-09-05-competitor-feature-gaps.md #1.1). A source
-- rule can now route new leads to an unclaimed pool instead of the usual
-- least-loaded auto-assignment; see src/lib/sourceRouting.ts.

-- AlterTable
ALTER TABLE "SourceRule" ADD COLUMN "routeToPool" BOOLEAN NOT NULL DEFAULT false;
