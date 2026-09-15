import { prisma } from "@/lib/db";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { findOrCreateConversation } from "@/lib/conversations";
import { fetchLeadgenLead, findOrCreateLeadByMessenger, upsertLeadFromLeadgen } from "@/lib/facebook";
import { captureDirectReply, createInboundMessageIfNew, findOrCreateLeadByInstagram } from "@/lib/instagram";

/**
 * What to record for one Meta message event, and what (if anything) the
 * lead actually said in words.
 *
 * Both inbound paths below used to read `event.message.text` and `continue`
 * the moment it was missing. A DM whose only content is an attachment —
 * a photo of the broken thing, a voice note, a shared reel or post — has
 * NO `text` field at all, so the whole event was skipped: no Lead row, no
 * Message, no acknowledgement, nothing anywhere in the app. "Here's a
 * picture of my roof" is a completely ordinary first contact for exactly
 * the trades/realtor businesses this product is for, and it was a
 * silently dropped lead every single time.
 *
 * `body` is what gets stored, so an attachment-only DM becomes a real,
 * visible message rather than a void. `ownWords` is ONLY what the lead
 * typed themselves, and is what the instant acknowledgement is allowed to
 * answer — feeding it a placeholder FollowUp wrote itself would invite a
 * generated reply to a message nobody sent. Empty `ownWords` makes
 * acknowledgeNewLead fall through to its always-safe fixed line (see its
 * "no inbound text" branch), which is the honest behavior here: the owner
 * is told someone got in touch, without a machine pretending to have
 * understood a photo.
 *
 * Returns null for an event that genuinely carries no message content at
 * all (a read receipt, a delivery receipt, a reaction) — those are not
 * lead messages and were correctly skipped before.
 */
export function messageContent(message: unknown): { body: string; ownWords: string } | null {
  const m = (message ?? {}) as { text?: unknown; attachments?: unknown };
  const ownWords = typeof m.text === "string" ? m.text.trim() : "";
  if (ownWords) return { body: ownWords, ownWords };

  const attachments = Array.isArray(m.attachments) ? m.attachments : [];
  if (attachments.length === 0) return null;

  // Meta's attachment `type` is a short lowercase tag (image, video,
  // audio, file, share, story_mention, ...). Kept verbatim rather than
  // mapped to prettier words so an unfamiliar future type still reads as
  // something rather than as "unknown".
  const kinds = attachments.map((a) => {
    const type = (a as { type?: unknown } | null)?.type;
    return typeof type === "string" && type ? type : "attachment";
  });
  const unique = [...new Set(kinds)];
  const label = attachments.length > 1 ? `${attachments.length} ${unique.join("/")} attachments` : unique[0];
  return { body: `[Sent ${label} with no message text]`, ownWords: "" };
}

/**
 * Everything the Meta webhook does AFTER the signed envelope has been
 * written to InboundWebhookEvent — Instagram DMs, Messenger DMs and
 * Facebook Lead Ads, the three paths that share the one callback URL.
 *
 * Lifted out of src/app/api/instagram/webhook/route.ts unchanged so a
 * replay (replayInboundWebhookEvent in @/lib/inboundEvents) re-runs exactly
 * the same code the live delivery ran. It takes the parsed envelope, not
 * the Request, because a replay only ever has the stored JSON.
 *
 * Safe to run twice on the same envelope: every write below is idempotent
 * on Message.externalId (createInboundMessageIfNew / captureDirectReply's
 * upsert), which is the same guarantee that already absorbs Meta's own
 * aggressive redeliveries. Nothing here re-acknowledges or re-scores a
 * message that is already recorded.
 *
 * No billing gate, on purpose — see the route's own comment. Capture runs
 * for every account; the money-spending half pauses inside
 * checkAiEligibility (@/lib/billing).
 */
