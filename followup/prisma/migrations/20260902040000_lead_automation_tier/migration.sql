-- Replaces the per-lead automationOn boolean with a three-way trust tier
-- (OFF / ASSISTED / AUTONOMOUS). The old boolean always meant "risk-gated
-- auto-send" — that's exactly today's ASSISTED — so existing true/false
-- values are backfilled rather than dropped.

-- CreateEnum
CREATE TYPE "AutomationTier" AS ENUM ('OFF', 'ASSISTED', 'AUTONOMOUS');

-- AlterTable: add the new column first, defaulting everyone to OFF
ALTER TABLE "Lead" ADD COLUMN "automationTier" "AutomationTier" NOT NULL DEFAULT 'OFF';

-- Backfill: anyone who had automationOn = true keeps equivalent behavior
UPDATE "Lead" SET "automationTier" = 'ASSISTED' WHERE "automationOn" = true;

-- Drop the old column now that its data has been carried forward
ALTER TABLE "Lead" DROP COLUMN "automationOn";
