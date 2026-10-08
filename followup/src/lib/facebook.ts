import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { messengerLeadId } from "@/lib/instagramId";
import { readMetaError, ownerFacingMetaError, type MetaSendResult } from "@/lib/metaGraph";
import { quickRepliesForGraph, validateQuickReplies, type QuickReply } from "@/lib/quickReplies";
import type { Lead } from "@prisma/client";

/**
 * Facebook Page capture: Messenger DMs and Lead Ads, through the same Meta
 * app and webhook URL as Instagram (src/app/api/instagram/webhook/route.ts
 * branches on `object === "page"`). A business connects by pasting a Page
 * access token (Settings → Facebook); the Page ID is resolved from it and
 * is how inbound events are routed.
 *
 * Messenger leads are keyed by the Page-scoped user ID (PSID) in
 * Lead.phone as "fb:<psid>" (src/lib/instagramId.ts). Lead Ads leads are
 * real people with a name/email/phone from the form, keyed by email.
 */
// Every id interpolated into a Graph path below is encodeURIComponent'd,
// including the ones that "can only be numeric". A PSID and a leadgen id
// arrive from a webhook payload, and a path segment is the one place a
// stray "/" or "?" turns an id into a different request entirely. Three
// of them were bare until 2026-09-20.
const GRAPH = "https://graph.facebook.com/v21.0";

export async function resolveFacebookPage(pageAccessToken: string): Promise<{ id: string; name?: string } | null> {
  const res = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.id ? { id: data.id, name: data.name } : null;
}

async function pageToken(businessId: string): Promise<{ pageId: string; token: string } | null> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { facebookPageId: true, facebookPageAccessToken: true },
  });
  if (!b?.facebookPageId || !b.facebookPageAccessToken) return null;
  return { pageId: b.facebookPageId, token: b.facebookPageAccessToken };
}

/**
 * Sends a Messenger DM from the connected Page. `quickReplies` are the
 * reply chips under it — same rules and same boundary check as
 * sendInstagramMessage in src/lib/instagram.ts. `messaging_type: RESPONSE`
 * is the in-window shape; the out-of-window human-agent tag is a separate,
 * human-only path that does not exist yet (api-facts §C4).
 */
