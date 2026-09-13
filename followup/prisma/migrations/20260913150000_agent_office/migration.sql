-- The AI office: a roster (AgentRole), a queue (AgentTask), and a record of
-- every shift worked (AgentRun). Internal-only — no businessId anywhere, on
-- purpose; see the comment block in schema.prisma.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentTaskStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentRole" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "brief" TEXT NOT NULL,
  "wakesOn" TEXT NOT NULL,
  "gate" TEXT NOT NULL,
  "live" BOOLEAN NOT NULL DEFAULT false,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "dailyCostCeilingUsd" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgentRole_key_key" ON "AgentRole"("key");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentTask" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '',
  "status" "AgentTaskStatus" NOT NULL DEFAULT 'OPEN',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentTask_roleId_status_idx" ON "AgentTask"("roleId", "status");

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgentRun" (
  "id" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "taskId" TEXT,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "trigger" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "summary" TEXT NOT NULL DEFAULT '',
  "output" TEXT NOT NULL DEFAULT '',
  "error" TEXT,
  "model" TEXT NOT NULL DEFAULT '',
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgentRun_roleId_startedAt_idx" ON "AgentRun"("roleId", "startedAt");
CREATE INDEX IF NOT EXISTS "AgentRun_startedAt_idx" ON "AgentRun"("startedAt");

-- AddForeignKey
ALTER TABLE "AgentTask" DROP CONSTRAINT IF EXISTS "AgentTask_roleId_fkey";
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AgentRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun" DROP CONSTRAINT IF EXISTS "AgentRun_roleId_fkey";
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "AgentRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentRun" DROP CONSTRAINT IF EXISTS "AgentRun_taskId_fkey";
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
