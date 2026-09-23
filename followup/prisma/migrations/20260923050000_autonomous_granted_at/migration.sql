-- When unreviewed sending was permitted, so that granting it means "from
-- now on" rather than "and also everything that piled up while it was
-- off". Null whenever the permission is off, which is every row today.
ALTER TABLE "Business" ADD COLUMN "autonomousAllowedAt" TIMESTAMP(3);
