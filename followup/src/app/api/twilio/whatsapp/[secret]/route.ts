import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { recordAudit } from "@/lib/audit";
import {
  findBusinessByTwilioSecret,
  findOrCreateLeadByPhone,
  isOptInMessage,
  isOptOutMessage,
  parseTwilioForm,
  twiml,
  validateTwilioRequestSignature,
} from "@/lib/twilio";

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

  // The URL secret identifies the business; the Twilio signature proves
  // the request came from Twilio. Both are required — a business that
  // hasn't saved its Auth Token yet (Settings → Phone) can't be served
  // safely, so its inbound is dropped and logged rather than trusted.
  if (!business.twilioAuthToken) {
    console.warn(`Twilio inbound for business ${business.id} dropped: no Auth Token saved, signature can't be verified.`);
    return twiml("<Response/>");
  }
  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioRequestSignature(business.twilioAuthToken, request, formParams, signature)) {
    return twiml("<Response/>");
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

    // STOP/START handled before anything else touches this lead — see the
    // matching comment in the SMS webhook (src/app/api/twilio/sms/[secret]/
    // route.ts) for why. Lead.phone is shared between SMS and WhatsApp
    // (see findOrCreateLeadByPhone), so a STOP here also blocks SMS sends
    // to the same lead, and vice versa — one person, one opt-out.
    const optingOut = isOptOutMessage(body);
    const optingIn = isOptInMessage(body);
    if (optingOut || optingIn) {
      await prisma.lead.update({ where: { id: lead.id }, data: { optedOutAt: optingOut ? new Date() : null } });
      void recordAudit({ businessId: business.id, userId: null }, optingOut ? "lead.opt_out" : "lead.opt_in", {
        targetType: "lead",
        targetId: lead.id,
        meta: { channel: "whatsapp", via: "keyword" },
      });
    }

    if (!optingOut) {
      // Reply within the minute, before the slower scoring — see src/lib/acknowledge.ts.
      await acknowledgeNewLead(lead.id, { channel: "whatsapp", inboundText: body, inboundAt: new Date() });
    }
    await scoreAndDraftForLead(lead.id);
    await checkRapidEngagement(lead.id);
  }

  return twiml("<Response/>");
}
