import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { findOrCreateConversation } from "@/lib/conversations";
import { instagramLeadId } from "@/lib/instagramId";
import { recordAuthFailure } from "@/lib/monitoring";
import { quickRepliesForGraph, validateQuickReplies, type QuickReply } from "@/lib/quickReplies";
import { readMetaError, ownerFacingMetaError, type MetaSendResult } from "@/lib/metaGraph";
import type { Lead } from "@prisma/client";

// Pinned, like src/lib/facebook.ts. An unversioned Graph call is "converted
// to the oldest available version an app can access" (Meta's FAQ), so
// every send used to run on whatever that happened to be, silently.
// v21.0 is usable until 2027-01-21 (research/integrations/2026-09-16-meta-
// human-agent-and-quick-replies-api-facts.md §C); bump both files together.
const GRAPH_VERSION = "v21.0";
// Exported so the conversation poller (src/lib/instagramPoll.ts) reads the
// same pinned version rather than keeping a second copy that can drift.
export const GRAPH_API = `https://graph.instagram.com/${GRAPH_VERSION}`;
// The long-lived token exchange is documented unversioned
// (graph.instagram.com/access_token) and was working that way; left alone.
const GRAPH_OAUTH = "https://graph.instagram.com";

/**
 * Instagram DM capture via the Instagram Graph API. Two ids, easily mixed
 * up: the Meta Developer App "FollowUp" is 2713853435677364 (the Facebook
 * app — webhooks, App Review), but Instagram Login uses the separate
 * Instagram app inside it, "FollowUp-IG", 1070892255325237. INSTAGRAM_APP_ID
 * and INSTAGRAM_APP_SECRET are that Instagram pair, never the Facebook one
 * (docs/meta-oauth-setup.md).
 *
 * If "Connect with Instagram" fails at the long-lived exchange with
 * "Unsupported request - method type: get [100]" on both GET and POST, check
 * the account's ROLE before touching this code: on 2026-09-25 that exact
 * error was an account that was not an accepted Instagram Tester on the app.
 * Accepting the invite (instagram.com/accounts/manage_access → Tester
 * invites) made the same code connect first time. Two code changes (#319,
 * #320) were spent on the wrong cause before that was found.
 *
 * Unlike Twilio/the generic
 * webhook, this is a SINGLE app-wide integration — one Meta app, one
 * webhook callback URL configured once in the Meta console — not a
 * per-business URL/secret. Each business's own connected Instagram
 * account is identified by instagramUserId once its access token is
 * saved (see src/app/api/instagram/config/route.ts), and inbound webhook
 * events get routed to the right business by matching that ID against
 * the event's recipient ID.
 *
 * Leads have no dedicated "Instagram-scoped ID" column — phone has no
 * format validation (it's just a unique-per-business text column, not
 * checked against a phone number shape), so it's reused here the same way
 * Twilio reuses it for a real phone number, prefixed `ig:` so the two can
 * never collide and so it's obvious at a glance in the UI where a given
 * lead's "phone" field actually came from. The prefix logic itself lives
 * in src/lib/instagramId.ts, a zero-dependency leaf module — see that file
 * for why (a client component needs isInstagramLeadId without pulling in
 * everything else this file imports).
 */

/**
 * This app-wide handshake secret is intentionally a literal constant, not
 * an env var: it only gates Meta's initial webhook verification GET
 * request (proving the URL is really meant to be a webhook endpoint,
 * nothing sensitive), and it has to be typed into the Meta console by
 * hand as plain text anyway when the Webhooks product is configured —
 * there's no secret-sharing problem an env var would solve here that
 * isn't already solved by just picking a value once and using it in both
 * places. Real request authenticity for the POST payloads is INSTAGRAM_
 * APP_SECRET below, checked via HMAC signature, the same way Twilio's
 * Auth Token gates its webhooks.
 */
export const WEBHOOK_VERIFY_TOKEN = "followup_ig_a8f3c1e0d92b47";