export async function processMetaEnvelope(payload: { object?: string; entry?: unknown }): Promise<void> {
  if (payload.object === "page" && Array.isArray(payload.entry)) {
    await handlePageEvents(payload.entry);
    return;
  }
  if (payload.object !== "instagram" || !Array.isArray(payload.entry)) return;

  for (const entry of payload.entry) {
    const recipientId: string | undefined = entry.id;
    if (!recipientId) continue;

    const business = await prisma.business.findUnique({
      where: { instagramUserId: recipientId },
      select: { id: true },
    });
    if (!business) continue; // event for an Instagram account no business here has connected

    for (const event of entry.messaging ?? []) {
      const senderId: string | undefined = event.sender?.id;
      const content = messageContent(event.message);
      if (!senderId || !content) continue;

      // is_echo marks a message the connected account itself sent — not
      // through FollowUp, so not an inbound lead message. Task #68: this
      // used to just skip it. Now it's captured as a real outbound
      // Message instead of dropped — the recipient of an echo is who
      // FollowUp is talking to, so the lead lookup is symmetric with the
      // inbound path below. See Message.source in schema.prisma for why:
      // this is what lets a lead Meta's own Business AI already answered
      // (a very real, very common case now that Meta ships one free on
      // Instagram) show up as answered here too, instead of FollowUp
      // racing to send its own reply on top of one that already went
      // out — and still lets the existing human-neglect trigger
      // (src/lib/automation.ts) rescue it later if Meta's agent replied
      // once and then the thread went quiet.
      if (event.message?.is_echo) {
        const echoRecipientId: string | undefined = event.recipient?.id;
        if (!echoRecipientId) continue;
        const lead = await findOrCreateLeadByInstagram(business.id, echoRecipientId);
        const sentAt = typeof event.timestamp === "number" ? new Date(event.timestamp) : new Date();
        await captureDirectReply(lead.id, "instagram", content.body, "instagram_direct", event.message?.mid, sentAt);
        continue;
      }

      const lead = await findOrCreateLeadByInstagram(business.id, senderId);

      const conversation = await findOrCreateConversation(lead.id, "instagram");
      const isNewMessage = await createInboundMessageIfNew(conversation.id, content.body, new Date(), event.message?.mid);
      if (!isNewMessage) continue; // Meta redelivered this event — already recorded, don't re-ack/re-score

      // Reply within the minute, before the slower scoring — see src/lib/acknowledge.ts.
      // `ownWords`, not `body`: an attachment-only DM must not get a
      // generated reply to a placeholder FollowUp wrote itself (see messageContent).
      await acknowledgeNewLead(lead.id, { channel: "instagram", inboundText: content.ownWords, inboundAt: new Date() });
      await scoreAndDraftForLead(lead.id);
      await checkRapidEngagement(lead.id);
    }
  }
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
    // Same as the Instagram loop above: capture a Messenger DM or a Lead
    // Ad submission whatever the billing state, and let the AI/send half
    // pause itself downstream.

    for (const event of entry.messaging ?? []) {
      const senderId: string | undefined = event.sender?.id;
      const content = messageContent(event.message);
      if (!senderId || !content) continue;

      // Same "capture, don't drop" treatment as Instagram's echo path
      // above — see the comment there for why. Messenger's own Business
      // AI reply (or a teammate answering from the native Messenger
      // inbox) arrives the same way: an is_echo event whose sender is
      // the Page itself.
      if (event.message?.is_echo || senderId === pageId) {
        const recipientId: string | undefined = event.recipient?.id;
        if (!recipientId || recipientId === pageId) continue;
        const lead = await findOrCreateLeadByMessenger(business.id, recipientId);
        const sentAt = typeof event.timestamp === "number" ? new Date(event.timestamp) : new Date();
        await captureDirectReply(lead.id, "messenger", content.body, "messenger_direct", event.message?.mid, sentAt);
        continue;
      }

      const lead = await findOrCreateLeadByMessenger(business.id, senderId);
      const conversation = await findOrCreateConversation(lead.id, "messenger");
      const isNewMessage = await createInboundMessageIfNew(conversation.id, content.body, new Date(), event.message?.mid);
      if (!isNewMessage) continue; // Meta redelivered this event — already recorded, don't re-ack/re-score

      // `ownWords`, not `body` — see the matching comment on the Instagram path above.
      await acknowledgeNewLead(lead.id, { channel: "messenger", inboundText: content.ownWords, inboundAt: new Date() });
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
      const conversation = await findOrCreateConversation(result.lead.id, "web");
      // leadgen_id, not a message id, but it's unique per form submission
      // and there's exactly one synthetic Message per submission — the
      // same idempotency key this route uses for real message ids above.
      const isNewMessage = await createInboundMessageIfNew(conversation.id, body, data.createdTime, leadgenId);
      if (!isNewMessage) continue; // Meta redelivered this leadgen change — already recorded

      // A form lead gave an email on purpose — acknowledge by email only.
      if (result.isNew && result.lead.email) {
        await acknowledgeNewLead(result.lead.id, { channel: "email", inboundText: body, inboundAt: data.createdTime });
      }
      await scoreAndDraftForLead(result.lead.id);
    }
  }
}
