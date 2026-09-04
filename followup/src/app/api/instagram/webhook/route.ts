import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { WEBHOOK_VERIFY_TOKEN, findOrCreateLeadByInstagram, validateMetaSignature } from "@/lib/instagram";

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
  return NextResponse.json({ success: false }, { status: 403 });
}

/**
 * POST /api/instagram/webhook — real inbound DM events. App-wide (single
 * shared endpoint, see src/lib/instagram.ts doc comment), so every
 * event's recipient ID has to be matched against a business's
 * instagramUserId before anything else. Meta expects a fast 200 response
 * regardless of what's inside — retries aggressively on non-2xx — so
 * every path here returns success even when a business/lead lookup
 * fails, the same "no human is reading this response" shape as the
 * Twilio webhooks.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!validateMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  const payload = JSON.parse(rawBody || "{}");
  if (payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    return NextResponse.json({ success: true });
  }

  for (const entry of payload.entry) {
    const recipientId: string | undefined = entry.id;
    if (!recipientId) continue;

    const business = await prisma.business.findUnique({
      where: { instagramUserId: recipientId },
      select: { id: true },
    });
    if (!business) continue; // event for an Instagram account no business here has connected
    if (!(await requireActiveBilling(business.id))) continue;

    for (const event of entry.messaging ?? []) {
      const senderId: string | undefined = event.sender?.id;
      const text: string | undefined = event.message?.text;
      // is_echo marks a message the connected account itself sent (e.g. a
      // reply sent from the real Instagram app/website directly, not
      // through FollowUp) — skip it, it's not an inbound lead message.
      if (!senderId || !text || event.message?.is_echo) continue;

      const lead = await findOrCreateLeadByInstagram(business.id, senderId);

      let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "instagram" } });
      if (!conversation) {
        conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "instagram" } });
      }
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", body: text, sentAt: new Date() },
      });
      await scoreAndDraftForLead(lead.id);
    }
  }

  return NextResponse.json({ success: true });
}