/**
 * Validates Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw
 * request body, keyed by the app secret Meta signed it with).
 *
 * TWO secrets are tried, not one. docs/meta-oauth-setup.md is explicit
 * that this single callback URL serves **two separate products with two
 * separate credential pairs** under the one "FollowUp" Meta app:
 * "Instagram API with Instagram Login" has its own Instagram app secret
 * (INSTAGRAM_APP_SECRET), while Facebook Login for Business / Page
 * webhooks use the app's own App Secret from Settings → Basic
 * (FACEBOOK_APP_SECRET). Checking only the Instagram one meant every
 * `object: "page"` delivery — every Facebook Messenger DM and every Lead
 * Ads submission, both handled by handlePageEvents() in
 * src/app/api/instagram/webhook/route.ts — failed verification and was
 * answered with a 403, which Meta retries for a while and then disables
 * the subscription over. Two whole inbound lead channels, silently gone.
 * Each candidate still has to produce an exact HMAC match; this only
 * widens which of OUR OWN secrets is accepted, never the payload.
 *
 * Fails CLOSED when neither secret is configured. It used to return true
 * in that case, which left the endpoint fully open: `entry[0].id` is
 * matched against Business.instagramUserId / facebookPageId — both public
 * identifiers — so anyone could forge inbound "lead" messages into a
 * stranger's account, each one spending the platform's OpenAI budget on
 * scoring/drafting and firing a real outbound instant-acknowledgement DM.
 * Same posture (and the same recordAuthFailure "not_configured" reason)
 * as validateVoiceAgentCallbackAuth() in src/lib/twilio.ts.
 */
export function validateMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecrets = [process.env.INSTAGRAM_APP_SECRET, process.env.FACEBOOK_APP_SECRET].filter(
    (s): s is string => !!s
  );
  if (appSecrets.length === 0) {
    recordAuthFailure("meta_webhook_verify", { reason: "not_configured" });
    return false;
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const provided = Buffer.from(signatureHeader.slice("sha256=".length));
  return appSecrets.some((appSecret) => {
    const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"));
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  });
}

/**
 * Resolves the Instagram-scoped user ID for an access token, via the Graph
 * API's own /me. Called once, when a token is saved in Settings.
 *
 * Returns Meta's own reason on failure rather than a bare null, because
 * the caller's only other option is to guess. On 2026-09-24 a token
 * generated from the Meta console's own "Generate access tokens" panel was
 * refused here, and Settings could say nothing better than "double-check
 * you copied the whole thing" — which was almost certainly wrong advice,
 * and sent the owner looking at their clipboard instead of at the cause.
 *
 * The OAuth path in this same file learned this lesson twice (the
 * short-lived exchange on 2026-09-19, the long-lived one on 2026-09-23) and
 * both now name Meta's reason. The paste-a-token path never did, so it was
 * the one surface still failing blind — the one that matters most, since it
 * is the fallback people reach for precisely when OAuth has already failed.
 *
 * `error` carries Meta's sentence and code; it never carries the token,
 * which is not echoed in a Graph error body and is not interpolated here.
 *
 * Two ids come back, and they are not the same number (2026-09-25):
 *  - `id` is APP-SCOPED for Instagram API with Instagram Login (the
 *    founder's @followupbase: 28693476873589439). Stored as
 *    instagramUserId and used for /{id}/messages, /{id}/conversations and
 *    /{id}/subscribed_apps, which all accept it and all work today.
 *  - `user_id` is the professional-account id (17841427527466039) — the
 *    number Meta's console shows, the `entry.id` on a webhook, and the
 *    `from.id` on the account's own messages in the Conversations API.
 *    Returned as `accountId`, stored as instagramAccountId.
 * Keying routing and echo detection on `id` alone meant a webhook never
 * found its business and the poller filed the business's own sends as a
 * lead from itself (research/audit/2026-09-24-app-review-path-audit.md F1).
 *
 * `accountId` is optional on purpose: a token for which Meta returns no
 * usable `user_id` still connects exactly as it did before, and the
 * account simply keeps today's behaviour until it has one. The same goes
 * for Meta refusing the field outright: Graph fails a whole request over
 * one field it does not recognise on that node, so a 400 is retried once
 * with the fields connect has always asked for. Asking for `user_id` can
 * therefore never cost a connection that works today.
 */
