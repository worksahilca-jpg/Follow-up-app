import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { findBusinessByTwilioSecret, parseTwilioForm, validateTwilioRequestSignature } from "@/lib/twilio";

/**
 * POST /api/twilio/status/[secret] — Twilio's StatusCallback for an
 * outbound SMS/WhatsApp send (see statusCallbackUrl() in src/lib/twilio.ts,
 * attached to every sendSms()/sendWhatsApp() call). Twilio POSTs here once
 * per status transition a message goes through — queued, sent, delivered,
 * undelivered, failed — which is the actual delivery outcome; the
 * synchronous response sendSms()/sendWhatsApp() already record only
 * confirms Twilio *accepted* the message for sending, never that a
 * carrier delivered it (task #96 — the exact blind spot that left this
 * untracked).
 *
 * MessageSid is the same id saved as Message.externalId when the message
 * was first created (src/lib/sending.ts) — that's the join. A callback
 * for a message not found here (sent before this shipped, or from a
 * conversation channel other than text/whatsapp) is a no-op, not an
 * error.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const business = await findBusinessByTwilioSecret(secret);
  if (!business) return NextResponse.json({ received: true });

  const formParams = await parseTwilioForm(request);

  // Signature verification is mandatory — same posture as every other
  // inbound Twilio callback in this family (see the SMS route for why a
  // business with no saved Auth Token is rejected rather than trusted).
  if (!business.twilioAuthToken) {
    console.warn(`Twilio status callback for business ${business.id} dropped: no Auth Token saved, signature can't be verified.`);
    return NextResponse.json({ received: true }, { status: 403 });
  }
  const signature = request.headers.get("x-twilio-signature");
  if (!validateTwilioRequestSignature(business.twilioAuthToken, request, formParams, signature)) {
    return NextResponse.json({ received: true }, { status: 403 });
  }

  const messageSid = formParams.MessageSid;
  const status = formParams.MessageStatus;
  if (!messageSid || !status) return NextResponse.json({ received: true });

  // Message.externalId is globally unique (it's a Twilio SID), so no
  // businessId filter is needed here beyond what the signature check
  // already guarantees. updateMany (not update) so a callback for a SID
  // that doesn't match any row (never sent, or sent before this shipped)
  // matches zero rows and returns cleanly instead of throwing.
  await prisma.message
    .updateMany({
      where: { externalId: messageSid },
      data: {
        deliveryStatus: status,
        deliveryErrorCode: formParams.ErrorCode || null,
        deliveryErrorMessage: formParams.ErrorMessage || null,
        deliveryUpdatedAt: new Date(),
      },
    })
    .catch((err) => {
      // Never let a DB hiccup here surface to Twilio as a failure worth
      // retrying aggressively — this is bookkeeping on an already-sent
      // message, not something a lead-facing flow depends on.
      console.error(`Failed to record Twilio delivery status for ${messageSid}:`, err);
    });

  return NextResponse.json({ received: true });
}
