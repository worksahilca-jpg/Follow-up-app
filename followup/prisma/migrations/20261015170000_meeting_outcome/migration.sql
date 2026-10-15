-- "How did it go?" (A-263): the owner's one-tap answer after a booked call.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "outcome" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "outcomeAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "outcomeFromStage" TEXT;
