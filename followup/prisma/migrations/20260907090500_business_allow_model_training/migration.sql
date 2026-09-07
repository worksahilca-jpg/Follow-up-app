-- AlterTable
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "allowModelTraining" BOOLEAN NOT NULL DEFAULT false;
