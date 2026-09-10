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
 * follow up shortly") when it can't — on the channel they
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
 * line rather than holding the very first touch for approval — delaying
 * it defeats the point of "instant," and the fallback line states no
 * fact about the business.
 *
 * Language (task #63 live-test finding): the outgoing message is
 * localized as a whole, greeting/sign-off included — not just the
 * middle line. The first real Spanish test lead got "Hi Lucía, <English
 * fallback> Best, Sahil": the fallback was localized on its own while
 * composeFollowUpEmail wrapped it in a fixed English frame, and the
 * SMS/DM path glued an English "Hi! " onto whatever came back. Now the
 * email frame follows the lead's language (see src/lib/sender.ts) and
 * the non-email "Hi! <line>" is localized as one string, so a fallback
 * and a generated reply both go out entirely in the lead's language.
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
function genericAckLine(businessName: string): string {
  // First person throughout: the email is signed by the owner
  // (composeFollowUpEmail's sign-off), so "I" is them. The previous
  // wording — "I'll take a look and <owner> will follow up shortly. Best,
  // <owner>" — mixed first and third person for the same signer and read
  // as filler; task #63's first two live leads both received it.
  return `Thank you for contacting ${businessName}. I've received your message and will get back to you shortly.`;
}

/**
 * What buildAckLine decided and why — `source` says whether the line is
 * the model's specific reply or the always-safe generic one, `reason` is
 * a short human-readable why (risk level + the risk check's own reason,
 * "generation failed", …). Recorded to the AI audit trail on every send
 * so a fallback that looks wrong on a real lead — task #63's live test
 * shipped two generic English acknowledgements to Spanish leads with no
 * record of which step had bailed — can be diagnosed from the lead page
 * instead of from production logs nobody can reach.
 */
type AckLine = { line: string; source: "generated" | "fallback"; reason: string };

/**
 * Builds the one line of substantive content the caller wraps into an
 * email (composeFollowUpEmail adds the greeting/sign-off) or sends
 * with a short "Hi! " prefix for every other channel — either way
 * localized to the lead's language by the caller, not here. See this
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
}): Promise<AckLine> {
  const fallback = genericAckLine(input.businessName);
  if (!input.inboundText.trim()) return { line: fallback, source: "fallback", reason: "no inbound text" }; // nothing specific to respond to

  try {
    const reply = await generateInstantReply({
      leadFirstName: input.leadFirstName,
      ownerFirstName: input.ownerFirstName,
      inboundText: input.inboundText,
    });
    if (input.automationTier === "AUTONOMOUS") return { line: reply, source: "generated", reason: "autonomous, risk check skipped" }; // same skip every other autonomous send path takes
    const risk = await assessSendRisk(
      { conversation: [{ id: "inbound", direction: "inbound", channel: input.channel, body: input.inboundText, date: new Date().toISOString() }] },
      reply
    );
    if (risk.riskLevel === "low") return { line: reply, source: "generated", reason: "risk low" };
    return { line: fallback, source: "fallback", reason: `risk ${risk.riskLevel}: ${risk.reason}`.slice(0, 160) };
  } catch (err) {
    console.error("Instant reply generation failed, falling back to the generic acknowledgement:", err);
    return { line: fallback, source: "fallback", reason: "generation failed" };
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

    const decision = await buildAckLine({
      leadFirstName,
      ownerFirstName: owner,
      businessName,
      automationTier: lead.automationTier,
      inboundText: input.inboundText ?? "",
      channel: input.channel,
    });

    // The lead's own message decides the language of everything that
    // goes out: a generated reply is already in their language, but the
    // generic fallback line is English and has to be translated (email
    // path: here, since composeFollowUpEmail localizes only its frame;
    // other channels: below, as one string with the "Hi! " prefix). The
    // email greeting/sign-off frame and the default subject follow too.
    // localizeFixedText returns its input untouched for an English lead
    // (or with nothing to sample), so the common case reads as before.
    const languageSample = input.inboundText ?? "";
    let body: string;
    let subject: string | undefined;
    if (input.channel === "email") {
      const line = decision.source === "fallback" ? await localizeFixedText(decision.line, languageSample) : decision.line;
      body = await composeFollowUpEmail(leadFirstName, lead.businessId, line, { languageSample });
      const cleanSubject = input.emailSubject?.replace(/^(re|fwd?):\s*/i, "").trim();
      subject = cleanSubject ? `Re: ${cleanSubject}` : await localizeFixedText(`Thank you for contacting ${businessName}`, languageSample);
    } else {
      body = await localizeFixedText(`Hi! ${decision.line}`, languageSample);
    }

    const result = await sendFollowUpToLead(leadId, body, {
      automated: true,
      trigger: "instant_ack",
      channel: input.channel,
      subject,
      emailThreadId: input.emailThreadId,
      emailInReplyTo: input.emailMessageId,
      // Merged into sendFollowUpToLead's own "ai.send" audit event rather
      // than logged separately — task #63's live test showed two rows
      // for one send: the generic "ai.send" the UI knows how to render,
      // and a second, undetailed "ai.instant_ack" line the UI didn't
      // recognize (see LeadTrustPanel.tsx's ACTION_COPY). One event now
      // carries both the generic detail and the ack-specific decision.
      extraAuditMeta: { source: decision.source, reason: decision.reason, localized: languageSample.trim().length > 0 },
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
