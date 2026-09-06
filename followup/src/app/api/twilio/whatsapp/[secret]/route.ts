import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { findBusinessByTwilioSecret, findOrCreateLeadByPhone, parseTwilioForm, twiml, validateTwilioRequestSignature } from "@/lib/twilio";

/**
 * POST /api/twilio/whatsapp/[secret] — configure this as the webhook for
 * a Twilio WhatsApp Sender (Twilio Console → Messaging → Senders →
 * WhatsApp senders → your sender → "When a message comes in"). Mirrors
 * src/app/api/twilio/sms/[secret]/route.ts almost exactly — same
 * business lookup, same signature scheme (Twilio signs WhatsApp webhooks
 * identically to SMS) — reusing the one twilioSecret already generated
 * for SMS/voice rather than needing a separate one.
 *
 * The one real difference: Twilio's WhatsApp `From`/`To` values carry a
 * `whatsapp:` scheme prefix (e.g. "whatsapp:+14155551234"). That prefix
 * is stripped before touching Lead.phone — a lead's phone number is the
 * same identity whether they text you or WhatsApp you, so this
 * deliberately merges into the same Lead a plain SMS from that number
 * would, rather than creating a second, duplicate lead. The
 * Conversation's channel is still tagged "whatsapp" (not "text") so the
 * reply path (src/lib/sending.ts) knows to answer back the same way they
 * reached out — WhatsApp has its own 24-hour free-form-message window
 * (see sendWhatsApp() in src/lib/twilio.ts), unlike SMS.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const business = await findBusinessByTwilioSecret(secret);
  if (!business) return twiml("<Response/>");

  const formParams = await parseTwilioForm(request);

  if (business.twilioAuthToken) {
    const signature = request.headers.get("x-twilio-signature");
    if (!validateTwilioRequestSignature(business.twilioAuthToken, request, formParams, signature)) {
      return twiml("<Response/>");
    }
  }

  if (!(await requireActiveBilling(business.id))) return twiml("<Response/>");

  const from = formParams.From?.replace(/^whatsapp:/, "");
  const body = (formParams.Body ?? "").trim();
  if (!from) return twiml("<Response/>");

  const lead = await findOrCreateLeadByPhone(business.id, from, "WhatsApp");

  if (body) {
    let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "whatsapp" } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "whatsapp" } });
    }
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "inbound", body, sentAt: new Date() },
    });
    await scoreAndDraftForLead(lead.id);
    await checkRapidEngagement(lead.id);
  }

  return twiml("<Response/>");
}
