import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { instagramLeadId } from "@/lib/instagramId";
import type { Lead } from "@prisma/client";

const GRAPH_API = "https://graph.instagram.com";

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
 * request body, keyed by the Meta app's App Secret — Settings → Basic in
 * the developer console, separate from any per-user access token).
 * Optional the same way Twilio's Auth Token is optional: skipped (not
 * hard-blocked) when INSTAGRAM_APP_SECRET isn't set yet, so the webhook
 * works the moment it's registered and tightens up whenever the secret
 * is added to Vercel's env vars.
 */
export function validateMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) return true; // not configured yet — see doc comment above
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Resolves the Instagram-scoped user ID for an access token, via the Graph API's own /me. Called once, when a token is saved in Settings. */
export async function resolveInstagramUserId(accessToken: string): Promise<{ id: string; username?: string } | null> {
  const res = await fetch(`${GRAPH_API}/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id ? { id: data.id, username: data.username } : null;
}

/** Sends a real Instagram DM reply via the Graph API's Messenger-style /me/messages endpoint. */
export async function sendInstagramMessage(
  businessId: string,
  recipientId: string,
  text: string
): Promise<{ success: boolean; message?: string }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { instagramAccessToken: true },
  });
  if (!business?.instagramAccessToken) {
    return { success: false, message: "Instagram isn't connected yet — check Settings → Instagram." };
  }

  const res = await fetch(`${GRAPH_API}/me/messages?access_token=${encodeURIComponent(business.instagramAccessToken)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.error?.message;
    return { success: false, message: typeof message === "string" ? message : "Instagram rejected this message." };
  }
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
 */
export async function captureDirectReply(
  leadId: string,
  channel: "instagram" | "messenger",
  body: string,
  source: "instagram_direct" | "messenger_direct",
  externalId: string | undefined,
  sentAt: Date
): Promise<void> {
  let conversation = await prisma.conversation.findFirst({ where: { leadId, channel } });
  if (!conversation) {
    conversation = await prisma.conversation.create({ data: { leadId, channel } });
  }
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
  if (!shortLivedRes.ok) return { error: "Instagram rejected that sign-in — try connecting again." };
  const shortLived = await shortLivedRes.json().catch(() => ({}));
  const shortLivedToken = shortLived?.access_token;
  if (typeof shortLivedToken !== "string") return { error: "Instagram didn't return an access token." };

  const longLivedRes = await fetch(
    `${GRAPH_API}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(appSecret)}&access_token=${encodeURIComponent(shortLivedToken)}`
  );
  if (!longLivedRes.ok) return { error: "Couldn't extend that Instagram sign-in — try again." };
  const longLived = await longLivedRes.json().catch(() => ({}));
  const longLivedToken = longLived?.access_token;
  if (typeof longLivedToken !== "string") return { error: "Instagram didn't return a long-lived token." };
  return { accessToken: longLivedToken };
}
