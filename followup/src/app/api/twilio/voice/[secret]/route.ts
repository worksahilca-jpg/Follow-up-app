import { NextRequest } from "next/server";
import { requireActiveBilling } from "@/lib/billing";
import { appUrl } from "@/lib/stripe";
import {
  canonicalRequestUrl,
  claimMissedCallTextBack,
  escapeXml,
  findBusinessByTwilioSecret,
  findOrCreateLeadByPhone,
  parseTwilioForm,
  sendSms,
  twiml,
  validateTwilioSignature,
  voiceAgentStreamUrl,
} from "@/lib/twilio";

// A caller who doesn't get through often tries again within minutes —
// this is how long to wait before a repeat call earns a second text-back,
// rather than one per attempt (see claimMissedCallTextBack in
// src/lib/twilio.ts).
const MISSED_CALL_TEXT_COOLDOWN_MINUTES = 30;

// The plain voicemail TwiML — its own function since it now runs from two
// places: a business with the live agent off (the original, only path),
// and a business with the agent on whose live call just ended (the
// `stage=fallback` branch below) — "the call never just drops" applies to
// both an agent that was never turned on and one that failed mid-call.
function voicemailTwiml(secret: string): Response {
  const recordingStatusCallback = `${appUrl()}/api/twilio/voice/transcription/${secret}`;
  return twiml(
    `<Response>` +
      `<Say>Thanks for calling. Please leave a message after the tone, then hang up or press pound.</Say>` +
      `<Record maxLength="120" playBeep="true" finishOnKey="#" recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed"/>` +
      `<Say>We didn't catch a message. Goodbye.</Say>` +
      `</Response>`
  );
}

/**
 * POST /api/twilio/voice/[secret] — configure this as a Twilio phone
 * number's "A Call Comes In" webhook (Twilio Console → Phone Numbers →
 * your number → Voice). Two behaviors depending on Business.voiceAgentEnabled:
 *
 * **Off (default):** a voicemail-style catch — a short greeting, then
 * <Record>. Transcription is deliberately NOT Twilio's own built-in
 * `transcribe="true"` feature — that's English-only per Twilio's docs (a
 * real bug: a non-English caller's voicemail got fed into scoring as
 * garbled nonsense). Instead this uses recordingStatusCallback, and
 * src/app/api/twilio/voice/transcription/[secret]/route.ts fetches the
 * recording and transcribes it itself via OpenAI (auto-detects language,
 * see transcribeAudio in src/lib/integrations/openai.ts).
 *
 * **On:** a live AI conversation — <Connect><Stream> to the separate
 * always-on bridge service (voiceAgentStreamUrl in src/lib/twilio.ts),
 * which talks to OpenAI's Realtime API and hands the finished transcript
 * to src/app/api/twilio/voice-agent-callback/[secret]/route.ts. The
 * `<Say>` immediately before it is the compliance disclosure the research
 * doc (research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md,
 * Part 1) flagged as a real, not-optional requirement — AI disclosure and
 * recording-consent notice, before anything is connected or logged, not
 * an afterthought. `<Connect>`'s `action` URL re-requests this same route
 * with `?stage=fallback` once the Stream ends for ANY reason (normal
 * hangup, the bridge erroring, VOICE_AGENT_WS_URL not configured) — same
 * voicemail fallback as the off case, so a broken live agent degrades to
 * "leave a message," never a dropped call.
 *
 * The lead itself is created HERE, on the call landing, in both cases —
 * so a caller who hangs up before saying anything still shows up as a
 * lead (a missed call is still a real signal). The `stage=fallback`
 * re-entry skips lead-creation and the missed-call text (already done on
 * the original landing) and only serves the voicemail TwiML.
 *
 * Missed-call text-back: fires once per claimMissedCallTextBack()'s
 * cooldown, reusing the SMS-sending path already built for follow-ups.
 * Still fires when the live agent is on — a caller who got a live AI
 * conversation isn't "missed" in the same sense, but this only ever runs
 * once per call regardless of how it's answered, and the text itself
 * ("we couldn't pick up") isn't accurate for an agent-answered call — see
 * the TODO-free choice below: it's suppressed entirely when the agent is
 * enabled, since an agent-handled caller doesn't need a text-back promising
 * a human will follow up on a call that was, in fact, already handled live.
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

  const stage = new URL(request.url).searchParams.get("stage");
  if (stage === "fallback") {
    // The live agent's <Connect><Stream> already ended (hangup, bridge
    // error, or the agent isn't reachable at all) — the lead and any
    // missed-call text were already handled when this call first landed,
    // below. Just the voicemail catch now.
    return voicemailTwiml(secret);
  }

  const from = formParams.From;
  if (from) {
    const lead = await findOrCreateLeadByPhone(business.id, from, "Phone call");
    if (!business.voiceAgentEnabled && (await claimMissedCallTextBack(lead.id, MISSED_CALL_TEXT_COOLDOWN_MINUTES))) {
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

  if (business.voiceAgentEnabled) {
    const streamUrl = voiceAgentStreamUrl(secret);
    if (streamUrl) {
      const actionUrl = `${appUrl()}/api/twilio/voice/${secret}?stage=fallback`;
      return twiml(
        `<Response>` +
          `<Say>You're speaking with an AI assistant for ${escapeXml(business.name)}. This call may be recorded.</Say>` +
          `<Connect action="${escapeXml(actionUrl)}">` +
          `<Stream url="${escapeXml(streamUrl)}">` +
          `<Parameter name="from" value="${escapeXml(from ?? "")}"/>` +
          `<Parameter name="businessName" value="${escapeXml(business.name)}"/>` +
          `</Stream>` +
          `</Connect>` +
          `</Response>`
      );
    }
    // voiceAgentEnabled but VOICE_AGENT_WS_URL isn't configured anywhere
    // (e.g. the bridge service hasn't been deployed yet) — fail safe to
    // voicemail rather than a dead <Connect> that never resolves.
  }

  return voicemailTwiml(secret);
}
