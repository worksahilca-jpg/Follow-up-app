-- Was the AI draft changed before this follow-up went out? Additive and
-- nullable: null means there was no draft to compare against. See
-- FollowUp.draftEdited in schema.prisma.
ALTER TABLE "FollowUp" ADD COLUMN "draftEdited" BOOLEAN;
