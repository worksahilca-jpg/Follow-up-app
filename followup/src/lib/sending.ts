/**
 * Orchestration: actually sending a follow-up (manual, approved by the
 * user, or automated) and logging it for real — both as a Message in the
 * lead's conversation history, and as a FollowUp record (so "Sent" on the
 * weekly report can be a real count instead of a placeholder).
 *
 * Real channels now: email (Gmail or Outlook — see detectEmailProvider
 * below), SMS (Twilio) or WhatsApp (Twilio's WhatsApp API) when the lead
 * only has a phone, Instagram DM or Facebook Messenger when the lead's
 * "phone" is actually a platform-scoped sender ID (see
 * src/lib/instagramId.ts) — same approval-first flow either way, just a
 * different wire underneath.
 */

import { prisma } from "@/lib/db";
import { getGmailStatus, sendEmail } from "@/lib/integrations/gmail";
import { getOutlookStatus, sendOutlookEmail } from "@/lib/integrations/outlook";
import { sendSms, sendWhatsApp } from "@/lib/twilio";
import { recordAudit } from "@/lib/audit";
import { sendInstagramMessage } from "@/lib/instagram";
import { instagramRecipientId, isInstagramLeadId, isMessengerLeadId, messengerRecipientId } from "@/lib/instagramId";
import { sendMessengerMessage } from "@/lib/facebook";
import { CRM_PROVIDERS, isCrmProvider } from "@/lib/crm";

/**
 * SMS and WhatsApp both live on Lead.phone (the same phone number
 * identifies the same person on either channel — see
 * findOrCreateLeadByPhone in src/lib/twilio.ts) — so which one to reply
 * on isn't stored on the lead itself, it's inferred from whichever
 * channel they most recently actually messaged through, same as a human
 * replying in whatever thread they were just in.
 */
async function detectPhoneChannel(leadId: string): Promise<"whatsapp" | "text"> {
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { channel: true } } },
  });
  return lastInbound?.conversation.channel === "whatsapp" ? "whatsapp" : "text";
}

/**
 * Same idea as detectPhoneChannel() above, for email once a business can
 * have both Gmail and Outlook connected: a reply has to go out from
 * whichever mailbox actually holds the lead's thread, not always Gmail.
 *  - A lead with an existing "email" Conversation uses whatever provider
 *    was stamped on it (see Conversation.emailProvider) — null there
 *    means a row from before this field existed, always Gmail.
 *  - A lead with no email history yet (manually entered, or captured on
 *    another channel first) falls back to whichever mailbox is actually
 *    connected, preferring Gmail since that's the long-standing default
 *    when a business has both.
 */
async function detectEmailProvider(businessId: string, leadId: string): Promise<"gmail" | "outlook"> {
  const lastEmailConversation = await prisma.conversation.findFirst({
    where: { leadId, channel: "email" },
    orderBy: { createdAt: "desc" },
    select: { emailProvider: true },
  });
  if (lastEmailConversation?.emailProvider === "outlook") return "outlook";
  if (lastEmailConversation) return "gmail";

  const [gmailStatus, outlookStatus] = await Promise.all([getGmailStatus(businessId), getOutlookStatus(businessId)]);
  if (gmailStatus.connected) return "gmail";
  if (outlookStatus.connected) return "outlook";
  // Neither connected — sendEmail() will fail with a clear "not
  // connected" message, same behavior as before Outlook existed.
  return "gmail";
}

/**
 * Which channel an AUTOMATED send (automation.ts, sequences.ts) should
 * use — always pass this explicitly rather than relying on
 * sendFollowUpToLead()'s own default below, which the manual-send
 * composer UI (MessageComposer.tsx's `isEmail = Boolean(leadEmail)`) is
 * built around and this deliberately leaves untouched.
 *
 * The bug this fixes: that default always picks "email" whenever the
 * lead has one on file, regardless of what channel the lead is actually
 * engaging on — so a lead who only ever texts or DMs, but also has an
 * email address (common: a web form asks for both, or a rep adds one
 * later), got automated replies sent to an inbox they never check. This
 * mirrors detectPhoneChannel()'s own reasoning above ("which one to
 * reply on isn't stored on the lead, it's inferred from whichever channel
 * they most recently actually messaged through") but widens it to
 * arbitrate against email too, instead of only between text/WhatsApp.
 *
 * "web" and "call" aren't send-capable channels themselves (no reply
 * API), and a lead with no inbound history yet has nothing to infer from
 * — both fall through to the same static preference order
 * sendFollowUpToLead()'s own default uses.
 */
