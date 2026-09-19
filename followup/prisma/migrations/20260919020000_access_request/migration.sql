-- The beta tester list: one row per email the founder added. Additive.
CREATE TABLE "AccessRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "business" TEXT,
    "channels" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccessRequest_email_key" ON "AccessRequest"("email");
CREATE INDEX "AccessRequest_status_createdAt_idx" ON "AccessRequest"("status", "createdAt");
