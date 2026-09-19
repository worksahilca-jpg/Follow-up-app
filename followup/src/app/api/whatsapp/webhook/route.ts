import { NextRequest, NextResponse } from "next/server";
import { processInboundEvent, recordInboundWebhookEvent } from "@/lib/inboundEvents";
import { WEBHOOK_VERIFY_TOKEN, validateMetaSignature } from "@/lib/instagram";
import { recordAuthFailure } from "@/lib/monitoring";

/**
 * GET /api/whatsapp/webhook — Meta's one-time verification handshake for
 * the WhatsApp product's callback URL. Same verify token as the
 * Instagram/Messenger webhook (one app, one token).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === WEBHOOK_VERIFY_TOKEN && params.get("hub.challenge")) {
    return new NextResponse(params.get("hub.challenge"), { status: 200 });
  }
  recordAuthFailure("meta_webhook_verify");
  return NextResponse.json({ success: false }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook — customer messages, delivery statuses, the
 * owner's own replies from the WhatsApp Business app (echoes) and the
 * one-time history sync, for every business's connected number. App-wide
 * like the Instagram webhook: which business an entry belongs to is
 * decided per change inside processWhatsAppCloudEnvelope
 * (@/lib/inbound/whatsappCloud) from the phone_number_id it names.
 *
 * Signed with the app secret (FACEBOOK_APP_SECRET — WhatsApp is a product
 * of the main app, not the separate Instagram Login identity), checked by
 * the same validateMetaSignature. PERSIST FIRST, PROCESS AFTER, always
 * answer 200 — see src/app/api/instagram/webhook/route.ts for the full
 * argument; nothing about it differs here.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!validateMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    recordAuthFailure("meta_webhook_verify", { stage: "post_signature", product: "whatsapp" });
    return NextResponse.json({ success: false }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody || "{}");
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) payload = { __unparsedBody: rawBody };
  } catch {
    payload = { __unparsedBody: rawBody };
  }

  // businessId null: one envelope can carry entries for several numbers.
  const event = await recordInboundWebhookEvent({ provider: "meta", channel: "whatsapp_cloud", businessId: null, payload });
  await processInboundEvent({ ...event, channel: "whatsapp_cloud", businessId: null, payload });

  return NextResponse.json({ success: true });
}
