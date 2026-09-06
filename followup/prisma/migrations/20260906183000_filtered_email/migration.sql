-- CreateTable
CREATE TABLE "FilteredEmail" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderEmail" TEXT NOT NULL,
  "subject" TEXT,
  "reason" TEXT NOT NULL,
  "lastMessageAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FilteredEmail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FilteredEmail_businessId_threadId_key" ON "FilteredEmail"("businessId", "threadId");
CREATE INDEX "FilteredEmail_businessId_createdAt_idx" ON "FilteredEmail"("businessId", "createdAt");
ALTER TABLE "FilteredEmail" ADD CONSTRAINT "FilteredEmail_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
