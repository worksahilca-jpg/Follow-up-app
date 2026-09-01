/**
 * Orchestration: actually sending a follow-up (manual, approved by the
 * user, or automated) and logging it for real — both as a Message in the
 * lead's conversation history, and as a FollowUp record (so "Sent" on the
 * weekly report can be a real count instead of a placeholder).
 */

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/gmail";

export async function sendFollowUpToLead(
  leadId: string,
  body: string,
  options: { automated?: boolean } = {}
): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, message: "Lead not found." };
  if (!lead.email) return { success: false, message: "This lead has no email address on file." };

  const result = await sendEmail({
    to: lead.email,
    subject: "Following up",
    body,
  });
  if (!result.success) {
    return { success: false, message: "Gmail didn't confirm this message sent." };
  }

  let conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id, channel: "email" },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "email" } });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body,
      externalId: result.messageId ?? undefined,
    },
  });

  await prisma.followUp.create({
    data: {
      leadId: lead.id,
      channel: "email",
      message: body,
      status: "sent",
      automated: options.automated ?? false,
      sentAt: new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContacted: new Date() },
  });

  return { success: true };
}