export async function detectAutomatedReplyChannel(lead: {
  id: string;
  email: string | null;
  phone: string | null;
}): Promise<"email" | "text" | "whatsapp" | "instagram" | "messenger" | null> {
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId: lead.id }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { channel: true } } },
  });
  const lastChannel = lastInbound?.conversation.channel;
  if (lastChannel === "email" && lead.email) return "email";
  if (lastChannel === "text" && lead.phone) return "text";
  if (lastChannel === "whatsapp" && lead.phone) return "whatsapp";
  if (lastChannel === "instagram" && isInstagramLeadId(lead.phone)) return "instagram";
  if (lastChannel === "messenger" && isMessengerLeadId(lead.phone)) return "messenger";

  if (lead.email) return "email";
  if (isInstagramLeadId(lead.phone)) return "instagram";
  if (isMessengerLeadId(lead.phone)) return "messenger";
  if (lead.phone) return detectPhoneChannel(lead.id);
  return null;
}

/**
 * research/product/2026-09-09-followup-cadence-best-practices.md §4: the
 * channel a caller escalates to when it has deliberately decided NOT to
 * use email for this particular send — a workflow (sequences.ts) EMAIL
 * step for a lead with no email address at all, or one whose earlier
 * EMAIL steps in the same sequence already went out with no reply.
 *
 * Deliberately a separate function rather than a flag on
 * detectAutomatedReplyChannel() above: that function always prefers
 * email whenever the lead has one (both via its own lastChannel check
 * and its static fallback order), which is exactly the behavior a caller
 * invoking this one is trying to get away from. Mirrors its phone/DM
 * branches exactly — same priority (whichever channel the lead's last
 * inbound message actually came in on, then Instagram/Messenger/phone
 * based on what Lead.phone actually holds) — so the two channel-picking
 * functions never quietly disagree about what "text" or "whatsapp" means
 * for a given lead; this one just never returns "email".
 */
export async function detectNonEmailChannel(lead: {
  id: string;
  phone: string | null;
}): Promise<"text" | "whatsapp" | "instagram" | "messenger" | null> {
  if (!lead.phone) return null;
  const lastInbound = await prisma.message.findFirst({
    where: { conversation: { leadId: lead.id }, direction: "inbound" },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { channel: true } } },
  });
  const lastChannel = lastInbound?.conversation.channel;
  if (lastChannel === "text") return "text";
  if (lastChannel === "whatsapp") return "whatsapp";
  if (lastChannel === "instagram" && isInstagramLeadId(lead.phone)) return "instagram";
  if (lastChannel === "messenger" && isMessengerLeadId(lead.phone)) return "messenger";

  if (isInstagramLeadId(lead.phone)) return "instagram";
  if (isMessengerLeadId(lead.phone)) return "messenger";
  return detectPhoneChannel(lead.id);
}

