import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { transcribeAudio } from "@/lib/integrations/openai";
import {
  canonicalRequestUrl,
  fetchTwilioRecording,
  findBusinessByTwilioSecret,
  parseTwilioForm,
  validateTwilioSignature,
} from "@/lib/twilio";

/**
 * POST /api/twilio/voice/transcription/[secret] — Twilio's
 * recordingStatusCallback from the <Record> verb in
 * src/app/api/twilio/voice/[secret]/route.ts. Deliberately not Twilio's
 * own transcribeCallback (English-only, see the sibling route's comment)
 * — this fetches the actual recording and transcribes it via OpenAI
 * itself, so any language works. The lead already exists by the time
 * this fires (created when the call landed, not here) — this only needs
 * to find it by phone number and log the voicemail text onto it.
 * RecordingStatus can be "failed"/"absent" (bad audio, too short, etc.);
 * that's not an error worth surfacing anywhere Twilio-side, the missed
 * call itself was already captured as the lead.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const business = await findBusinessByTwilioSecret(secret);
  if (!business) return NextResponse.json({ received: true });

  const formParams = await parseTwilioForm(request);

  if (business.twilioAuthToken) {
    const signature = request.headers.get("x-twilio-signature");
    if (!validateTwilioSignature(business.twilioAuthToken, canonicalRequestUrl(request), formParams, signature)) {
      return NextResponse.json({ received: true }, { status: 403 });
    }
  }

  // The call itself was already gated on active billing when the lead was
  // created (src/app/api/twilio/voice/[secret]/route.ts) — but this
  // callback fires later, after Twilio finishes recording, so a
  // subscription that lapses in that gap shouldn't still trigger a real
  // OpenAI call here. Matches every sibling route in this family (SMS,
  // voice-inbound) re-checking billing right before its costly step.
  if (!(await requireActiveBilling(business.id))) return NextResponse.json({ received: true });

  const from = formParams.From;
  const recordingUrl = formParams.RecordingUrl;
  if (!from || !recordingUrl || formParams.RecordingStatus !== "completed") {
    return NextResponse.json({ received: true });
  }

  let text: string;
  try {
    if (!business.twilioAccountSid || !business.twilioAuthToken) {
      throw new Error("Twilio Account SID/Auth Token not configured — can't authenticate the recording fetch.");
    }
    const audio = await fetchTwilioRecording(recordingUrl, business.twilioAccountSid, business.twilioAuthToken);
    text = await transcribeAudio(audio, "voicemail.mp3");
  } catch (err) {
    // Best-effort, same posture as the missed-call text-back — a
    // transcription hiccup must never surface anywhere Twilio-side. The
    // lead is already captured either way; only the voicemail's text
    // content is lost, not the lead itself.
    console.error(`Voicemail transcription failed for business ${business.id}:`, err);
    return NextResponse.json({ received: true });
  }
  if (!text) return NextResponse.json({ received: true });

  const lead = await prisma.lead.findFirst({ where: { businessId: business.id, phone: from } });
  if (!lead) return NextResponse.json({ received: true });

  let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "call" } });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "call" } });
  }
  await prisma.message.create({
    data: { conversationId: conversation.id, direction: "inbound", body: text, sentAt: new Date() },
  });
  await scoreAndDraftForLead(lead.id);

  return NextResponse.json({ received: true });
}
