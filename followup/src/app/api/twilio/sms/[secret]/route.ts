import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { recordAudit } from "@/lib/audit";
import { findOrCreateConversation } from "@/lib/conversations";
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
 * POST /api/twilio/sms/[secret] — configure this as a Twilio phone
 * number's "A Message Comes In" webhook (Twilio Console → Phone Numbers →
 * your number → Messaging). Every inbound text becomes a real lead —
 * found or created by phone number, scored and drafted the same as an
 * email — with zero auto-reply sent back (see the empty <Response/>
 * below); FollowUp's own approval-first send flow handles any reply.
 *
 * Twilio never sees or cares about the response body beyond valid TwiML,
 * so every path here returns 200 + TwiML even on a config/billing
 * problem — there's no human on the other end of an SMS webhook to show
 * an error message to, unlike the embed widget or generic lead webhook.
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
  // No twilioAuthToken saved yet — signature check is skipped rather than
  // hard-blocked, so the number works the moment it's configured in
  // Twilio and the auth token can be added moments later without an
  // outage in between. Settings nudges toward adding it.

  if (!(await requireActiveBilling(business.id))) return twiml("<Response/>");

  const from = formParams.From;
  const body = (formParams.Body ?? "").trim();
  if (!from) return twiml("<Response/>");

  const lead = await findOrCreateLeadByPhone(business.id, from, "SMS");

  if (body) {
    const conversation = await findOrCreateConversation(lead.id, "text");
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "inbound", body, sentAt: new Date() },
    });

    // STOP/START are handled before anything else touches this lead: a
    // STOP must never be answered by an automated "we got your message"
    // (see acknowledgeNewLead below) — that would be exactly the kind of
    // unwanted automated text the opt-out exists to stop. See
    // Lead.optedOutAt and sendFollowUpToLead() in src/lib/sending.ts,
    // which every send path — manual, automated, sequence — funnels
    // through and refuses to text/WhatsApp an opted-out lead.
    const optingOut = isOptOutMessage(body);
    const optingIn = isOptInMessage(body);
    if (optingOut || optingIn) {
      await prisma.lead.update({ where: { id: lead.id }, data: { optedOutAt: optingOut ? new Date() : null } });
      void recordAudit({ businessId: business.id, userId: null }, optingOut ? "lead.opt_out" : "lead.opt_in", {
        targetType: "lead",
        targetId: lead.id,
        meta: { channel: "text", via: "keyword" },
      });
    }

    if (!optingOut) {
      // Reply within the minute, before the slower scoring — see src/lib/acknowledge.ts.
      await acknowledgeNewLead(lead.id, { channel: "text", inboundText: body, inboundAt: new Date() });
    }
    await scoreAndDraftForLead(lead.id);
    await checkRapidEngagement(lead.id);
  }

  return twiml("<Response/>");
}
