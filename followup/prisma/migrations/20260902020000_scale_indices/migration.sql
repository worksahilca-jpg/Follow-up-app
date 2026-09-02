-- Scale hardening: every model that gets looked up by a foreign key (leadId,
-- conversationId, userId, businessId) had no index on that column — only
-- the FK constraint itself, which Postgres does not implicitly index on the
-- referencing side. Fine at demo scale; a full table scan on every business
-- with more than a handful of leads once real tenants show up. Pure
-- additive DDL — no data changes, safe to run at any time.

-- CreateIndex
CREATE INDEX "User_businessId_idx" ON "User"("businessId");

-- CreateIndex
CREATE INDEX "Lead_businessId_stage_idx" ON "Lead"("businessId", "stage");

-- CreateIndex
CREATE INDEX "Lead_businessId_score_idx" ON "Lead"("businessId", "score");

-- CreateIndex
CREATE INDEX "Lead_businessId_source_idx" ON "Lead"("businessId", "source");

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Deal_leadId_idx" ON "Deal"("leadId");

-- CreateIndex
CREATE INDEX "FollowUp_leadId_idx" ON "FollowUp"("leadId");

-- CreateIndex
CREATE INDEX "FollowUp_status_sentAt_idx" ON "FollowUp"("status", "sentAt");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Automation_businessId_idx" ON "Automation"("businessId");

-- CreateIndex
CREATE INDEX "AIInsight_leadId_idx" ON "AIInsight"("leadId");
