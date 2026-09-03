import { NextRequest } from "next/server";
import { requireActiveBilling } from "@/lib/billing";
import { appUrl } from "@/lib/stripe";
import { canonicalRequestUrl, findBusinessByTwilioSecret, findOrCreateLeadByPhone, parseTwilioForm, twiml, validateTwilioSignature } from "@/lib/twilio";

/**
 * POST /api/twilio/voice/[secret] — configure this as a Twilio phone
 * number's "A Call Comes In" webhook (Twilio Console → Phone Numbers →
 * your number → Voice). Nobody's actually answering these calls, so the
 * only sane behavior is a voicemail-style catch: a short greeting, then
 * <Record> with Twilio's own transcription (transcribeCallback below) —
 * no separate transcription API/cost, and no audio ever gets stored on
 * FollowUp's side, only the resulting text.
 *
 * The lead itself is created HERE, on the call landing, not after the
 * recording finishes — so a caller who hangs up before leaving a message
 * still shows up as a lead (a missed call is still a real signal), and
 * src/app/api/twilio/voice/transcription/[secret]/route.ts only needs to
 * find that same lead by phone number and log the message onto it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const business = await findBusinessByTwilioSecret(secret);
  if (!business) return twiml("<Response><Reject/></Response>");

  const formParams = await parseTwilioForm(request);

  if (business.twilioAuthToken) {
    const signature = request.headers.get("x-twilio-signature");
    if (!validateTwilioSignature(business.twilioAuthToken, canonicalRequestUrl(request), formParams, signature)) {
      return twiml("<Response><Reject/></Response>");
    }
  }

  if (!(await requireActiveBilling(business.id))) {
    return twiml(
      `<Response><Say>Sorry, this line isn't accepting calls right now.</Say><Reject/></Response>`
    );
  }

  const from = formParams.From;
  if (from) await findOrCreateLeadByPhone(business.id, from, "Phone call");

  const transcribeCallback = `${appUrl()}/api/twilio/voice/transcription/${secret}`;
  return twiml(
    `<Response>` +
      `<Say>Thanks for calling. Please leave a message after the tone, then hang up or press pound.</Say>` +
      `<Record maxLength="120" playBeep="true" finishOnKey="#" transcribe="true" transcribeCallback="${transcribeCallback}"/>` +
      `<Say>We didn't catch a message. Goodbye.</Say>` +
      `</Response>`
  );
}