export async function sendMessengerMessage(
  businessId: string,
  psid: string,
  text: string,
  options: { quickReplies?: QuickReply[]; humanAgent?: boolean } = {}
): Promise<MetaSendResult> {
  const pt = await pageToken(businessId);
  if (!pt) return { success: false, message: "Facebook isn't connected yet — check Settings → Facebook." };
  // Never chips on a tagged send — see sendInstagramMessage.
  const checked = validateQuickReplies(options.humanAgent ? undefined : options.quickReplies);
  if (!checked.ok) return { success: false, message: checked.reason };

  const message: Record<string, unknown> = { text };
  if (checked.quickReplies) message.quick_replies = quickRepliesForGraph(checked.quickReplies);

  // RESPONSE inside the 24-hour window; MESSAGE_TAG + HUMAN_AGENT for a
  // human's reply within 7 days of the lead's last message (api-facts
  // §C4, confirmed shape). The two are mutually exclusive, never both.
  const envelope = options.humanAgent
    ? { recipient: { id: psid }, messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT", message }
    : { recipient: { id: psid }, messaging_type: "RESPONSE", message };

  const res = await fetch(`${GRAPH}/${encodeURIComponent(pt.pageId)}/messages?access_token=${encodeURIComponent(pt.token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
  });
  if (!res.ok) {
    const failure = await readMetaError(res, "Facebook rejected this message.", "Messenger");
    // The one place Meta's prose is rewritten: the reader here is a
    // business owner looking at a drafted message, not someone
    // connecting a channel. Codes and the raw text stay on the
    // result and in the log for anyone debugging.
    return { ...failure, message: ownerFacingMetaError(failure.message ?? "", "Facebook rejected this message.", "Messenger") };
  }
  // Meta's id for this message, the same as sendInstagramMessage keeps: the
  // Page's echo of this send (message_echoes, see
  // subscribeFacebookPageWebhooks) carries it as `mid`, and captureDirectReply
  // upserts on it. Without it the echo was stored as a second copy marked
  // "sent directly on Messenger". A 200 without a readable body is still a
  // send that happened.
  const sent = await res.json().catch(() => null);
  const messageId = typeof sent?.message_id === "string" && sent.message_id ? sent.message_id : undefined;
  return messageId ? { success: true, messageId } : { success: true };
}

/**
 * Subscribes this app to the connected Page's webhooks. Without it, a
 * Page can be connected — token saved, name and ID resolved, Settings
 * green — and Meta will never deliver a single Messenger DM or Lead Ad
 * to it. The dashboard webhook (callback URL + fields) is only half of
 * the setup; the other half is per-Page and is this call.
 *
 * The same gap was found live on the Instagram side on 2026-09-19 (see
 * subscribeInstagramWebhooks in src/lib/instagram.ts, and subscribeAppToWaba
 * in whatsappCloud.ts). Facebook was the one of the three that never got
 * it: both of its connect paths saved the token and stopped there.
 *
 * `messages` carries Messenger DMs, the thing this channel promises.
 * `leadgen` (Lead Ads) is added only where Lead Ads is switched on
 * (leadAdsEnabledFor): founder, 2026-09-28, the Facebook review asks only
 * for what Messenger needs, and Meta refuses the whole subscription when
 * `leadgen` is asked for without the leads_retrieval permission.
 * handlePageEvents() reads leadgen.
 *
 * `message_echoes` carries what the Page itself sent: the owner answering
 * from the Page inbox or Meta Business Suite, and Meta's own Business AI.
 * Unlike Instagram, where an echo rides inside `messages` with is_echo,
 * Messenger only sends echoes on this separate field. Without it
 * handlePageEvents' echo branch never ran: an owner's reply from the Page
 * inbox was never recorded, so the lead still read as unanswered, the
 * acknowledgement's grace period could not see the owner answer first, and
 * the unanswered rule drafted (or sent) a reply on top of the owner's.
 * FollowUp's own sends echo too; sendMessengerMessage keeps Meta's id so
 * that echo lands on FollowUp's row instead of beside it.
 *
 * Best effort at the call sites: the connection is saved either way and
 * the outcome is persisted, so a Page that could not be subscribed says
 * so in Settings instead of sitting silently.
 */
export async function subscribeFacebookPageWebhooks(
  pageId: string,
  pageAccessToken: string,
  options: { leadAds?: boolean } = {}
): Promise<{ ok: true } | { ok: false; message: string }> {
  // `leadgen` only where Lead Ads is switched on (leadAdsEnabledFor below):
  // Meta refuses the WHOLE subscription when it is asked for without
  // leads_retrieval, so asking for it everywhere would silence Messenger too.
  const fields = options.leadAds ? "messages,message_echoes,leadgen" : "messages,message_echoes";
  const res = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ subscribed_fields: fields, access_token: pageAccessToken }),
  });
  if (res.ok) return { ok: true };
  const failure = await readMetaError(res, "Facebook refused the webhook subscription.", "Facebook subscribed_apps");
  return { ok: false, message: failure.message ?? `HTTP ${res.status}` };
}

/**
 * The above, plus the record of it, for the three places a Page gets
 * connected: the OAuth callback when the person manages exactly one
 * Page, the picker when they manage several, and a pasted Page token.
 * All three used to save a token and stop, which is the bug.
 *
 * Only a success is written. A failure deliberately leaves the column
 * null — "Meta has never confirmed this" is the honest reading, and it
 * is what Settings shows a warning and a retry for.
 */
export async function activateFacebookPageWebhooks(
  businessId: string,
  pageId: string,
  pageAccessToken: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await subscribeFacebookPageWebhooks(pageId, pageAccessToken, { leadAds: leadAdsEnabledFor(businessId) });
  if (result.ok) {
    await prisma.business.update({
      where: { id: businessId },
      data: { facebookWebhookSubscribedAt: new Date() },
    });
  }
  return result;
}

/**
 * Tells Meta to stop delivering this Page's events to FollowUp.
 *
 * The counterpart to subscribeFacebookPageWebhooks, and it did not exist
 * until 2026-09-20. Disconnect nulled the token and the Page id and
 * stopped there, so Meta kept POSTing every Messenger DM and Lead Ad for
 * a Page the customer had disconnected. The webhook route persists the
 * signed envelope BEFORE it looks up a business, so those messages — real
 * customers' words and their PSIDs — kept landing in InboundWebhookEvent
 * with businessId null and sat there for 14 to 90 days, out of reach of
 * deleteBusinessData's businessId filter.
 *
 * Called BEFORE the token is cleared, for the obvious reason: afterwards
 * there is no credential left to unsubscribe with, ever. Best-effort —
 * the disconnect must succeed regardless, the same posture as
 * unsubscribeAppFromWaba in whatsappCloud.ts.
 */
export async function unsubscribeFacebookPageWebhooks(pageId: string, pageAccessToken: string): Promise<void> {
  await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?access_token=${encodeURIComponent(pageAccessToken)}`, {
    method: "DELETE",
  }).catch(() => {});
}

/**
 * Best-effort display name for a PSID; Meta only allows this after the person has messaged the Page.
 *
 * Before App Review this is refused and every Messenger lead is called
 * "Facebook Messenger". Meta's reason used to be thrown away, so nobody
 * could tell a missing permission from a missing feature; it is now
 * logged (codes and Meta's words, never the token). `name` is asked for
 * alongside the two halves because some setups return only the full name
 * (Facebook review pack, 2026-09-28).
 */
async function lookupSenderName(businessId: string, psid: string): Promise<string | null> {
  const pt = await pageToken(businessId);
  if (!pt) return null;
  const res = await fetch(`${GRAPH}/${encodeURIComponent(psid)}?fields=name,first_name,last_name&access_token=${encodeURIComponent(pt.token)}`).catch(() => null);
  if (!res) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data?.error ?? {};
    console.warn(
      `Messenger sender name refused for business ${businessId}: HTTP ${res.status}, code ${error.code ?? "?"}, subcode ${error.error_subcode ?? "?"}: ${typeof error.message === "string" ? error.message.slice(0, 200) : ""}`
    );
    return null;
  }
  const halves = [data?.first_name, data?.last_name].filter((v) => typeof v === "string" && v.trim()).join(" ").trim();
  const full = typeof data?.name === "string" ? data.name.trim() : "";
  return halves || full || null;
}

