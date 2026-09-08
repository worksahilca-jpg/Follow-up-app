import { prisma } from "@/lib/db";
import { localizeFixedText } from "@/lib/integrations/openai";
import { composeFollowUpEmail, getSenderFirstName } from "@/lib/sender";
import { sendFollowUpToLead } from "@/lib/sending";

/**
 * Instant acknowledgement — the first half of "no lead is lost to LATE
 * follow-up" (PRODUCT_DIRECTION.md, main goal, point 1).
 *
 * A brand-new lead's first message gets a short "we got your message,
 * <owner> will get back to you shortly" within a minute, on the channel
 * they used, in the language they wrote in. The substantive reply still
 * goes through the Assisted flow (drafted, approved by the owner); this
 * only closes the gap between "they wrote" and "someone noticed," which
 * the research puts at 29–47 hours on average and where the close rate
 * falls by more than half.
 *
 * It is safe to send with no human review because it is a TEMPLATE, not
 * a generated reply: it states no fact about the business, quotes no
 * price, answers no question. The only AI step is translating the fixed
 * sentence (localizeFixedText), which is forbidden from adding anything.
 *
 * Guarantees, each enforced below and each a reason this returns without
 * sending:
 *  - once per lead, ever (atomic claim on Lead.acknowledgedAt);
 *  - never if the owner has already replied (any outbound message, or
 *    the email thread already contains their reply);
 *  - never for a message older than STALE_AFTER_MS — a deep inbox pass
 *    finds months-old threads and must not "acknowledge" them;
 *  - never for a lead the owner set to OFF;
 *  - never when the business switch (Settings → Automation) is off;
 *  - only on a channel the lead wrote to us on (a web form is
 *    acknowledged by email only — we don't text a number nobody texted from).
 */
export const INSTANT_ACK_ACTION = "instant_ack";
export const INSTANT_ACK_NAME = "Instant reply to new leads";

const STALE_AFTER_MS = 60 * 60_000;

export type AckChannel = "email" | "text" | "whatsapp" | "instagram" | "messenger";

export async function isInstantAckEnabled(businessId: string): Promise<boolean> {
  const row = await prisma.automation.findFirst({
    where: { businessId, action: INSTANT_ACK_ACTION },
    select: { enabled: true },
  });
  // On by default: absence of a row means "never turned off."
  return row?.enabled ?? true;
}

export async function acknowledgeNewLead(
  leadId: string,
  input: {
    channel: AckChannel;
    inboundText?: string;
    inboundAt?: Date;
    hasHumanReply?: boolean;
    emailThreadId?: string;
    emailMessageId?: string;
    emailSubject?: string;
  }
): Promise<{ sent: boolean; reason?: string }> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, businessId: true, name: true, email: true, phone: true, automationTier: true, acknowledgedAt: true },
    });
    if (!lead) return { sent: false, reason: "no lead" };
    if (lead.acknowledgedAt) return { sent: false, reason: "already acknowledged" };
    if (lead.automationTier === "OFF") return { sent: false, reason: "lead is OFF" };
    if (input.channel === "email" && !lead.email) return { sent: false, reason: "no email" };
    if (input.channel !== "email" && !lead.phone) return { sent: false, reason: "no phone" };

    const inboundAt = input.inboundAt ?? new Date();
    if (Date.now() - inboundAt.getTime() > STALE_AFTER_MS) return { sent: false, reason: "inbound too old" };

    if (input.hasHumanReply) return { sent: false, reason: "owner already replied" };
    const priorOutbound = await prisma.message.findFirst({
      where: { conversation: { leadId }, direction: "outbound" },
      select: { id: true },
    });
    if (priorOutbound) return { sent: false, reason: "owner already replied" };

    if (!(await isInstantAckEnabled(lead.businessId))) return { sent: false, reason: "switched off" };

    // Claim first, send second — two webhooks for the same new lead
    // (a double-tap text, an email + a form) can't both win.
    const claim = await prisma.lead.updateMany({
      where: { id: leadId, acknowledgedAt: null },
      data: { acknowledgedAt: new Date() },
    });
    if (claim.count === 0) return { sent: false, reason: "already acknowledged" };

    const business = await prisma.business.findUnique({ where: { id: lead.businessId }, select: { name: true } });
    const businessName = business?.name ?? "us";
    const owner = await getSenderFirstName(lead.businessId);

    let body: string;
    let subject: string | undefined;
    if (input.channel === "email") {
      const line = await localizeFixedText(
        `Thanks for reaching out to ${businessName}. I got your message and will get back to you shortly.`,
        input.inboundText ?? ""
      );
      body = await composeFollowUpEmail(lead.name.split(" ")[0], lead.businessId, line);
      const cleanSubject = input.emailSubject?.replace(/^(re|fwd?):\s*/i, "").trim();
      subject = cleanSubject ? `Re: ${cleanSubject}` : `Thanks for reaching out to ${businessName}`;
    } else {
      body = await localizeFixedText(
        `Hi! Thanks for reaching out to ${businessName}. We got your message and ${owner} will get back to you shortly.`,
        input.inboundText ?? ""
      );
    }

    const result = await sendFollowUpToLead(leadId, body, {
      automated: true,
      trigger: "instant_ack",
      channel: input.channel,
      subject,
      emailThreadId: input.emailThreadId,
      emailInReplyTo: input.emailMessageId,
    });
    if (!result.success) {
      // Release the claim so a later inbound on a working channel can
      // still be acknowledged — e.g. Twilio not configured yet.
      await prisma.lead.updateMany({ where: { id: leadId }, data: { acknowledgedAt: null } });
      console.error(`Instant acknowledgement failed for lead ${leadId}: ${result.message}`);
      return { sent: false, reason: result.message };
    }
    return { sent: true };
  } catch (err) {
    // Never let the acknowledgement break the webhook that captured the lead.
    console.error(`Instant acknowledgement errored for lead ${leadId}:`, err);
    return { sent: false, reason: "error" };
  }
}
