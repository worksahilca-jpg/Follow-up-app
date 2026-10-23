-- Plan step 3 (research/product/2026-10-23-self-improving-loop.md): a chance check, messages written for each rule,
-- and code checks that block.
ALTER TABLE "LessonTest" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'lessons';
ALTER TABLE "LessonTest" ADD COLUMN IF NOT EXISTS "blocked" INTEGER;
ALTER TABLE "LessonTest" ADD COLUMN IF NOT EXISTS "targeted" INTEGER;
ALTER TABLE "TrainingRule" ADD COLUMN IF NOT EXISTS "testMessages" JSONB;
