-- The first day of A-096 learned from every sent reply, FollowUp's own
-- unreviewed sends included, and kept vague phrases: "weekday or weekend"
-- (an old invented question), "in Etobicoke" (a stranger's claim the draft
-- repeated), "our services". From this release FollowUp learns only from
-- replies a person sent, and only specific facts. Everything learned before
-- that is removed; what an owner typed in Settings is kept.
DELETE FROM "BusinessFact" WHERE "source" = 'reply';
