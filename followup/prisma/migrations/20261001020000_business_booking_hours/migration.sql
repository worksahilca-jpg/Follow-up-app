-- When a customer can book a call (A-078, founder 2026-10-01): per business
-- instead of a fixed Mon–Fri 9–5. Existing accounts move to the new default,
-- Mon–Sat 9am–7pm, which is the founder's call for everyone.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "bookingDays" INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[];
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "bookingStartMinute" INTEGER NOT NULL DEFAULT 540;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "bookingEndMinute" INTEGER NOT NULL DEFAULT 1140;