export async function resolveInstagramUserId(
  accessToken: string
): Promise<{ id: string; accountId?: string; username?: string } | { error: string }> {
  const withAccountId = await readInstagramMe(accessToken, "id,user_id,username");
  if ("error" in withAccountId && withAccountId.status === 400) {
    const without = await readInstagramMe(accessToken, "id,username");
    if ("error" in without) return { error: without.error };
    console.error("Instagram /me refused the fields including user_id and accepted id,username; connected without the professional-account id.");
    return without;
  }
  return "error" in withAccountId ? { error: withAccountId.error } : withAccountId;
}

/** One /me read. `status` rides along on an HTTP refusal so the caller can tell a 400 from the rest. */
async function readInstagramMe(
  accessToken: string,
  fields: string
): Promise<{ id: string; accountId?: string; username?: string } | { error: string; status?: number }> {
  const url = `${GRAPH_API}/me?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    // A DNS or TLS failure reaching Meta is not a bad token, and saying so
    // stops the owner re-copying a token that was fine all along.
    return { error: `Couldn't reach ${GRAPH_API} at all.` };
  }
  if (!res.ok) {
    const reason = await instagramOAuthErrorMessage(res);
    console.error(`Instagram token check rejected by ${GRAPH_API}/me: HTTP ${res.status}${reason ? ` — ${reason}` : ""}`);
    return { error: `${GRAPH_API}/me: ${res.status}${reason ? ` ${reason}` : ""}`, status: res.status };
  }
  // Read as text first so `user_id` can be taken from the exact digits Meta
  // sent — see graphIdField.
  const raw = await res.text().catch(() => "");
  let data: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    data = null;
  }
  if (!data?.id) return { error: `${GRAPH_API}/me returned 200 but no account id.` };
  const accountId = graphIdField(raw, data, "user_id");
  if (data.user_id !== undefined && !accountId) {
    // Present but not something we can store exactly. Logged (it is a
    // public account id, never the token) so the first case of it is seen;
    // the connection goes ahead on `id` alone, as it always has.
    console.error(`Instagram /me returned a user_id FollowUp could not read exactly (${typeof data.user_id}).`);
  }
  return {
    id: data.id as string,
    ...(accountId ? { accountId } : {}),
    username: typeof data.username === "string" ? data.username : undefined,
  };
}

/**
 * One numeric Graph id field, exactly as Meta wrote it.
 *
 * Graph returns ids as strings, which is the only shape that survives
 * JSON.parse intact: 17841427527466039 is larger than
 * Number.MAX_SAFE_INTEGER, so if it ever arrived as a bare JSON number the
 * parsed value would already be a DIFFERENT account id (…6040). The digits
 * are then taken from the raw body instead of trusting the rounded number.
 * Anything that is not all digits is refused rather than stored, because a
 * wrong id here routes one business's DMs by another's number.
 */
function graphIdField(raw: string, data: Record<string, unknown>, field: string): string | undefined {
  const value = data[field];
  if (typeof value === "string") return /^\d+$/.test(value) ? value : undefined;
  if (typeof value === "number") {
    const exact = raw.match(new RegExp(`"${field}"\\s*:\\s*(\\d+)\\s*[,}]`));
    return exact?.[1];
  }
  return undefined;
}

/**
 * One Graph call, reduced to what a diagnostic can show: the JSON body on
 * success, or Meta's error sentence on failure. Never the token.
 */
