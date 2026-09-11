-- "followup" (default): unchanged behavior. "google": booking availability
-- also excludes real busy blocks from the business's connected Google
-- Calendar, not just FollowUp's own Booking rows — see the Business.
-- bookingCalendarSource doc comment in schema.prisma.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "bookingCalendarSource" TEXT NOT NULL DEFAULT 'followup';
