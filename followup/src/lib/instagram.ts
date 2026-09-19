import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { findOrCreateConversation } from "@/lib/conversations";
import { instagramLeadId } from "@/lib/instagramId";
import { recordAuthFailure } from "@/lib/monitoring";
import { quickRepliesForGraph, validateQuickReplies, type QuickReply } from "@/lib/quickReplies";
import { readMetaError, type MetaSendResult } from "@/lib/metaGraph";
import type { Lead } from "@prisma/client";

// Pinned, like src/lib/facebook.ts. An unversioned Graph call is "converted
// to the oldest available version an app can access" (Meta's FAQ), so
// every send used to run on whatever that happened to be, silently.
// v21.0 is usable until 2027-01-21 (research/integrations/2026-09-16-meta-
// human-agent-and-quick-replies-api-facts.md §C); bump both files together.
const GRAPH_VERSION = "v21.0";
const GRAPH_API = `https://graph.instagram.com/${GRAPH_VERSION}`;
// The long-lived token exchange is documented unversioned
// (graph.instagram.com/access_token) and was working that way; left alone.
const GRAPH_OAUTH = "https://graph.instagram.com";

/**
 * Instagram DM capture via the Instagram Graph API (Meta Developer App
 * "FollowUp", App ID 2713853435677364). Unlike Twilio/the generic
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

/** Resolves the Instagram-scoped user ID for an access token, via the Graph API's own /me. Called once, when a token is saved in Settings. */
export async function resolveInstagramUserId(accessToken: string): Promise<{ id: string; username?: string } | null> {
  const res = await fetch(`${GRAPH_API}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id ? { id: data.id, username: data.username } : null;
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

  if (!res.ok) return readMetaError(res, "Instagram rejected this message.", "Instagram");
  return { success: true };
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
    return prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: new Date() } });
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

  const longLivedRes = await fetch(
    `${GRAPH_OAUTH}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`
  );
  if (!longLivedRes.ok) {
    const reason = await instagramOAuthErrorMessage(longLivedRes);
    console.error(`Instagram long-lived exchange rejected: HTTP ${longLivedRes.status}${reason ? ` — ${reason}` : ""}`);
    return { error: `Couldn't extend that Instagram sign-in${reason ? ` (Instagram said: ${reason})` : ""} — try again.` };
  }
  const longLived = await longLivedRes.json().catch(() => ({}));
  const longLivedToken = longLived?.access_token;
  if (typeof longLivedToken !== "string") return { error: "Instagram didn't return a long-lived token." };
  return { accessToken: longLivedToken };
}
