import { NextRequest } from "next/server";
import { requireActiveBilling } from "@/lib/billing";
import { appUrl } from "@/lib/stripe";
import { canonicalRequestUrl, findBusinessByTwilioSecret, findOrCreateLeadByPhone, parseTwilioForm, sendSms, twiml, validateTwilioSignature } from "@/lib/twilio";

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
 *
 * Missed-call text-back: every call that reaches this webhook is, by
 * definition, one nobody picked up (see above) — so unlike a real front
 * desk, "missed call" here isn't a special case to detect, it's just what
 * always happens. Fires an immediate SMS on the same number this call
 * came in on, reusing the SMS-sending path already built for follow-ups —
 * no new integration, just a second use of one already wired up. Fires
 * unconditionally (not only when no voicemail follows): the point is
 * closing the gap between "nobody answered" and "they heard from us,"
 * which is true whether or not they also leave a message.
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
  if (from) {
    await findOrCreateLeadByPhone(business.id, from, "Phone call");
    try {
      await sendSms(
        business.id,
        from,
        `Hi, thanks for calling ${business.name} — we couldn't pick up, but we saw your call and will follow up shortly. Feel free to reply here anytime.`
      );
    } catch (err) {
      // Best-effort — a Twilio API hiccup on the text-back must never
      // break the call itself; the voicemail/transcription path below
      // still runs regardless.
      console.error(`Missed-call text-back failed for business ${business.id}:`, err);
    }
  }

  const transcribeCallback = `${appUrl()}/api/twilio/voice/transcription/${secret}`;
  return twiml(
    `<Response>` +
      `<Say>Thanks for calling. Please leave a message after the tone, then hang up or press pound.</Say>` +
      `<Record maxLength="120" playBeep="true" finishOnKey="#" transcribe="true" transcribeCallback="${transcribeCallback}"/>` +
      `<Say>We didn't catch a message. Goodbye.</Say>` +
      `</Response>`
  );
}
