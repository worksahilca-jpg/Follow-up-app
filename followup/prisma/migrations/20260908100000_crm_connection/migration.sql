-- CreateTable
CREATE TABLE IF NOT EXISTS "CrmConnection" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "apiKey" TEXT,
  "accountLabel" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConnection_businessId_key" ON "CrmConnection"("businessId");

-- AlterTable (crmProvider/crmId + unique index already applied directly via MCP as "lead_crm_link" —
-- included here so a fresh database created from migrations alone still gets them)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "crmProvider" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "crmId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_businessId_crmProvider_crmId_key" ON "Lead"("businessId", "crmProvider", "crmId");
