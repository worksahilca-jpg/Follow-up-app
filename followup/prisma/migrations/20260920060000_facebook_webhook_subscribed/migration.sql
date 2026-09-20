-- When Meta last confirmed this app is subscribed to a connected Facebook
-- Page's "messages" and "leadgen" webhooks.
--
-- Additive and nullable. Every existing row keeps NULL, which is the
-- honest answer: until this column existed, neither connect path called
-- POST /{page-id}/subscribed_apps at all, so no connected Page has ever
-- been confirmed subscribed. A business that reconnects — or presses the
-- retry this column makes possible — fills it in.
ALTER TABLE "Business" ADD COLUMN "facebookWebhookSubscribedAt" TIMESTAMP(3);
