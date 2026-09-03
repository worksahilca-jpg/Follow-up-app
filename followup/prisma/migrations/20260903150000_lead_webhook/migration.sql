-- Generic inbound webhook for lead capture — a per-business secret that
-- lets an external form/automation tool (Zapier, Make, a Google Forms
-- bridge, a raw script) POST a new lead in without a login, the same way
-- the embed widget does for a business's own website. Nullable + unique:
-- generated lazily on first use in Settings, not eagerly for every
-- business.

-- AlterTable
ALTER TABLE "Business" ADD COLUMN "webhookSecret" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Business_webhookSecret_key" ON "Business"("webhookSecret");
