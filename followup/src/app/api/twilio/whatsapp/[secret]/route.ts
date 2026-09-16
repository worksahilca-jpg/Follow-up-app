import { NextRequest } from "next/server";
import { processInboundEvent, recordInboundWebhookEvent } from "@/lib/inboundEvents";
import { findBusinessByTwilioSecret, parseTwilioForm, twiml, validateTwilioRequestSignature } from "@/lib/twilio";

/**
 * POST /api/twilio/whatsapp/[secret] — configure this as the webhook for
 * a Twilio WhatsApp Sender (Twilio Console → Messaging → Senders →
 * WhatsApp senders → your sender → "When a message comes in"). Mirrors
 * src/app/api/twilio/sms/[secret]/route.ts almost exactly — same
 * business lookup, same signature scheme (Twilio signs WhatsApp webhooks
 * identically to SMS) — reusing the one twilioSecret already generated
 * for SMS/voice rather than needing a separate one.
 *
 * The channel difference (the `whatsapp:` scheme prefix on From/To, and
 * tagging the Conversation "whatsapp" so the reply path knows about
 * WhatsApp's 24-hour window) lives in processTwilioInbound
 * (@/lib/inbound/twilioMessage), which both Twilio routes share.
 *
 * PERSIST FIRST, PROCESS AFTER — see the SMS route's doc comment for why.
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
  // Nothing is persisted until this passes.
  if (!business.twilioAuthToken) {
    console.warn(`Twilio inbound for business ${business.id} dropped: no Auth Token saved, signature can't be verified.`);
    return twiml("<Response/>");
  }
  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioRequestSignature(business.twilioAuthToken, request, formParams, signature)) {
    return twiml("<Response/>");
  }

  // No billing gate here — see the matching comment in the SMS webhook
  // (src/app/api/twilio/sms/[secret]/route.ts): refusing an inbound Twilio
  // webhook loses the lead outright rather than deferring it, because
  // nothing retries and the sender is never told. Capture runs; the
  // spending half pauses inside checkAiEligibility (@/lib/billing).
  const event = await recordInboundWebhookEvent({
    provider: "twilio",
    channel: "whatsapp",
    businessId: business.id,
    externalId: formParams.MessageSid ?? null,
    payload: formParams,
  });

  // Never throws — a processing failure is recorded on the row and Twilio
  // still gets its TwiML.
  await processInboundEvent({ ...event, channel: "whatsapp", businessId: business.id, payload: formParams });

  return twiml("<Response/>");
}