async function graphGet(path: string, accessToken: string): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH_API}/${path}${sep}access_token=${encodeURIComponent(accessToken)}`);
  if (res.ok) return { ok: true, data: await res.json().catch(() => null) };
  const reason = await instagramOAuthErrorMessage(res);
  return { ok: false, error: `HTTP ${res.status}${reason ? ` — ${reason}` : ""}` };
}

/**
 * Three questions for Meta about a connected account, for
 * GET /api/instagram/diagnose:
 *  - account: who is actually connected (username, account_type) — the
 *    connect flow stores only the numeric id, so a connect made while the
 *    wrong Instagram account was logged in is invisible otherwise. Asks
 *    for `user_id` too, so the app-scoped `id` and the professional-account
 *    id can be compared side by side against what is stored;
 *  - subscription: does Meta list this app under the account's
 *    subscribed_apps, and with which fields;
 *  - conversations: can the token read the account's DM threads at all
 *    (needs instagram_business_manage_messages) — if this lists threads
 *    while no webhook ever arrives, the problem is delivery, not access.
 */
export async function instagramDiagnostics(igUserId: string, accessToken: string) {
  const [account, subscription, conversations] = await Promise.all([
    graphGet("me?fields=id,user_id,username,name,account_type", accessToken),
    graphGet(`${encodeURIComponent(igUserId)}/subscribed_apps`, accessToken),
    graphGet(`${encodeURIComponent(igUserId)}/conversations?platform=instagram&fields=id,updated_time&limit=3`, accessToken),
  ]);
  return { igUserId, account, subscription, conversations };
}

/**
 * Subscribes the app to the connected account's message webhooks.
 *
 * For "Instagram API with Instagram Login" the dashboard webhook
 * (callback URL + `messages` field) is only half of it: each professional
 * account must also have the app subscribed to it, through
 * POST /{ig-user-id}/subscribed_apps with that account's token. Seen
 * live on 2026-09-19: the first account connected through OAuth got no
 * webhook at all for a real DM — nothing in InboundWebhookEvent — until
 * this call existed. Same shape as subscribeAppToWaba in whatsappCloud.ts.
 *
 * Best effort at the call sites: the connection is saved either way, the
 * outcome is logged and audited, and reconnecting retries it.
 */
export async function subscribeInstagramWebhooks(
  igUserId: string,
  accessToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${GRAPH_API}/${encodeURIComponent(igUserId)}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ subscribed_fields: "messages", access_token: accessToken }),
  });
  if (res.ok) return { ok: true };
  const reason = await instagramOAuthErrorMessage(res);
  console.error(`Instagram subscribed_apps rejected: HTTP ${res.status}${reason ? ` — ${reason}` : ""}`);
  return { ok: false, message: reason || `HTTP ${res.status}` };
}

/**
 * Tells Meta to stop delivering this account's DMs to FollowUp.
 *
 * The counterpart to subscribeInstagramWebhooks, added 2026-09-20 for
 * the same reason as the Facebook one: disconnect cleared the token and
 * stopped, so Meta kept posting DMs for a disconnected account and the
 * webhook route kept storing them (businessId null) for up to 90 days.
 * Called BEFORE the token is cleared — afterwards there is nothing left
 * to unsubscribe with. Best-effort; the disconnect succeeds either way.
 */
export async function unsubscribeInstagramWebhooks(igUserId: string, accessToken: string): Promise<void> {
  await fetch(`${GRAPH_API}/${encodeURIComponent(igUserId)}/subscribed_apps?access_token=${encodeURIComponent(accessToken)}`, {
    method: "DELETE",
  }).catch(() => {});
}

/**
 * The above, plus the record of it.
 *
 * Until 2026-09-20 the call sites made the subscription and then threw
 * the answer away into an audit row. A refusal left the account saved,
 * named and showing a green "Connected — real DMs will become leads
 * automatically" tick, on an account that would never receive a DM;
 * the only trace was a meta field on an audit event nobody reads. The
 * same shape as activateFacebookPageWebhooks in src/lib/facebook.ts.
 *
 * Only a success is written. A failure deliberately leaves the column
 * null — "Meta has never confirmed this" is the honest reading, and it
 * is what Settings shows a warning and a retry for.
 */
export async function activateInstagramWebhooks(
  businessId: string,
  igUserId: string,
  accessToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await subscribeInstagramWebhooks(igUserId, accessToken);
  if (result.ok) {
    await prisma.business.update({
      where: { id: businessId },
      data: { instagramWebhookSubscribedAt: new Date() },
    });
  }
  return result;
}

/**
 * Sends a real Instagram DM via the Graph API's /{IG_USER_ID}/messages
 * endpoint (the documented path; /me/messages is the fallback for a
 * business connected before instagramUserId was stored).
 *
 * `quickReplies` are the reply chips under the message — see
 * src/lib/quickReplies.ts for why they exist and what Meta allows. They
 * render in the Instagram app only, never on desktop, so nothing
 * owner-facing may promise the lead "will see buttons". Validated here at
 * the boundary so a bad set is a plain refusal rather than a Graph 400.
 *
 * `status` is Meta's own HTTP status on a failure — src/lib/sending.ts
 * needs it to tell a Graph 500 (worth retrying) from a permanently closed
 * messaging window (not).
 */
export async function sendInstagramMessage(
  businessId: string,
  recipientId: string,
  text: string,
  options: { quickReplies?: QuickReply[]; humanAgent?: boolean } = {}
): Promise<MetaSendResult> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { instagramAccessToken: true, instagramUserId: true },
  });
  if (!business?.instagramAccessToken) {
    return { success: false, message: "Instagram isn't connected yet — check Settings → Instagram." };
  }
  // A human-agent send never carries chips: whether Meta accepts the two
  // together is unverified (api-facts §C, "not found"), and a rejected
  // send would cost the owner the one message they are allowed. The
  // question is still in the words; the lead can type.
  const checked = validateQuickReplies(options.humanAgent ? undefined : options.quickReplies);
  if (!checked.ok) return { success: false, message: checked.reason };

  const message: Record<string, unknown> = { text };
  if (checked.quickReplies) message.quick_replies = quickRepliesForGraph(checked.quickReplies);

  // The out-of-window shape (api-facts §C3, best reconstruction — the
  // first live send with the Human Agent feature granted pins whether
  // the Instagram Login host wants messaging_type as well as tag).
  // Only sendFollowUpToLead sets this, and only for a send an
  // authenticated person tapped; see META_HUMAN_AGENT_MAX_HOURS.
  const envelope: Record<string, unknown> = { recipient: { id: recipientId }, message };
  if (options.humanAgent) {
    envelope.messaging_type = "MESSAGE_TAG";
    envelope.tag = "HUMAN_AGENT";
  }

  const path = business.instagramUserId ? `/${encodeURIComponent(business.instagramUserId)}/messages` : "/me/messages";
  const res = await fetch(`${GRAPH_API}${path}?access_token=${encodeURIComponent(business.instagramAccessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });

  if (!res.ok) {
    const failure = await readMetaError(res, "Instagram rejected this message.", "Instagram");
    // The one place Meta's prose is rewritten: the reader here is a
    // business owner looking at a drafted message, not someone
    // connecting a channel. Codes and the raw text stay on the
    // result and in the log for anyone debugging.
    return { ...failure, message: ownerFacingMetaError(failure.message ?? "", "Instagram rejected this message.") };
  }
  // Meta's id for this message. It used to be thrown away, so FollowUp's
  // own send was stored with no externalId, and when the poller read it
  // back minutes later nothing matched: it came back either as a phantom
  // lead from the business itself or as a second copy labelled "sent
  // directly on Instagram" (audit 2026-09-24 F2). A 200 without a readable
  // body is still a send that happened, so a missing id is not a failure.
  const sent = await res.json().catch(() => null);
  const messageId = typeof sent?.message_id === "string" && sent.message_id ? sent.message_id : undefined;
  return messageId ? { success: true, messageId } : { success: true };
}

