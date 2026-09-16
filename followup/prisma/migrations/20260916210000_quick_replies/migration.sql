-- Reply buttons on Instagram and Messenger DMs. Both additive and nullable.
--
-- Message.quickReplyPayload: set on an inbound DM that was a tap on one of
-- FollowUp's own chips (the payload src/lib/quickReplies.ts encoded), so
-- the engine can tell a tapped "Not now" from a typed one. Null on every
-- existing row: nothing has carried chips before this landed.
--
-- Lead.suggestedQuickReplies: the button set drafted beside a DM-shaped
-- suggestedMessage. Null on every existing row, which the automation pass
-- reads as "this draft is email-shaped, rebuild it before sending as a DM".

ALTER TABLE "Message" ADD COLUMN "quickReplyPayload" TEXT;
ALTER TABLE "Lead" ADD COLUMN "suggestedQuickReplies" JSONB;
