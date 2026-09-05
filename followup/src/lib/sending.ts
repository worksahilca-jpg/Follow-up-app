/**
 * Orchestration: actually sending a follow-up (manual, approved by the
 * user, or automated) and logging it for real — both as a Message in the
 * lead's conversation history, and as a FollowUp record (so "Sent" on the
 * weekly report can be a real count instead of a placeholder).
 *
 * Three real channels now: email (Gmail), SMS (Twilio) when the lead
 * only has a phone, Instagram DM when the lead's "phone" is actually an
 * Instagram-scoped sender ID (see src/lib/instagram.ts) — same
 * approval-first flow either way, just a different wire underneath.
 */

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/integrations/gmail";
import { sendSms } from "@/lib/twilio";
import { sendInstagramMessage } from "@/lib/instagram";
import { instagramRecipientId, isInstagramLeadId } from "@/lib/instagramId";

export async function sendFollowUpToLead(
  leadId: string,
  body: string,
  options: { automated?: boolean } = {}
): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, message: "Lead not found." };

  const channel = lead.email ? "email" : isInstagramLeadId(lead.phone) ? "instagram" : lead.phone ? "text" : null;
  if (!channel) return { success: false, message: "This lead has no email or phone number on file." };

  let externalId: string | undefined;
  if (channel === "email") {
    const result = await sendEmail(lead.businessId, {
      to: lead.email!,
      subject: `Following up, ${lead.name.split(" ")[0]}`,
      body,
    });
    if (!result.success) return { success: false, message: "Gmail didn't confirm this message sent." };
    externalId = result.messageId ?? undefined;
  } else if (channel === "instagram") {
    const result = await sendInstagramMessage(lead.businessId, instagramRecipientId(lead.phone!), body);
    if (!result.success) return { success: false, message: result.message ?? "Instagram didn't confirm this message sent." };
  } else {
    const result = await sendSms(lead.businessId, lead.phone!, body);
    if (!result.success) return { success: false, message: result.message ?? "Twilio didn't confirm this message sent." };
    externalId = result.sid;
  }

  let conversation = await prisma.conversation.findFirst({
    where: { leadId: lead.id, channel },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel } });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      body,
      externalId,
    },
  });

  await prisma.followUp.create({
    data: {
      leadId: lead.id,
      channel,
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
