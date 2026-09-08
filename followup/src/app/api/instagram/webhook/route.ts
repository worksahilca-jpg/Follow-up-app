import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveBilling } from "@/lib/billing";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { fetchLeadgenLead, findOrCreateLeadByMessenger, upsertLeadFromLeadgen } from "@/lib/facebook";
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
  if (payload.object === "page" && Array.isArray(payload.entry)) {
    await handlePageEvents(payload.entry);
    return NextResponse.json({ success: true });
  }
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
      // Reply within the minute, before the slower scoring — see src/lib/acknowledge.ts.
      await acknowledgeNewLead(lead.id, { channel: "instagram", inboundText: text, inboundAt: new Date() });
      await scoreAndDraftForLead(lead.id);
      await checkRapidEngagement(lead.id);
    }
  }

  return NextResponse.json({ success: true });
}

/**
 * Facebook Page events (same Meta app, same callback URL): Messenger DMs
 * arrive as entry.messaging[], Lead Ads submissions as entry.changes[]
 * with field "leadgen". Routed to the business whose Page ID is entry.id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlePageEvents(entries: any[]): Promise<void> {
  for (const entry of entries) {
    const pageId: string | undefined = entry.id;
    if (!pageId) continue;
    const business = await prisma.business.findUnique({ where: { facebookPageId: pageId }, select: { id: true } });
    if (!business) continue;
    if (!(await requireActiveBilling(business.id))) continue;

    for (const event of entry.messaging ?? []) {
      const senderId: string | undefined = event.sender?.id;
      const text: string | undefined = event.message?.text;
      if (!senderId || !text || event.message?.is_echo || senderId === pageId) continue;
      const lead = await findOrCreateLeadByMessenger(business.id, senderId);
      let conversation = await prisma.conversation.findFirst({ where: { leadId: lead.id, channel: "messenger" } });
      if (!conversation) {
        conversation = await prisma.conversation.create({ data: { leadId: lead.id, channel: "messenger" } });
      }
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", body: text, sentAt: new Date() },
      });
      await acknowledgeNewLead(lead.id, { channel: "messenger", inboundText: text, inboundAt: new Date() });
      await scoreAndDraftForLead(lead.id);
      await checkRapidEngagement(lead.id);
    }

    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const leadgenId: string | undefined = change.value?.leadgen_id;
      if (!leadgenId) continue;
      const data = await fetchLeadgenLead(business.id, leadgenId);
      if (!data) continue;
      const result = await upsertLeadFromLeadgen(business.id, data);
      if (!result) continue;
      const body = data.details || "Submitted a Facebook lead form.";
      let conversation = await prisma.conversation.findFirst({ where: { leadId: result.lead.id, channel: "web" } });
      if (!conversation) {
        conversation = await prisma.conversation.create({ data: { leadId: result.lead.id, channel: "web" } });
      }
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "inbound", body, sentAt: data.createdTime },
      });
      // A form lead gave an email on purpose — acknowledge by email only.
      if (result.isNew && result.lead.email) {
        await acknowledgeNewLead(result.lead.id, { channel: "email", inboundText: body, inboundAt: data.createdTime });
      }
      await scoreAndDraftForLead(result.lead.id);
    }
  }
}