export async function findOrCreateLeadByMessenger(businessId: string, psid: string): Promise<Lead> {
  const phone = messengerLeadId(psid);
  const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
  if (existing) {
    return prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: new Date() } });
  }
  try {
    const name = (await lookupSenderName(businessId, psid)) ?? "Facebook Messenger";
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name,
        phone,
        source: "Facebook Messenger",
        stage: "NEW",
        lastContacted: new Date(),
        assignedToId: await pickAssignee(businessId),
      },
    });
    await applySourceRouting(businessId, lead.id, "Facebook Messenger");
    return lead;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.lead.findFirst({ where: { businessId, phone } });
      return prisma.lead.update({ where: { id: winner!.id }, data: { lastContacted: new Date() } });
    }
    throw err;
  }
}

export interface LeadgenFields {
  name: string;
  email: string | null;
  phone: string | null;
  details: string; // every other answer, "Question: answer" per line — becomes the first inbound message
}

/**
 * Meta's own Lead Ads Testing Tool fills every field with a placeholder,
 * "<test lead: dummy data for full_name>". The founder's first test showed
 * it as the customer's name ("Hi <test,"), and as a phone number behind the
 * Call button (2026-10-07). A placeholder is never a real answer.
 */
const META_TEST_PLACEHOLDER = /^<test lead: dummy data for [^>]*>$/i;

/** What a test lead is called, so it reads as one and the greeting stays plain ("Hi Test,"). */
export const META_TEST_LEAD_NAME = "Test Lead";

/** "when_are_you_looking_to_buy?" → "When are you looking to buy?": Meta keys a custom question by its words. */
function questionLabel(key: string): string {
  const words = key.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Answer";
}

/** A number someone could dial: 7 to 15 digits, as callPlan's isCallablePhone counts them. */
function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 && !/[a-z]/i.test(value.replace(/ext\.?/i, ""));
}

/**
 * Meta returns a Lead Ad submission as [{ name, values: [] }]. Field names
 * are whatever the advertiser called them, so this matches loosely:
 * anything that looks like an email/phone/name is lifted out, the rest is
 * kept as the lead's "message" so nothing they typed is lost. A second
 * email or phone, or a phone that isn't a number, stays in the message
 * instead of being dropped or put behind the Call button.
 */
