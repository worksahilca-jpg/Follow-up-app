import { prisma } from "@/lib/db";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { checkRapidEngagement } from "@/lib/engagement";
import { acknowledgeNewLead } from "@/lib/acknowledge";
import { recordAudit } from "@/lib/audit";
import { findOrCreateConversation } from "@/lib/conversations";
import { fetchLeadgenLead, findOrCreateLeadByMessenger, upsertLeadFromLeadgen } from "@/lib/facebook";
import { captureDirectReply, createInboundMessageIfNew, findOrCreateLeadByInstagram } from "@/lib/instagram";
// The SAME matcher the SMS/WhatsApp webhook uses — one definition of "they
// asked us to stop" for every channel. See src/lib/optOutKeywords.ts.
import { isOptInMessage, isOptOutMessage } from "@/lib/optOutKeywords";
import { suppress, unsuppress, type DmSuppressionChannel } from "@/lib/suppression";
import { decodeQuickReplyPayload, type QuickReplyAnswer } from "@/lib/quickReplies";

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
export function messageContent(
  message: unknown
): { body: string; ownWords: string; quickReplyPayload?: string } | null {
  const m = (message ?? {}) as { text?: unknown; attachments?: unknown; quick_reply?: unknown };
  const ownWords = typeof m.text === "string" ? m.text.trim() : "";
  // A tap on a reply button arrives as an ordinary `messages` event whose
  // `text` is the button's title and whose `quick_reply.payload` is what
  // FollowUp put on the chip (api-facts §A4). The title is stored as the
  // body so the thread reads naturally; the payload rides alongside so
  // the engine knows it was a tap, not typing — see Message.quickReplyPayload.
  const payload = (m.quick_reply as { payload?: unknown } | null | undefined)?.payload;
  const quickReplyPayload = typeof payload === "string" && payload ? payload : undefined;
  if (ownWords) return quickReplyPayload ? { body: ownWords, ownWords, quickReplyPayload } : { body: ownWords, ownWords };

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
 * When the lead actually wrote, not when FollowUp noticed.
 *
 * These two used to be the same thing, because the only way a DM arrived
 * was a webhook delivered within a second of being sent. Now that
 * src/lib/instagramPoll.ts also ASKS every few minutes (Meta's push
 * proved unreliable — see that file), "noticed" can be minutes after
 * "written", and the difference matters twice:
 *
 *  - The acknowledgement holds for DM_ACK_GRACE_PERIOD_MS so the owner
 *    gets first go at answering. Started from the moment of noticing, a
 *    message found three minutes late waits another two on top — the two
 *    delays stack, and the reply lands five minutes after a lead who
 *    expects a business to be awake. Started from when they wrote, the
 *    head start is the head start, and nothing is double-counted.
 *  - A conversation's timeline should read in the order things were said.
 *
 * Clamped to now: a clock ahead of ours must never park an
 * acknowledgement in the future, where the grace period would not expire
 * until real time caught up. A missing or nonsensical timestamp falls
 * back to now, which is exactly the old behavior.
 */
function eventSentAt(event: { timestamp?: unknown }): Date {
  const ms = typeof event.timestamp === "number" ? event.timestamp : NaN;
  if (!Number.isFinite(ms) || ms <= 0) return new Date();
  return new Date(Math.min(ms, Date.now()));
}

/**
 * STOP / START in a DM, handled before anything else touches this lead.
 *
 * Instagram and Messenger had no opt-out at all: `isOptOutMessage` was
 * called from exactly one place in the codebase, the Twilio webhook, so a
 * lead who DMed "stop" kept receiving automated follow-ups while the
 * business believed the product was honouring opt-outs because it does on
 * SMS. That is the failure mode worth the most care — a silent one that
 * looks like compliance.
 *
 * The consent record is the Suppression table keyed on (businessId,
 * channel, platform user id), NOT Lead.optedOutAt — the full argument is in
 * src/lib/suppression.ts, and the short version is that the row has to
 * outlive the Lead. `senderId` is the IGSID/PSID straight off the webhook
 * event, the same id src/lib/sending.ts derives from Lead.phone before
 * sending, so the two agree by construction even if the Lead row is
 * deleted and rebuilt by the next DM.
 *
 * Returns whether this message was a STOP, because the caller must then
 * NOT acknowledge it (see src/lib/acknowledge.ts, which also refuses on its
 * own — this is the belt, that's the braces).
 */
async function applyDmConsentKeyword(
  businessId: string,
  leadId: string,
  channel: DmSuppressionChannel,
  senderId: string,
  ownWords: string
): Promise<boolean> {
  const optingOut = isOptOutMessage(ownWords);
  const optingIn = isOptInMessage(ownWords);
  if (!optingOut && !optingIn) return false;

  if (optingOut) await suppress(businessId, senderId, "keyword", channel);
  else await unsuppress(businessId, senderId, channel);

  // Same audit actions the SMS path writes (src/lib/inbound/twilioMessage.ts),
  // so the lead's trust panel tells the same story whichever channel the
  // person used to say it. Identifiers only, never the message body.
  void recordAudit({ businessId, userId: null }, optingOut ? "lead.opt_out" : "lead.opt_in", {
    targetType: "lead",
    targetId: leadId,
    meta: { channel, via: "keyword" },
  });
  return optingOut;
}

/**
 * What happens when a lead taps one of FollowUp's reply buttons.
 *
 * The tap is already stored as an inbound Message (with its payload) by
 * the time this runs — that row is what makes Meta's 24-hour door count
 * as reopened in every window check. What this decides is everything
 * else:
 *
 *  - An ANSWER chip ("Morning", "This week", "Hold a slot"): the lead has
 *    replied and the owner is now the right sender. The owner is told in
 *    one line, a fresh draft is written against the answer (the after_tap
 *    set in src/lib/dmDrafts.ts: confirm, say what happens next, no new
 *    question), and the usual engagement check runs. No acknowledgement —
 *    "thanks for your message" in reply to a button press is exactly the
 *    machine-sounding reply the whole strategy is trying not to send.
 *  - The EXIT chip ("Not now", "Leave it", "Sorted elsewhere"): FollowUp
 *    stops. No acknowledgement, no draft, no further automatic message —
 *    findUnansweredLeads() and the status badge both read the stored
 *    payload and stand down. One line to the owner, and the door stays
 *    open: anything the lead types later restarts everything. This is the
 *    Rule 3 guarantee the buttons research (§5.1) puts first; the test
 *    pins it.
 *
 * Audit trail gets the decoded payload (which message, which question,
 * which answer key) — identifiers, never the message text.
 */
async function handleQuickReplyTap(
  businessId: string,
  lead: { id: string; name: string; assignedToId: string | null },
  channel: "instagram" | "messenger",
  buttonTitle: string,
  tap: QuickReplyAnswer
): Promise<void> {
  const platform = channel === "instagram" ? "Instagram" : "Messenger";
  void recordAudit({ businessId, userId: null }, tap.exit ? "lead.dm_exit" : "lead.dm_answer", {
    targetType: "lead",
    targetId: lead.id,
    meta: { channel, touch: tap.touch, question: tap.question, answer: tap.answer },
  });
  // The title is quoted back to the owner (it is FollowUp's own words, not
  // the lead's), clipped so a chip can never carry a paragraph into a
  // notification.
  const label = buttonTitle.slice(0, 40);
  const message = tap.exit
    ? `${lead.name} tapped "${label}" on ${platform}, so FollowUp has stopped. They can write again any time.`
    : `${lead.name} tapped "${label}" on ${platform} — they answered you, and this one needs you now.`;
  await notifyLeadOwners(businessId, lead, message);
  if (tap.exit) return;
  await scoreAndDraftForLead(lead.id);
  await checkRapidEngagement(lead.id);
}

/**
 * The assignee, or every admin when nobody is assigned — the same fallback
 * notifyNeglect() in src/lib/automation.ts uses, for the same reason: a
 * pond lead that notified nobody was a real gap once.
 */
async function notifyLeadOwners(businessId: string, lead: { id: string; assignedToId: string | null }, message: string): Promise<void> {
  try {
    const userIds = lead.assignedToId
      ? [lead.assignedToId]
      : (await prisma.user.findMany({ where: { businessId, role: "ADMIN" }, select: { id: true } })).map((u) => u.id);
    for (const userId of userIds) {
      await prisma.notification.create({ data: { userId, leadId: lead.id, message } });
    }
  } catch (err) {
    console.error(`Reply-button notification failed for lead ${lead.id}:`, err);
  }
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
        await captureDirectReply(lead.id, "instagram", content.body, "instagram_direct", event.message?.mid, eventSentAt(event));
        continue;
      }

      const lead = await findOrCreateLeadByInstagram(business.id, senderId);
      const sentAt = eventSentAt(event);

      const conversation = await findOrCreateConversation(lead.id, "instagram");
      const isNewMessage = await createInboundMessageIfNew(conversation.id, content.body, sentAt, event.message?.mid, content.quickReplyPayload);
      if (!isNewMessage) continue; // Meta redelivered this event — already recorded, don't re-ack/re-score

      // A tap on one of FollowUp's own reply buttons is an answer, not a
      // new enquiry: no acknowledgement (the lead did not write anything
      // to acknowledge), and on the honest-no chip nothing at all — see
      // handleQuickReplyTap.
      const tap = content.quickReplyPayload ? decodeQuickReplyPayload(content.quickReplyPayload) : null;
      if (tap) {
        await handleQuickReplyTap(business.id, lead, "instagram", content.body, tap);
        continue;
      }

      // STOP/START first — nothing else may touch this lead before consent
      // is recorded. `ownWords`, so an attachment whose placeholder body
      // happened to read "stop" could never opt someone out.
      const optedOut = await applyDmConsentKeyword(business.id, lead.id, "instagram", senderId, content.ownWords);

      if (!optedOut) {
        // Parks the acknowledgement for ~2 minutes rather than sending it
        // now — the owner gets that window to answer the DM themselves and
        // FollowUp only replies if they don't (DM_ACK_GRACE_PERIOD_MS in
        // src/lib/acknowledge.ts; /api/cron/instant-ack does the sending).
        // Nothing changes at this call site: the wait belongs to the
        // acknowledgement, not to each webhook.
        //
        // A STOP arriving during that window takes the `optedOut` branch
        // above and never reaches here — the already-queued ack is refused
        // by the suppression check acknowledgeNewLead runs at SEND time.
        //
        // `ownWords`, not `body`: an attachment-only DM must not get a
        // generated reply to a placeholder FollowUp wrote itself (see messageContent).
        await acknowledgeNewLead(lead.id, { channel: "instagram", inboundText: content.ownWords, inboundAt: sentAt });
      }
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
        await captureDirectReply(lead.id, "messenger", content.body, "messenger_direct", event.message?.mid, eventSentAt(event));
        continue;
      }

      const lead = await findOrCreateLeadByMessenger(business.id, senderId);
      const sentAt = eventSentAt(event);
      const conversation = await findOrCreateConversation(lead.id, "messenger");
      const isNewMessage = await createInboundMessageIfNew(conversation.id, content.body, sentAt, event.message?.mid, content.quickReplyPayload);
      if (!isNewMessage) continue; // Meta redelivered this event — already recorded, don't re-ack/re-score

      // A reply-button tap — same handling as the Instagram path above.
      const tap = content.quickReplyPayload ? decodeQuickReplyPayload(content.quickReplyPayload) : null;
      if (tap) {
        await handleQuickReplyTap(business.id, lead, "messenger", content.body, tap);
        continue;
      }

      // STOP/START before anything else — see the Instagram path above.
      const optedOut = await applyDmConsentKeyword(business.id, lead.id, "messenger", senderId, content.ownWords);

      if (!optedOut) {
        // Same two-minute grace period as Instagram, and `ownWords` not
        // `body` — see the matching comment on the Instagram path above.
        await acknowledgeNewLead(lead.id, { channel: "messenger", inboundText: content.ownWords, inboundAt: sentAt });
      }
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
