import { NextRequest } from "next/server";
import { requireActiveBilling } from "@/lib/billing";
import { appUrl } from "@/lib/stripe";
import {
  canonicalRequestUrl,
  claimMissedCallTextBack,
  findBusinessByTwilioSecret,
  findOrCreateLeadByPhone,
  parseTwilioForm,
  sendSms,
  twiml,
  validateTwilioSignature,
} from "@/lib/twilio";

// A caller who doesn't get through often tries again within minutes —
// this is how long to wait before a repeat call earns a second text-back,
// rather than one per attempt (see claimMissedCallTextBack in
// src/lib/twilio.ts).
const MISSED_CALL_TEXT_COOLDOWN_MINUTES = 30;

/**
 * POST /api/twilio/voice/[secret] — configure this as a Twilio phone
 * number's "A Call Comes In" webhook (Twilio Console → Phone Numbers →
 * your number → Voice). Nobody's actually answering these calls, so the
 * only sane behavior is a voicemail-style catch: a short greeting, then
 * <Record>. Transcription is deliberately NOT Twilio's own built-in
 * `transcribe="true"` feature — that's English-only per Twilio's docs (a
 * real bug: a non-English caller's voicemail got fed into scoring as
 * garbled nonsense). Instead this uses recordingStatusCallback, and
 * src/app/api/twilio/voice/transcription/[secret]/route.ts fetches the
 * recording and transcribes it itself via OpenAI (auto-detects language,
 * see transcribeAudio in src/lib/integrations/openai.ts). The audio is
 * only ever held in memory long enough to transcribe it — never written
 * to disk or stored on FollowUp's side, only the resulting text is.
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
 * always happens. Fires an SMS on the same number this call came in on,
 * reusing the SMS-sending path already built for follow-ups — no new
 * integration, just a second use of one already wired up. Fires
 * regardless of whether a voicemail follows: the point is closing the gap
 * between "nobody answered" and "they heard from us," true either way —
 * but capped to one per claimMissedCallTextBack()'s cooldown window per
 * lead, not literally every single call: a caller retrying a dropped or
 * unanswered call a few minutes later is normal, not a second "missed
 * call" worth a second text.
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
    const lead = await findOrCreateLeadByPhone(business.id, from, "Phone call");
    if (await claimMissedCallTextBack(lead.id, MISSED_CALL_TEXT_COOLDOWN_MINUTES)) {
      try {
        const result = await sendSms(
          business.id,
          from,
          `Hi, thanks for calling ${business.name} — we couldn't pick up, but we saw your call and will follow up shortly. Feel free to reply here anytime.`
        );
        // sendSms() resolves (doesn't throw) on a Twilio-side rejection —
        // e.g. an unverified trial number or an SMS-incapable sub-account —
        // so that has to be checked explicitly, not just caught, or a
        // silently-broken text-back would never show up anywhere.
        if (!result.success) {
          console.error(`Missed-call text-back failed for business ${business.id}: ${result.message}`);
        }
      } catch (err) {
        // Best-effort — a Twilio API hiccup on the text-back must never
        // break the call itself; the voicemail/transcription path below
        // still runs regardless.
        console.error(`Missed-call text-back failed for business ${business.id}:`, err);
      }
    }
  }

  const recordingStatusCallback = `${appUrl()}/api/twilio/voice/transcription/${secret}`;
  return twiml(
    `<Response>` +
      `<Say>Thanks for calling. Please leave a message after the tone, then hang up or press pound.</Say>` +
      `<Record maxLength="120" playBeep="true" finishOnKey="#" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed"/>` +
      `<Say>We didn't catch a message. Goodbye.</Say>` +
      `</Response>`
  );
}