/**
 * Optimistic find-or-create, same shape as Twilio's phone lookup — a later
 * DM from the same sender should update one lead, not create a new one
 * each time. Backed by Lead's `(businessId, phone)` unique constraint
 * (the Instagram-prefixed id is stored in the `phone` column — see the
 * file doc comment above), so two concurrent DMs from a brand-new sender
 * can't both create a Lead: the loser's `create` gets a P2002, caught
 * below and turned into the same "just update lastContacted" outcome as
 * the non-race path. Not a plain Prisma `upsert` because
 * `applySourceRouting` must run exactly once, only on genuine creation.
 */
export async function findOrCreateLeadByInstagram(
  businessId: string,
  senderId: string,
  senderUsername?: string
): Promise<Lead> {
  const phone = instagramLeadId(senderId);
  const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
  if (existing) {
    // Learning the handle late still counts. A lead created from a
    // webhook (no username in the payload) is stuck as "Instagram DM"
    // forever otherwise, even once the poller sees who they are — and
    // that placeholder is what the first real lead got greeted by. Only
    // ever fills a blank: a name the owner typed, or one already taken
    // from a handle, is never overwritten.
    const shouldName = senderUsername && (!existing.name || existing.name === "Instagram DM");
    return prisma.lead.update({
      where: { id: existing.id },
      data: { lastContacted: new Date(), ...(shouldName ? { name: `@${senderUsername}` } : {}) },
    });
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: senderUsername ? `@${senderUsername}` : "Instagram DM",
        phone,
        source: "Instagram",
        stage: "NEW",
        lastContacted: new Date(),
        assignedToId: await pickAssignee(businessId),
      },
    });
    await applySourceRouting(businessId, lead.id, "Instagram");
    return lead;
  } catch (err) {
    // Lost the race to a concurrent request that created this lead first —
    // it's guaranteed to exist now. Don't re-run applySourceRouting; it
    // already ran once, for whichever request actually created the row.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.lead.findFirst({ where: { businessId, phone } });
      return prisma.lead.update({ where: { id: winner!.id }, data: { lastContacted: new Date() } });
    }
    throw err;
  }
}

