-- When "send on my behalf" was granted (holdAllForApproval turned off),
-- so that granting it means "from now on" rather than releasing every
-- draft that piled up while it was on. Null while the hold is on, which
-- is every row today.
ALTER TABLE "Business" ADD COLUMN "autoSendAllowedAt" TIMESTAMP(3);
