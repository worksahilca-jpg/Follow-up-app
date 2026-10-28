-- Change or cancel in the chat (A-242, part 2). Additive, nullable columns on
-- Booking, and the slot guard narrowed to confirmed bookings so a cancelled
-- one frees its slot (a partial unique index; Prisma cannot describe one,
-- so the schema carries a plain index and this file carries the real guard).
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "canceledBy" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cancelSeenAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "Booking_businessId_scheduledAt_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_businessId_scheduledAt_confirmed_key"
  ON "Booking"("businessId", "scheduledAt") WHERE "status" = 'confirmed';
CREATE INDEX IF NOT EXISTS "Booking_businessId_scheduledAt_idx" ON "Booking"("businessId", "scheduledAt");