export function parseLeadgenFields(fieldData: Array<{ name?: string; values?: string[] }>): LeadgenFields {
  let first = "";
  let last = "";
  let full = "";
  let email: string | null = null;
  let phone: string | null = null;
  let isTest = false;
  const rest: string[] = [];
  for (const f of fieldData) {
    const key = (f.name ?? "").toLowerCase();
    let value = (f.values ?? []).filter(Boolean).join(", ").trim();
    if (!value) continue;
    if (META_TEST_PLACEHOLDER.test(value)) {
      isTest = true;
      // Name, phone and email have no test value worth keeping; a question's
      // answer still shows, plainly marked, so the form's shape is visible.
      if (key.includes("email") || key.includes("phone") || ["full_name", "name", "first_name", "last_name"].includes(key)) continue;
      value = "(test answer)";
    }
    const label = questionLabel(f.name ?? "");
    const line = /[?:]$/.test(label) ? `${label} ${value}` : `${label}: ${value}`;
    if (key.includes("email")) {
      if (!email && value.includes("@")) email = value.toLowerCase();
      else rest.push(line);
    } else if (key.includes("phone")) {
      if (!phone && looksLikePhone(value)) phone = value;
      else rest.push(line);
    } else if (key === "full_name" || key === "name") full = full || value;
    else if (key === "first_name") first = value;
    else if (key === "last_name") last = value;
    else rest.push(line);
  }
  const name = (full || `${first} ${last}`.trim() || (isTest ? META_TEST_LEAD_NAME : "") || email || phone || "Facebook lead").trim();
  return { name, email, phone, details: rest.join("\n") };
}

export async function fetchLeadgenLead(businessId: string, leadgenId: string): Promise<(LeadgenFields & { createdTime: Date; formName: string | null }) | null> {
  const pt = await pageToken(businessId);
  if (!pt) return null;
  const res = await fetch(`${GRAPH}/${encodeURIComponent(leadgenId)}?fields=field_data,created_time,form_id&access_token=${encodeURIComponent(pt.token)}`);
  if (!res.ok) {
    // Meta's own code and words (never the token), so a missing permission
    // reads as one in the logs instead of a bare status.
    await readMetaError(res, "Leadgen fetch failed", `Facebook leadgen ${leadgenId}`);
    return null;
  }
  const data = await res.json().catch(() => null);
  if (!data?.field_data) return null;
  const parsed = parseLeadgenFields(data.field_data);
  return { ...parsed, createdTime: data.created_time ? new Date(data.created_time) : new Date(), formName: null };
}

/** Creates (or updates) the Lead for a Lead Ad submission. Returns the lead and whether it was new. */
export async function upsertLeadFromLeadgen(
  businessId: string,
  data: LeadgenFields & { createdTime: Date }
): Promise<{ lead: Lead; isNew: boolean } | null> {
  if (!data.email && !data.phone) return null;
  const existing = data.email
    ? await prisma.lead.findFirst({ where: { businessId, email: data.email } })
    : await prisma.lead.findFirst({ where: { businessId, phone: data.phone! } });
  if (existing) {
    const lead = await prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: data.createdTime } });
    return { lead, isNew: false };
  }
  const lead = await prisma.lead.create({
    data: {
      businessId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: "Facebook Lead Ad",
      stage: "NEW",
      lastContacted: data.createdTime,
      assignedToId: await pickAssignee(businessId),
    },
  });
  void notifyLeadEvent(businessId, "lead.created", lead);
  await applySourceRouting(businessId, lead.id, "Facebook Lead Ad");
  return { lead, isNew: true };
}

// --- One-click OAuth ("Connect with Facebook") -------------------------
//
// Facebook Login for Business: separate app identity from Instagram
// Login above — this is the MAIN Meta app's own App ID/Secret. See
// docs/meta-oauth-setup.md for the console steps and exact permissions
// to request in App Review. Only what Messenger needs (founder,
// 2026-09-28): asking for a permission the review video can't show in use
// is a common rejection. pages_read_engagement had no code using it;
// leads_retrieval waits for Lead Ads.
//
// business_management (founder, 2026-09-29): since Graph API v17,
// /me/accounts leaves out a Page owned by a business portfolio unless the
// app also holds this permission, even when the person has full control of
// that Page. Without it, connecting the founder's own portfolio Page said
// "That Facebook account doesn't manage any Pages". Most businesses keep
// their Page in a portfolio, so every one of them would have hit the same
// wall.
const FACEBOOK_OAUTH_SCOPES = "pages_show_list,pages_messaging,pages_manage_metadata,business_management";

