-- AlterTable
ALTER TABLE "Integration" ADD COLUMN "accountEmail" TEXT;
ALTER TABLE "Integration" ADD COLUMN "watchExpiration" TIMESTAMP(3);
ALTER TABLE "Integration" ADD COLUMN "watchHistoryId" TEXT;
ALTER TABLE "Integration" ADD COLUMN "pushSyncStartedAt" TIMESTAMP(3);
