/**
 * Destructive lead-management helpers shared by the single-lead delete
 * route and the bulk cleanup route — kept in one place so the cascade
 * (everything that has a leadId FK) can't drift out of sync between them.
 */

import { prisma } from "@/lib/db";

/** Deletes one lead and every row that hangs off it, in a single transaction. */
export async function deleteLeadCascade(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { conversations: true } });
  if (!lead) return;

  const conversationIds = lead.conversations.map((c) => c.id);

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }),
    prisma.conversation.deleteMany({ where: { leadId } }),
    prisma.deal.deleteMany({ where: { leadId } }),
    prisma.followUp.deleteMany({ where: { leadId } }),
    prisma.task.deleteMany({ where: { leadId } }),
    prisma.aIInsight.deleteMany({ where: { leadId } }),
    prisma.lead.delete({ where: { id: leadId } }),
  ]);
}
