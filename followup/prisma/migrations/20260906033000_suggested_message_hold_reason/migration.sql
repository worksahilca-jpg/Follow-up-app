-- Surfaces *why* a suggestedMessage is waiting on manual approval instead of
-- just that it is (assessSendRisk()'s reason, src/lib/integrations/openai.ts,
-- set in the ASSISTED hold branch of src/lib/automation.ts). One additive,
-- nullable column; nothing existing changes shape.

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "suggestedMessageHoldReason" TEXT;
