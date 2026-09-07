-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "meta" JSONB,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditEvent_businessId_createdAt_idx" ON "AuditEvent"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_targetId_idx" ON "AuditEvent"("targetId");
ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
