import { NextRequest } from "next/server";
import { processInboundEvent, recordInboundWebhookEvent } from "@/lib/inboundEvents";
import { findBusinessByTwilioSecret, parseTwilioForm, twiml, validateTwilioRequestSignature } from "@/lib/twilio";

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
 *
 * PERSIST FIRST, PROCESS AFTER. This route's only job is to verify the
 * request and get the payload onto disk; everything the message implies
 * happens in processTwilioInbound (@/lib/inbound/twilioMessage), driven
 * from the stored row. That ordering is the whole point: Twilio does not
 * redeliver a webhook it already answered 200 to, so before this row
 * existed, anything that threw partway through the work — an OpenAI
 * timeout, a cold start, a bug — destroyed the message with nothing left
 * anywhere to recover it from. Now a failure is a `failed`
 * InboundWebhookEvent row holding the original payload, replayable by
 * replayInboundWebhookEvent().
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
  // Nothing is persisted until this passes: an unverified payload must
  // never be stored as though it were a real message.
  if (!business.twilioAuthToken) {
    console.warn(`Twilio inbound for business ${business.id} dropped: no Auth Token saved, signature can't be verified.`);
    return twiml("<Response/>");
  }
  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioRequestSignature(business.twilioAuthToken, request, formParams, signature)) {
    return twiml("<Response/>");
  }

  // No billing gate here, on purpose. Twilio does not retry a webhook that
  // answered with 200 + TwiML, and the person who texted sees nothing at
  // all — so refusing here didn't pause anything, it deleted the lead
  // permanently, and fixing the card afterwards could never bring it back.
  // Capture is free; the parts that cost money (the instant
  // acknowledgement's send and scoreAndDraftForLead's OpenAI calls) pause
  // on their own through checkAiEligibility — see its comment in @/lib/billing.
  const event = await recordInboundWebhookEvent({
    provider: "twilio",
    channel: "sms",
    businessId: business.id,
    externalId: formParams.MessageSid ?? null,
    payload: formParams,
  });

  // Never throws — a processing failure is written onto the row above, and
  // Twilio still gets its TwiML. Answering anything else would make Twilio
  // fall back / alert on a message that is already safely on disk.
  await processInboundEvent({ ...event, channel: "sms", businessId: business.id, payload: formParams });

  return twiml("<Response/>");
}
