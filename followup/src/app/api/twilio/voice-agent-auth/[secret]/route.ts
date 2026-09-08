import { NextRequest, NextResponse } from "next/server";
import { requireActiveBilling } from "@/lib/billing";
import { findBusinessByTwilioSecret, validateVoiceAgentCallbackAuth } from "@/lib/twilio";

/**
 * GET /api/twilio/voice-agent-auth/[secret] — NOT a Twilio webhook. Called
 * only by the separate always-on audio-bridge service (see /voice-agent at
 * the repo root) the instant a WebSocket connection claiming to be a real
 * call arrives, BEFORE it opens the billed OpenAI Realtime leg at all.
 *
 * Closes research/audit/2026-09-08-newer-surface-audit.md finding #1: the
 * bridge has no DB access, and before this endpoint existed its WebSocket
 * handler accepted ANY non-empty ?secret= value and opened a real, billed
 * OpenAI Realtime session for it — no proof the connection came from
 * Twilio, or even that the secret belonged to any real business. That's
 * both an open-ended cost/DoS vector (any junk secret works) and, for a
 * leaked real twilioSecret, a way to inject a fabricated call transcript
 * into that business's actual lead pipeline.
 *
 * Same shared-bearer-secret trust boundary as the existing
 * voice-agent-callback route (VOICE_AGENT_CALLBACK_SECRET, set on both
 * services — "both have to be known to inject a fake transcript" already
 * describes that route; this one closes the matching gap on the way IN).
 * The path secret must also resolve to a real business with the voice
 * agent enabled and active billing — the same two gates the main app's
 * own <Connect><Stream> TwiML route (src/app/api/twilio/voice/[secret]/
 * route.ts) already applies before ever handing the bridge's URL to
 * Twilio in the first place, so this brings the bridge's own entry point
 * up to that same standard instead of trusting it implicitly.
 *
 * Deliberately does NOT validate Twilio's own X-Twilio-Signature on the
 * Media Streams WebSocket upgrade — that would be the fully hardened fix
 * Twilio's docs describe, but the bridge has no way to reconstruct the
 * exact signed URL/host the way this app's own candidateSignedUrls() does
 * for ordinary webhooks (this codebase already hit a real apex/www
 * URL-reconstruction bug on ordinary Twilio signature checks — task #52),
 * and there's no way to test that against a real live call in this
 * environment. Shipping it blind risks silently breaking the voice agent
 * for every real caller instead of just closing an abuse vector. Flagged
 * here rather than guessed at — same posture as the Meta Business Agent
 * webhook risk note in src/app/api/instagram/webhook/route.ts.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  if (!validateVoiceAgentCallbackAuth(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const { secret } = await params;
  const business = await findBusinessByTwilioSecret(secret);
  if (!business || !business.voiceAgentEnabled) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!(await requireActiveBilling(business.id))) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
