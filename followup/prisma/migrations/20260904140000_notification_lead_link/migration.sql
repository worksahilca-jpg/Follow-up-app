-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "leadId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_leadId_idx" ON "Notification"("leadId");
