-- Authenticated-action rate limiting (Gmail sync, spam scan, AI draft
-- regeneration) — see tooManyRecentActions() in src/lib/rateLimit.ts.
-- OpenAI/Gmail API cost for these comes out of one shared platform key,
-- not billed per-business, so this exists to stop a single compromised or
-- careless signed-in account from running up a real bill.

-- CreateTable
CREATE TABLE "RateLimitHit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateLimitHit_businessId_action_createdAt_idx" ON "RateLimitHit"("businessId", "action", "createdAt");

-- AddForeignKey
ALTER TABLE "RateLimitHit" ADD CONSTRAINT "RateLimitHit_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
