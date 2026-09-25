-- Owner alerts outside the app: an email and a phone notification when a
-- customer wrote and FollowUp's reply is waiting for the owner's OK
-- (src/lib/ownerAlerts.ts). Until now the only alert was the in-app bell,
-- which reaches nobody who is not already looking at FollowUp.
--
-- Purely additive: one defaulted column, two new tables, one new index.
-- Nothing existing is changed or backfilled.

-- "Email me when a customer is waiting". On by default — an alert the
-- owner has to find and switch on first reaches nobody.
ALTER TABLE "User" ADD COLUMN "alertEmailEnabled" BOOLEAN NOT NULL DEFAULT true;

-- One browser/device that asked for notifications, for one person.
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- What each person has already been told about each waiting customer, and
-- the ledger the daily email cap counts. No message text is stored here.
CREATE TABLE "OwnerAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "leadId" TEXT,
    "waitStartedAt" TIMESTAMP(3),
    "kind" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "pushedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

CREATE INDEX "OwnerAlert_userId_createdAt_idx" ON "OwnerAlert"("userId", "createdAt");
CREATE INDEX "OwnerAlert_businessId_idx" ON "OwnerAlert"("businessId");
-- The claim: one alert per (person, lead, wait). Summary rows carry a null
-- leadId, and Postgres treats nulls as distinct, so they never collide.
CREATE UNIQUE INDEX "OwnerAlert_userId_leadId_waitStartedAt_key" ON "OwnerAlert"("userId", "leadId", "waitStartedAt");

-- The alert cron's "which businesses held anything recently?", every minute.
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- Cascade: an erased person leaves no way to reach their old devices, and
-- no record of what they were told.
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OwnerAlert" ADD CONSTRAINT "OwnerAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
