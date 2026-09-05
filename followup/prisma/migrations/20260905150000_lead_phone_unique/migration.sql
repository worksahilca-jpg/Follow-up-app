-- Closes the concurrent-inbound-message race that could create two Lead
-- rows for one phone number/Instagram sender (findOrCreateLeadByPhone() /
-- findOrCreateLeadByInstagram() in src/lib/twilio.ts / src/lib/instagram.ts).
-- Postgres allows multiple NULLs in a unique index, so leads with no phone
-- (manual entry, CSV import, website-form-by-email-only) are unaffected.

-- CreateIndex
CREATE UNIQUE INDEX "Lead_businessId_phone_key" ON "Lead"("businessId", "phone");