export async function sendFollowUpToLead(
  leadId: string,
  body: string,
  options: {
    automated?: boolean;
    // Force a channel instead of the email-first default — the instant
    // acknowledgement (src/lib/acknowledge.ts) replies on the channel the
    // lead actually used.
    channel?: "email" | "text" | "whatsapp" | "instagram" | "messenger";
    subject?: string;
    emailThreadId?: string;
    emailInReplyTo?: string;
    // Attribution for the rescued-leads report (see FollowUp.trigger).
    trigger?: "instant_ack" | "unanswered" | "silence" | "sequence" | "manual" | "dead_lead_reactivation";
  } = {}
): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, message: "Lead not found." };

  const channel =
    options.channel ??
    (lead.email
      ? "email"
      : isInstagramLeadId(lead.phone)
        ? "instagram"
        : isMessengerLeadId(lead.phone)
          ? "messenger"
          : lead.phone
          ? await detectPhoneChannel(lead.id)
          : null);
  if (!channel) return { success: false, message: "This lead has no email or phone number on file." };

  // TCPA/CTIA opt-out — see Lead.optedOutAt and isOptOutMessage() in
  // src/lib/twilio.ts. A hard stop, not a risk signal: applies to every
  // caller (manual send, automation.ts, sequences.ts, acknowledge.ts —
  // this is the one funnel all of them send through) and is never
  // overridable from here. Scoped to text/whatsapp only — STOP is the
  // SMS-specific legal mechanism, not a "never contact this lead again."
  if ((channel === "text" || channel === "whatsapp") && lead.optedOutAt) {
    return { success: false, message: "This lead texted STOP — SMS/WhatsApp sending is blocked until they text START to opt back in." };
  }

  let externalId: string | undefined;
  let emailProvider: "gmail" | "outlook" | undefined;
  if (channel === "email") {
    if (!lead.email) return { success: false, message: "This lead has no email address on file." };
    emailProvider = await detectEmailProvider(lead.businessId, lead.id);
    if (emailProvider === "outlook") {
      const result = await sendOutlookEmail(lead.businessId, {
        to: lead.email,
        subject: options.subject ?? `Following up on your inquiry, ${lead.name.split(" ")[0]}`,
        body,
        // Graph's /reply endpoint takes the specific message's own id,
        // not an RFC822 Message-ID header — acknowledgeNewLead's Outlook
        // path passes that Graph id through as emailInReplyTo (same
        // field Gmail's flow uses for its own, differently-shaped id).
        replyToMessageId: options.emailInReplyTo,
      });
      if (!result.success) return { success: false, message: "Outlook didn't confirm this message sent." };
    } else {
      const result = await sendEmail(lead.businessId, {
        to: lead.email,
        subject: options.subject ?? `Following up on your inquiry, ${lead.name.split(" ")[0]}`,
        body,
        threadId: options.emailThreadId,
        inReplyTo: options.emailInReplyTo,
      });
      if (!result.success) return { success: false, message: "Gmail didn't confirm this message sent." };
      externalId = result.messageId ?? undefined;
    }
  } else if (channel === "instagram") {
    const result = await sendInstagramMessage(lead.businessId, instagramRecipientId(lead.phone!), body);
    if (!result.success) return { success: false, message: result.message ?? "Instagram didn't confirm this message sent." };
  } else if (channel === "messenger") {
    const result = await sendMessengerMessage(lead.businessId, messengerRecipientId(lead.phone!), body);
    if (!result.success) return { success: false, message: result.message ?? "Facebook didn't confirm this message sent." };
  } else if (channel === "whatsapp") {
    const result = await sendWhatsApp(lead.businessId, lead.phone!, body);
    if (!result.success) return { success: false, message: result.message ?? "WhatsApp didn't confirm this message sent." };
    externalId = result.sid;
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
    conversation = await prisma.conversation.create({
      data: { leadId: lead.id, channel, ...(emailProvider ? { emailProvider } : {}) },
    });
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
      trigger: options.trigger ?? (options.automated ? "silence" : "manual"),
      sentAt: new Date(),
    },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { lastContacted: new Date() },
  });

  // Push a note to the CRM this lead came from — best-effort, never lets
  // a CRM hiccup fail a send that already succeeded. See src/lib/crmSync.ts.
  if (lead.crmProvider && lead.crmId && isCrmProvider(lead.crmProvider)) {
    void pushCrmNote(lead.businessId, lead.crmProvider, lead.crmId, body);
  }

  // AI audit trail (task #67): every message this app sent with nobody
  // clicking "Send" — auto-send on silence, the human-neglect rescue, a
  // sequence step, the instant acknowledgement — lands in the same
  // append-only AuditEvent trail admin-side actions already use, instead
  // of only existing as a FollowUp row nobody but the weekly report
  // reads. A manual send is already covered by its own route-level
  // recordAudit("lead.send", ...) call, so this only fires for automated
  // ones to avoid double-logging the same send.
  if (options.automated) {
    void recordAudit({ businessId: lead.businessId, userId: null }, "ai.send", {
      targetType: "lead",
      targetId: lead.id,
      meta: { channel, trigger: options.trigger ?? "silence", length: body.length },
    });
  }

  return { success: true };
}

async function pushCrmNote(businessId: string, provider: string, crmId: string, body: string): Promise<void> {
  try {
    const conn = await prisma.crmConnection.findUnique({ where: { businessId } });
    if (!conn?.apiKey || conn.provider !== provider) return;
    const result = await CRM_PROVIDERS[provider as keyof typeof CRM_PROVIDERS].client.pushNote(
      conn.apiKey,
      crmId,
      `FollowUp sent:\n\n${body}`
    );
    if (!result.ok) console.error(`CRM note push failed for business ${businessId}: ${result.message}`);
  } catch (err) {
    console.error(`CRM note push errored for business ${businessId}:`, err);
  }
}
