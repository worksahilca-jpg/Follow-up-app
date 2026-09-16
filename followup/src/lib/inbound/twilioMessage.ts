import { prisma } from "@/lib/db";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { recordAudit } from "@/lib/audit";
import { findOrCreateConversation } from "@/lib/conversations";
// Named for its first caller (the Meta webhook) but channel-agnostic: a
// plain create keyed on Message.externalId that reports a unique-constraint
// collision as "already recorded" instead of throwing.
import { createInboundMessageIfNew } from "@/lib/instagram";
import { findOrCreateLeadByPhone } from "@/lib/twilio";
// One matcher for every channel — see src/lib/optOutKeywords.ts for why it
// no longer lives in twilio.ts.
import { isOptInMessage, isOptOutMessage } from "@/lib/optOutKeywords";

/**
 * Everything an inbound Twilio SMS/WhatsApp webhook does AFTER the payload
 * has been safely written to InboundWebhookEvent — lifted out of
 * src/app/api/twilio/{sms,whatsapp}/[secret]/route.ts unchanged so that the
 * exact same code path runs on a first delivery and on a replay
 * (replayInboundWebhookEvent in @/lib/inboundEvents).
 *
 * Takes the parsed Twilio form map rather than the Request, because a
 * replay only has the stored JSON — never the original HTTP request. That
 * is the whole point: the route validates the signature, persists, and then
 * calls this with data that survives the process dying.
 *
 * No billing gate, on purpose — see the routes' own comments. Capture is
 * free; the parts that cost money (acknowledgeNewLead's send,
 * scoreAndDraftForLead's OpenAI calls) pause on their own inside
 * checkAiEligibility (@/lib/billing).
 */
export async function processTwilioInbound(
  businessId: string,
  channel: "text" | "whatsapp",
  formParams: Record<string, string>
): Promise<void> {
  // Twilio's WhatsApp From/To carry a `whatsapp:` scheme prefix
  // (e.g. "whatsapp:+14155551234"). Stripped before touching Lead.phone —
  // a lead's phone number is the same identity whether they text you or
  // WhatsApp you, so this deliberately merges into the same Lead a plain
  // SMS from that number would.
  const from = channel === "whatsapp" ? formParams.From?.replace(/^whatsapp:/, "") : formParams.From;
  const ownWords = (formParams.Body ?? "").trim();
  // Media-only inbound (an MMS photo of the broken thing, a WhatsApp voice
  // note — an extremely ordinary first contact for a trades business)
  // arrives with NumMedia >= 1 and an EMPTY Body. Without the placeholder
  // below the whole `if (body)` block is skipped: the Lead row is created,
  // but no Message is stored, nothing acknowledged, nothing scored — the
  // owner sees a bare phone number with an empty conversation. `ownWords`
  // stays empty so the acknowledgement falls through to its always-safe
  // fixed line rather than generating a reply to text nobody wrote.
  const mediaCount = Number(formParams.NumMedia ?? "0");
  const body = ownWords || (Number.isFinite(mediaCount) && mediaCount > 0
    ? `[Sent ${mediaCount} media attachment${mediaCount === 1 ? "" : "s"} with no message text]`
    : "");
  if (!from) return;

  const lead = await findOrCreateLeadByPhone(businessId, from, channel === "whatsapp" ? "WhatsApp" : "SMS");
  if (!body) return;

  const conversation = await findOrCreateConversation(lead.id, channel);
  // Keyed on Twilio's own MessageSid (Message.externalId is unique) so a
  // redelivery — Twilio's fallback URL pointed at this same route after the
  // primary attempt timed out, a platform-level retry, or a replay of the
  // stored row — appends nothing and re-acknowledges nobody. Returns false
  // only when this exact SID is already recorded.
  const isNew = await createInboundMessageIfNew(conversation.id, body, new Date(), formParams.MessageSid);
  if (!isNew) return;

  // STOP/START are handled before anything else touches this lead: a STOP
  // must never be answered by an automated "we got your message" (see
  // acknowledgeNewLead below) — that would be exactly the kind of unwanted
  // automated text the opt-out exists to stop. See Lead.optedOutAt and
  // sendFollowUpToLead() in src/lib/sending.ts, which every send path —
  // manual, automated, sequence — funnels through and refuses to
  // text/WhatsApp an opted-out lead. Lead.phone is shared between SMS and
  // WhatsApp (see findOrCreateLeadByPhone), so a STOP on either blocks
  // both — one person, one opt-out.
  const optingOut = isOptOutMessage(ownWords);
  const optingIn = isOptInMessage(ownWords);
  if (optingOut || optingIn) {
    await prisma.lead.update({ where: { id: lead.id }, data: { optedOutAt: optingOut ? new Date() : null } });
    void recordAudit({ businessId, userId: null }, optingOut ? "lead.opt_out" : "lead.opt_in", {
      targetType: "lead",
      targetId: lead.id,
      meta: { channel, via: "keyword" },
    });
  }

  if (!optingOut) {
    // Reply within the minute, before the slower scoring — see src/lib/acknowledge.ts.
    // `ownWords`, never the synthesized media placeholder above.
    await acknowledgeNewLead(lead.id, { channel, inboundText: ownWords, inboundAt: new Date() });
  }
  await scoreAndDraftForLead(lead.id);
  await checkRapidEngagement(lead.id);
}