/**
 * Lead Ads (founder, 2026-10-07: "yes", after the realtor team, whose 600
 * leads a month come from ad forms). Reading a form submission needs
 * leads_retrieval, and pages_read_engagement alongside it; neither is in
 * the App Review now in progress, so they are asked for only where
 * Lead Ads is switched on.
 *
 * Switched on per business by LEAD_ADS_BUSINESS_IDS (comma-separated
 * Business ids, or "*" for everyone once Meta approves the permission).
 * Until then it is the founder's own business: Meta lets a person with a
 * role on the app use a permission before review, which is also how the
 * review video gets recorded. Empty or unset: off everywhere, exactly as
 * before.
 */
const LEAD_ADS_SCOPES = "leads_retrieval,pages_read_engagement";

export function leadAdsEnabledFor(businessId: string | null | undefined, env: string | undefined = process.env.LEAD_ADS_BUSINESS_IDS): boolean {
  const list = (env ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.includes("*")) return true;
  return !!businessId && list.includes(businessId);
}

export function facebookOAuthScopes(businessId?: string | null): string {
  return leadAdsEnabledFor(businessId) ? `${FACEBOOK_OAUTH_SCOPES},${LEAD_ADS_SCOPES}` : FACEBOOK_OAUTH_SCOPES;
}

export function facebookOAuthAvailable(): boolean {
  return !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET;
}

export function buildFacebookAuthUrl(redirectUri: string, state: string, businessId?: string | null): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: facebookOAuthScopes(businessId),
    state,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export interface ManagedPage {
  id: string;
  name: string;
  accessToken: string;
}

/**
 * Authorization code → short-lived user token → long-lived (60-day) user
 * token → the Pages that person manages, EACH with its own Page access
 * token (documented as not expiring on its own — it dies only if the
 * underlying user token is revoked or the person loses their role on the
 * Page). A business connects exactly one Page (Business.facebookPageId is
 * unique); if the person manages more than one, the caller has to ask
 * which — see the picker flow in /api/facebook/oauth/callback.
 */
export async function exchangeFacebookAuthCode(
  code: string,
  redirectUri: string
): Promise<{ pages: ManagedPage[] } | { error: string }> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return { error: "Facebook sign-in isn't configured yet." };

  const shortLivedRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`
  );
  if (!shortLivedRes.ok) return { error: "Facebook rejected that sign-in — try connecting again." };
  const shortLived = await shortLivedRes.json().catch(() => ({}));
  const shortLivedToken = shortLived?.access_token;
  if (typeof shortLivedToken !== "string") return { error: "Facebook didn't return an access token." };

  const longLivedRes = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`
  );
  if (!longLivedRes.ok) return { error: "Couldn't extend that Facebook sign-in — try again." };
  const longLived = await longLivedRes.json().catch(() => ({}));
  const longLivedUserToken = longLived?.access_token;
  if (typeof longLivedUserToken !== "string") return { error: "Facebook didn't return a long-lived token." };

  const pagesRes = await fetch(`${GRAPH}/me/accounts?access_token=${encodeURIComponent(longLivedUserToken)}`);
  if (!pagesRes.ok) return { error: "Couldn't read your Facebook Pages — try connecting again." };
  const pagesData = await pagesRes.json().catch(() => ({}));
  const rows: Array<{ id?: string; name?: string; access_token?: string }> = Array.isArray(pagesData?.data) ? pagesData.data : [];
  const pages = rows
    .filter((p): p is { id: string; name: string; access_token: string } => !!p.id && !!p.access_token)
    .map((p) => ({ id: p.id, name: p.name ?? "Facebook Page", accessToken: p.access_token }));
  if (pages.length === 0) return { error: "That Facebook account doesn't manage any Pages — you need to be an admin on the Page you want to connect." };
  return { pages };
}
