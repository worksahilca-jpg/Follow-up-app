-- A2P 10DLC registration (Trust Hub Secondary Customer Profile -> Brand ->
-- Campaign), one row per business. See A2pRegistration in schema.prisma and
-- src/lib/integrations/twilioA2p.ts.
CREATE TABLE IF NOT EXISTS "A2pRegistration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "tier" TEXT NOT NULL DEFAULT 'starter',
    "customerProfileSid" TEXT,
    "customerProfileStatus" TEXT,
    "brandSid" TEXT,
    "brandStatus" TEXT,
    "messagingServiceSid" TEXT,
    "campaignSid" TEXT,
    "campaignStatus" TEXT,
    "rejectionReason" TEXT,
    "legalBusinessName" TEXT,
    "ein" TEXT,
    "businessType" TEXT,
    "businessIndustry" TEXT,
    "websiteUrl" TEXT,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressRegion" TEXT,
    "addressPostalCode" TEXT,
    "addressCountry" TEXT NOT NULL DEFAULT 'US',
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "authorizedRepName" TEXT,
    "authorizedRepEmail" TEXT,
    "authorizedRepPhone" TEXT,
    "authorizedRepJobTitle" TEXT,
    "useCase" TEXT NOT NULL DEFAULT 'STARTER',
    "campaignDescription" TEXT,
    "optInDescription" TEXT,
    "sampleMessage1" TEXT,
    "sampleMessage2" TEXT,
    "monthlyVolumeEstimate" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "A2pRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "A2pRegistration_businessId_key" ON "A2pRegistration"("businessId");

ALTER TABLE "A2pRegistration" DROP CONSTRAINT IF EXISTS "A2pRegistration_businessId_fkey";
ALTER TABLE "A2pRegistration" ADD CONSTRAINT "A2pRegistration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
