-- Pause all sending, and Only admins send (design brain A-041).
ALTER TABLE "Business" ADD COLUMN "sendingPausedAt" TIMESTAMP(3);
ALTER TABLE "Business" ADD COLUMN "onlyAdminsSend" BOOLEAN NOT NULL DEFAULT false;