/**
 * Task #68: records an outbound message FollowUp captured from a Meta
 * webhook "echo" but didn't send itself — most commonly Meta's own free
 * Business AI answering a DM on Instagram or Messenger, but the same
 * path for a teammate replying from the native app. Shared by both
 * channels (see the instagram/webhook route) since the logic is
 * identical once a lead + conversation are resolved: idempotent on
 * Meta's message id (webhooks redeliver), and bumps lastContacted so the
 * 5-day-silence automation doesn't also fire on a lead that was, in
 * fact, just answered outside FollowUp.
 *
 * ⚠️ UNVERIFIED AGAINST META'S ACTUAL BEHAVIOR — see
 * research/integrations/2026-09-08-meta-business-agent-webhook-behavior.md
 * before trusting this in production. Open risk: Meta may route
 * Business-Agent-held conversations through the older Messenger
 * "Handover Protocol" (a `standby` webhook field + `messaging_handovers`
 * events, not just `is_echo` on the standard `messaging` field this
 * route reads) — if so, this function may simply never get called while
 * Business Agent holds the thread, the opposite of what task #68
 * intended. Separately, `message_echoes` may carry an `app_id` that
 * could actually distinguish "Business Agent answered" from "a teammate
 * answered natively" — this function deliberately doesn't try, which
 * may be over-cautious, not necessary. Neither was confirmed via
 * WebFetch (blocked in dev) or an empirical test. Recommended before
 * relying on this at scale: connect a test account, have Business Agent
 * answer a real DM, and log the raw webhook payload this route actually
 * receives.
 */
export async function captureDirectReply(
  leadId: string,
  // "whatsapp": the owner replied from the WhatsApp Business app on their
  // phone and Meta echoed it (smb_message_echoes) — src/lib/inbound/whatsappCloud.ts.
  channel: "instagram" | "messenger" | "whatsapp",
  body: string,
  source: "instagram_direct" | "messenger_direct" | "whatsapp_direct",
  externalId: string | undefined,
  sentAt: Date
): Promise<void> {
  const conversation = await findOrCreateConversation(leadId, channel);
  if (externalId) {
    await prisma.message.upsert({
      where: { externalId },
      update: {},
      create: { conversationId: conversation.id, direction: "outbound", body, source, externalId, sentAt },
    });
  } else {
    await prisma.message.create({
      data: { conversationId: conversation.id, direction: "outbound", body, source, sentAt },
    });
  }
  await prisma.lead.update({ where: { id: leadId }, data: { lastContacted: sentAt } }).catch(() => {});
}

/**
 * Creates an inbound Message row, or detects it's already there — Meta
 * redelivers webhook events aggressively on anything but a fast 2xx (see
 * src/app/api/instagram/webhook/route.ts's own doc comment), and the
 * primary inbound paths there had no idempotency key at all, unlike
 * captureDirectReply() above's upsert-by-externalId for the is_echo
 * branch — a real gap fixed here
 * (research/audit/2026-09-08-newer-surface-audit.md finding #3). A plain
 * create + catch-the-unique-violation, not a separate
 * findUnique-then-create, is the same atomic-conditional-write posture
 * used elsewhere in this codebase (see Lead.lastRapidEngagementNotifiedAt
 * in schema.prisma) — two concurrent redeliveries of the same event
 * can't both slip past a separate read-then-write the way they could
 * here otherwise. Returns whether this call actually created the row —
 * false means the caller should skip the rest of this event (ack/scoring
 * already ran the first time).
 */
