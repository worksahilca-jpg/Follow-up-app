import { NextRequest, NextResponse } from "next/server";
import { processInboundEvent, recordInboundWebhookEvent } from "@/lib/inboundEvents";
import { WEBHOOK_VERIFY_TOKEN, validateMetaSignature } from "@/lib/instagram";
import { recordAuthFailure } from "@/lib/monitoring";

/**
 * GET /api/instagram/webhook — Meta's one-time webhook verification
 * handshake, fired when this URL is registered as the callback in the
 * Meta Developer Console's Webhooks product. Echoes back hub.challenge
 * only if hub.verify_token matches WEBHOOK_VERIFY_TOKEN.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  recordAuthFailure("meta_webhook_verify");
  return NextResponse.json({ success: false }, { status: 403 });
}

/**
 * POST /api/instagram/webhook — real inbound events for all three Meta
 * paths that share this one callback URL: Instagram DMs, Messenger DMs,
 * and Facebook Lead Ads submissions. App-wide (single shared endpoint,
 * see src/lib/instagram.ts doc comment), so attribution to a business
 * happens per-entry inside processMetaEnvelope (@/lib/inbound/meta), not
 * here. Meta expects a fast 200 regardless of what's inside — it retries
 * aggressively on non-2xx — so every path here returns 200, the same "no
 * human is reading this response" shape as the Twilio webhooks.
 *
 * PERSIST FIRST, PROCESS AFTER. The signed envelope is written to
 * InboundWebhookEvent before any of the work it implies. That ordering is
 * what makes the 200 above honest: Meta stops retrying the moment it sees
 * one, so before this row existed, a throw anywhere in the entry loop — a
 * Graph API hiccup on a leadgen fetch, an OpenAI timeout, a cold start —
 * erased every DM in that envelope with nothing on disk to replay.
 *
 * ⚠️ Only entry.messaging is read (see processMetaEnvelope). This is
 * UNVERIFIED against Meta's actual Business-Agent behavior — there's a
 * real, unresolved possibility that a conversation Meta's AI is actively
 * handling arrives on a separate `standby` field (Messenger's older
 * Handover Protocol) instead, which this route doesn't read at all. See
 * research/integrations/2026-09-08-meta-business-agent-webhook-behavior.md
 * and the warning on captureDirectReply() (src/lib/instagram.ts) before
 * trusting the is_echo capture path at scale.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Nothing is persisted until the signature passes — an unverified
  // payload must never be stored as though it were real.
  if (!validateMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    recordAuthFailure("meta_webhook_verify", { stage: "post_signature" });
    return NextResponse.json({ success: false }, { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody || "{}");
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      payload = { __unparsedBody: rawBody };
    }
  } catch {
    // A signed-but-unparseable body used to be logged and forgotten. It's
    // stored verbatim now instead: there's nothing to process it into, but
    // if this ever fires it's a genuine mystery about Meta's own format
    // and the bytes are the only evidence of it. dispatch() marks the row
    // failed with that explanation.
    payload = { __unparsedBody: rawBody };
  }

  // No billing gate here, on purpose. Meta only retries on a non-2xx, and
  // this route always answers 200, so skipping a business's events for a
  // lapsed card didn't defer those DMs — it destroyed them, with nothing
  // left to replay once the card was fixed. Capture runs for every
  // account; the money-spending half pauses inside checkAiEligibility —
  // see @/lib/billing.
  //
  // businessId is null: one envelope can legitimately carry entries for
  // several connected accounts, so there is no single business to attribute
  // it to at this point.
  //
  // A WhatsApp envelope (object "whatsapp_business_account") has its own
  // callback at /api/whatsapp/webhook, but the Meta console lets every
  // product point at one URL — if it lands here it is stored and processed
  // as what it is rather than dropped by the Instagram/Messenger processor.
  const channel = payload.object === "whatsapp_business_account" ? "whatsapp_cloud" : "instagram_or_messenger";
  const event = await recordInboundWebhookEvent({
    provider: "meta",
    channel,
    businessId: null,
    payload,
  });

  // Never throws — a processing failure is recorded on the row, and Meta
  // still gets its 200. Returning a 500 instead would start Meta's retry
  // storm against an envelope that is already safely on disk.
  await processInboundEvent({ ...event, channel, businessId: null, payload });

  return NextResponse.json({ success: true });
}
