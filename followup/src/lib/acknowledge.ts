import { prisma } from "@/lib/db";
import { generateInstantReply, assessSendRisk, localizeFixedText } from "@/lib/integrations/openai";
import { composeFollowUpEmail, getSenderFirstName } from "@/lib/sender";
import { sendFollowUpToLead } from "@/lib/sending";

/**
 * Instant acknowledgement — the first half of "no lead is lost to LATE
 * follow-up" (PRODUCT_DIRECTION.md, main goal, point 1).
 *
 * A brand-new lead's first message gets a real, specific reply within a
 * minute — answering what it honestly can from what the lead themselves
 * wrote, or saying so warmly by name ("I'll get you the exact price and
 * <owner> will follow up shortly") when it can't — on the channel they
 * used, in the language and tone they wrote in. The substantive reply
 * still goes through the Assisted flow (drafted, approved by the owner)
 * once there's real business context to draw from; this only closes the
 * gap between "they wrote" and "someone/something noticed," which the
 * research puts at 29–47 hours on average and where the close rate
 * falls by more than half.
 *
 * This used to be a fixed template specifically because a generated
 * reply risked inventing a fact with zero human review — now it's a
 * generated reply (generateInstantReply), kept safe two ways instead of
 * by being static: the prompt itself is written to answer only from what
 * the lead already said and never invent a price/availability/timeline,
 * and (for anything but an AUTONOMOUS lead) the draft still passes
 * assessSendRisk — the same gate a normal automated follow-up passes —
 * before being sent. If generation fails, the risk check isn't "low," or
 * there's no OPENAI_API_KEY, this falls back to a fixed, always-safe
 * line (still run through localizeFixedText) rather than holding the
 * very first touch for approval — delaying it defeats the point of
 * "instant," and the fallback line states no fact about the business.
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

// The always-safe fallback: states no fact about the business, so it's
// fine to send with zero review the same way the old fixed template
// was. Kept as a plain function (not a module-level constant) since it
// depends on businessName/owner, which vary per business.
function genericAckLine(businessName: string, ownerFirstName: string): string {
  return `Thanks for reaching out to ${businessName} — I'll take a look and ${ownerFirstName} will follow up shortly.`;
}

/**
 * Builds the one line of substantive content the caller wraps into an
 * email (composeFollowUpEmail adds the greeting/sign-off) or sends
 * as-is with a short "Hi! " prefix for every other channel. See this
 * file's own header comment for the safety reasoning; this function is
 * where that reasoning is actually implemented.
 */
async function buildAckLine(input: {
  leadFirstName: string;
  ownerFirstName: string;
  businessName: string;
  automationTier: string;
  inboundText: string;
  channel: AckChannel;
}): Promise<string> {
  const fallback = await localizeFixedText(genericAckLine(input.businessName, input.ownerFirstName), input.inboundText);
  if (!input.inboundText.trim()) return fallback; // nothing specific to respond to

  try {
    const reply = await generateInstantReply({
      leadFirstName: input.leadFirstName,
      ownerFirstName: input.ownerFirstName,
      inboundText: input.inboundText,
    });
    if (input.automationTier === "AUTONOMOUS") return reply; // same skip every other autonomous send path takes
    const risk = await assessSendRisk(
      { conversation: [{ id: "inbound", direction: "inbound", channel: input.channel, body: input.inboundText, date: new Date().toISOString() }] },
      reply
    );
    return risk.riskLevel === "low" ? reply : fallback;
  } catch (err) {
    console.error("Instant reply generation failed, falling back to the generic acknowledgement:", err);
    return fallback;
  }
}

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
    const leadFirstName = lead.name.split(" ")[0];

    const line = await buildAckLine({
      leadFirstName,
      ownerFirstName: owner,
      businessName,
      automationTier: lead.automationTier,
      inboundText: input.inboundText ?? "",
      channel: input.channel,
    });

    let body: string;
    let subject: string | undefined;
    if (input.channel === "email") {
      body = await composeFollowUpEmail(leadFirstName, lead.businessId, line);
      const cleanSubject = input.emailSubject?.replace(/^(re|fwd?):\s*/i, "").trim();
      subject = cleanSubject ? `Re: ${cleanSubject}` : `Thanks for reaching out to ${businessName}`;
    } else {
      body = `Hi! ${line}`;
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