export async function createInboundMessageIfNew(
  conversationId: string,
  body: string,
  sentAt: Date,
  externalId?: string,
  // The chip payload when this inbound was a tap on one of FollowUp's own
  // reply buttons — see Message.quickReplyPayload in schema.prisma.
  quickReplyPayload?: string
): Promise<boolean> {
  try {
    await prisma.message.create({
      data: { conversationId, direction: "inbound", body, sentAt, externalId, quickReplyPayload },
    });
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") return false;
    throw err;
  }
}

// --- One-click OAuth ("Connect with Instagram") -----------------------
//
// The paste-a-token flow above still works and stays as a fallback (a
// Meta reviewer, or a business whose token was generated another way),
// but a real business owner can't generate an Instagram access token by
// hand. This is Meta's "Instagram API with Instagram Login" product —
// note this is a SEPARATE app identity from the main Facebook app used
// below for Facebook Login (see src/lib/facebook.ts): Meta's dashboard
// shows its own "Instagram app ID"/"Instagram app secret" under
// App Dashboard → your app → Instagram → API setup with Instagram Login.
// See docs/meta-oauth-setup.md for the exact console steps.
const INSTAGRAM_OAUTH_SCOPES = "instagram_business_basic,instagram_business_manage_messages";

export function instagramOAuthAvailable(): boolean {
  return !!process.env.INSTAGRAM_APP_ID && !!process.env.INSTAGRAM_APP_SECRET;
}

export function buildInstagramAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES,
    state,
    force_reauth: "true",
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Instagram's OAuth endpoints answer errors in two shapes:
 * `{ error_type, code, error_message }` (api.instagram.com) and
 * `{ error: { message, type, code } }` (graph.instagram.com). Returns the
 * human sentence from either, clipped, or "" when there is none.
 */
async function instagramOAuthErrorMessage(res: Response): Promise<string> {
  const data = await res.json().catch(() => null);
  const message = data?.error_message ?? data?.error?.message;
  if (typeof message !== "string") return "";
  // Meta's numeric code/subcode tell "redirect mismatch" (36008) from
  // "code already used" (36009) and "expired" (36007) even when the
  // sentence is the generic one. Appended so the settings line carries it.
  const code = data?.code ?? data?.error?.code;
  const subcode = data?.error_subcode ?? data?.error?.error_subcode;
  const tag = [code, subcode].filter((n) => typeof n === "number").join("/");
  return `${message.slice(0, 200)}${tag ? ` [${tag}]` : ""}`;
}

/**
 * Trades the authorization code for a long-lived (60-day) Instagram
 * access token: short-lived token first (api.instagram.com, 1 hour),
 * then the ig_exchange_token long-lived exchange (graph.instagram.com) —
 * both documented steps of "Instagram API with Instagram Login."
 * Callers should follow up with resolveInstagramUserId() for the id/username.
 */
