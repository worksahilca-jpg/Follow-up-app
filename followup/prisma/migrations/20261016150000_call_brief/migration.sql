-- "Before your call" (A-268): the note for a booked call, kept with the booking so Today opens it at once, and how
-- many messages it covered, so it is written again only when the conversation has moved on.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "brief" JSONB;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "briefAt" TIMESTAMP(3);
