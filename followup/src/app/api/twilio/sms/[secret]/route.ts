import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { findBusinessByTwilioSecret, findOrCreateLeadByPhone, parseTwilioForm, twiml, validateTwilioRequestSignature } from "@/lib/twilio";

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

  if (business.twilioAuthToken) {
    const signature = request.headers.get("x-twilio-signature");
    if (!validateTwilioRequestSignature(business.twilioAuthToken, request, formParams, signature)) {
      return twiml("<Response/>");
    }
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
    let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "text" } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "text" } });
    }
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "inbound", body, sentAt: new Date() },
    });
    await scoreAndDraftForLead(lead.id);
    await checkRapidEngagement(lead.id);
  }

  return twiml("<Response/>");
}
