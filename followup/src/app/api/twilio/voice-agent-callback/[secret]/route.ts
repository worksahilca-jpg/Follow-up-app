import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { findBusinessByTwilioSecret, findOrCreateLeadByPhone, validateVoiceAgentCallbackAuth } from "@/lib/twilio";

type VoiceAgentTurn = { role: "caller" | "agent"; text: string };

function isVoiceAgentTurn(value: unknown): value is VoiceAgentTurn {
  return (
    !!value &&
    typeof value === "object" &&
    ((value as VoiceAgentTurn).role === "caller" || (value as VoiceAgentTurn).role === "agent") &&
    typeof (value as VoiceAgentTurn).text === "string" &&
    (value as VoiceAgentTurn).text.trim().length > 0
  );
}

/**
 * POST /api/twilio/voice-agent-callback/[secret] — NOT a Twilio webhook.
 * Called by the separate always-on audio-bridge service (see /voice-agent
 * at the repo root) once a live AI-answered call ends, handing over the
 * full transcript so it becomes a real, permanent Conversation/Message
 * history here — same "own the data" posture (PRODUCT_DIRECTION.md rule
 * 2) as every other channel, rather than the conversation living only on
 * the bridge service or OpenAI's own side.
 *
 * Twilio's own request-signature scheme (validateTwilioSignature) doesn't
 * apply here — this request never touches Twilio — so auth is a shared
 * bearer secret (VOICE_AGENT_CALLBACK_SECRET, set on both services) on
 * top of the per-business twilioSecret already in the path: both have to
 * be known to inject a fake transcript.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;

  if (!validateVoiceAgentCallbackAuth(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const business = await findBusinessByTwilioSecret(secret);
  if (!business || !business.voiceAgentEnabled) {
    return NextResponse.json({ success: false, message: "Voice agent not enabled for this business." }, { status: 404 });
  }

  // The call already happened by the time this fires — a subscription
  // that lapsed mid-call shouldn't still trigger a real OpenAI scoring
  // call here, same posture as every other Twilio callback in this family.
  if (!(await requireActiveBilling(business.id))) return NextResponse.json({ success: true });

  const body = await request.json().catch(() => ({}));
  const from = typeof body.from === "string" ? body.from.trim() : "";
  const turns: VoiceAgentTurn[] = Array.isArray(body.turns) ? body.turns.filter(isVoiceAgentTurn) : [];
  if (!from || turns.length === 0) return NextResponse.json({ success: true });

  const lead = await findOrCreateLeadByPhone(business.id, from, "Phone call");

  let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "voice-agent" } });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "voice-agent" } });
  }

  // sentAt is spaced out (not all `new Date()`) so the turns keep their
  // real speaking order — scoring/drafting reads a conversation's
  // messages ordered by sentAt, and the whole transcript otherwise lands
  // here in one batch at call-end with near-identical timestamps.
  const conversationId = conversation.id;
  await prisma.message.createMany({
    data: turns.map((t, i) => ({
      conversationId,
      direction: t.role === "caller" ? "inbound" : "outbound",
      body: t.text.trim(),
      sentAt: new Date(Date.now() + i),
    })),
  });

  // Only re-score/draft off a transcript that actually contains something
  // the caller said — an agent-only transcript (e.g. the caller hung up
  // right after the greeting) isn't new signal about the lead.
  if (turns.some((t) => t.role === "caller")) {
    await scoreAndDraftForLead(lead.id);
    await checkRapidEngagement(lead.id);
  }

  return NextResponse.json({ success: true });
}
