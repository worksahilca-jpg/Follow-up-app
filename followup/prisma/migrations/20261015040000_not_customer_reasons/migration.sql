-- "Not a customer" asks who it was (A-259): the owner's answer on each remembered sender, and the kinds of sender
-- they asked FollowUp to set aside from now on. Additive only; every existing row reads as "no reason given".
ALTER TABLE "SenderVerdict" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "notCustomerAlways" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "notCustomerAsked" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