export async function exchangeInstagramAuthCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string } | { error: string }> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) return { error: "Instagram sign-in isn't configured yet." };

  const shortLivedRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!shortLivedRes.ok) {
    // Instagram's own reason ("Invalid platform app", "Invalid Client
    // Secret", a redirect mismatch…) is the one thing that tells a wrong
    // env var from a wrong console setting. It used to be thrown away, so
    // the first live connect on 2026-09-19 failed with no way to tell
    // which of the four possible causes it was. Message only — never the
    // secret, never the code.
    const reason = await instagramOAuthErrorMessage(shortLivedRes);
    console.error(
      `Instagram code exchange rejected: HTTP ${shortLivedRes.status}${reason ? ` — ${reason}` : ""} (redirect_uri sent: ${redirectUri})`
    );
    // The first live attempt (2026-09-19) came back "make sure your
    // redirect_uri is identical to the one you used in the OAuth dialog".
    // This code sends the same string at both ends, so the only thing left
    // to compare is that string against what Meta has on file — and the
    // owner can't do that unless the line names it. The address is
    // public (it is in every OAuth dialog URL); nothing else is.
    const redirectHint = /redirect_uri/i.test(reason)
      ? ` The address we sent is ${redirectUri} — it must appear exactly like that under Business login settings → OAuth redirect URIs in Meta's dashboard.`
      : "";
    return {
      error: `Instagram rejected that sign-in${reason ? ` (Instagram said: ${reason})` : ""} — try connecting again.${redirectHint}`,
    };
  }
  const shortLived = await shortLivedRes.json().catch(() => ({}));
  const shortLivedToken = shortLived?.access_token;
  if (typeof shortLivedToken !== "string") return { error: "Instagram didn't return an access token." };

  /**
   * The long-lived exchange, and the one thing Meta will still not do.
   *
   * ## What is now known, from two live attempts
   *
   * **2026-09-23.** Connecting a brand-new demo account, the short-lived
   * exchange above succeeded — so the code, the secret and the redirect
   * URI are all correct — and this last step returned
   * "Unsupported request - method type: get". `method type: get` is Meta
   * saying the PATH does not accept GET.
   *
   * **2026-09-24.** Since the Instagram-Login endpoint is documented to
   * accept GET, the hypothesis was that this app belongs to the
   * Facebook-Login family, whose long-lived exchange lives elsewhere. So
   * both were tried, and the second answered it:
   *
   *   graph.instagram.com: 400 Unsupported request - method type: get [100]
   *   graph.facebook.com:  400 Error validating application. Cannot get
   *                        application info due to a system error. [101]
   *
   * **Code 101 is "the app id is not recognised here".** Graph does not
   * know this app at all, which it would if the app were registered on
   * that family. So the hypothesis was WRONG and is now closed: this is
   * an Instagram-Login app, and `graph.instagram.com/access_token` is the
   * right address.
   *
   * Which leaves exactly what Meta said, and nothing else: the address is
   * right, and the METHOD is wrong. There are two methods. The GET stays
   * first and unchanged — it is what the documentation describes and what
   * any already-working account uses — and POST follows it.
   *
   * Both carry identical parameters, built once above, so the two attempts
   * can never drift into asking for different things.
   *
   * Still not confirmable from here: Meta's docs are egress-blocked from
   * the build sandbox, the Vercel log connector returns 403 for this
   * project, and a hand-built request proves nothing because a fabricated
   * token fails auth (190) before the path is evaluated. The owner-facing
   * error is therefore the instrument — each real attempt has narrowed
   * this by one hypothesis, and it names every host and reason so the next
   * one can too.
   */
  const exchangeParams = {
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken,
  };

  const attempts: Array<{ label: string; url: string; init?: RequestInit }> = [
    {
      label: "graph.instagram.com GET",
      url: `${GRAPH_OAUTH}/access_token?${new URLSearchParams(exchangeParams)}`,
    },
    {
      label: "graph.instagram.com POST",
      url: `${GRAPH_OAUTH}/access_token`,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(exchangeParams),
      },
    },
  ];

  const failures: string[] = [];
  for (const attempt of attempts) {
    const res = await fetch(attempt.url, attempt.init);
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const token = body?.access_token;
      if (typeof token === "string") {
        console.log(`Instagram long-lived exchange succeeded via ${attempt.label}`);
        return { accessToken: token };
      }
      failures.push(`${attempt.label}: 200 but no access_token`);
      continue;
    }
    const reason = await instagramOAuthErrorMessage(res);
    // Host, status and Meta's own words. Never the secret, never the token
    // — neither appears in an error body, and neither is interpolated here.
    console.error(`Instagram long-lived exchange rejected by ${attempt.label}: HTTP ${res.status}${reason ? ` — ${reason}` : ""}`);
    failures.push(`${attempt.label}: ${res.status}${reason ? ` ${reason}` : ""}`);
  }

  /**
   * Both refused. The owner gets the detail, deliberately.
   *
   * This is the connect path, not the send path — the distinction
   * `readMetaError` in metaGraph.ts already draws. A business owner
   * reading a drafted reply must never see Meta's developer prose; a
   * person wiring up a channel needs the exact thing to go and fix, and a
   * sentence that names nothing leaves them with a button that does not
   * work and no way to say why. They are also, today, the only route the
   * server's reasons have back to anyone who can act on them: the log
   * connector is refused for this project.
   */
  return {
    error:
      `Couldn't extend that Instagram sign-in. Both of Meta's paths refused it — ${failures.join("; ")}. ` +
      `Sending this line to whoever set up the Meta app will identify which login type it is registered for.`,
  };
}
