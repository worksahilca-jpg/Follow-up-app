import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { applySourceRouting } from "@/lib/sourceRouting";
import { notifyLeadEvent } from "@/lib/outboundWebhook";
import { messengerLeadId } from "@/lib/instagramId";
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

export async function sendMessengerMessage(
  businessId: string,
  psid: string,
  text: string
): Promise<{ success: boolean; message?: string }> {
  const pt = await pageToken(businessId);
  if (!pt) return { success: false, message: "Facebook isn't connected yet — check Settings → Facebook." };
  const res = await fetch(`${GRAPH}/${pt.pageId}/messages?access_token=${encodeURIComponent(pt.token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, messaging_type: "RESPONSE", message: { text } }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data?.error?.message;
    return { success: false, message: typeof message === "string" ? message : "Facebook rejected this message." };
  }
  return { success: true };
}

/** Best-effort display name for a PSID; Meta only allows this after the person has messaged the Page. */
async function lookupSenderName(businessId: string, psid: string): Promise<string | null> {
  const pt = await pageToken(businessId);
  if (!pt) return null;
  const res = await fetch(`${GRAPH}/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(pt.token)}`).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
  return name || null;
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
 * Meta returns a Lead Ad submission as [{ name, values: [] }]. Field names
 * are whatever the advertiser called them, so this matches loosely:
 * anything that looks like an email/phone/name is lifted out, the rest is
 * kept verbatim as the lead's "message" so nothing they typed is lost.
 */
export function parseLeadgenFields(fieldData: Array<{ name?: string; values?: string[] }>): LeadgenFields {
  let first = "";
  let last = "";
  let full = "";
  let email: string | null = null;
  let phone: string | null = null;
  const rest: string[] = [];
  for (const f of fieldData) {
    const key = (f.name ?? "").toLowerCase();
    const value = (f.values ?? []).filter(Boolean).join(", ").trim();
    if (!value) continue;
    if (key === "email" || key.includes("email")) email = email ?? value.toLowerCase();
    else if (key === "phone_number" || key.includes("phone")) phone = phone ?? value;
    else if (key === "full_name" || key === "name") full = full || value;
    else if (key === "first_name") first = value;
    else if (key === "last_name") last = value;
    else rest.push(`${f.name}: ${value}`);
  }
  const name = (full || `${first} ${last}`.trim() || email || phone || "Facebook lead").trim();
  return { name, email, phone, details: rest.join("\n") };
}

export async function fetchLeadgenLead(businessId: string, leadgenId: string): Promise<(LeadgenFields & { createdTime: Date; formName: string | null }) | null> {
  const pt = await pageToken(businessId);
  if (!pt) return null;
  const res = await fetch(`${GRAPH}/${leadgenId}?fields=field_data,created_time,form_id&access_token=${encodeURIComponent(pt.token)}`);
  if (!res.ok) {
    console.error(`Leadgen fetch failed for ${leadgenId}: ${res.status}`);
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
// to request in App Review (pages_show_list, pages_messaging,
// pages_manage_metadata, pages_read_engagement, leads_retrieval).
const FACEBOOK_OAUTH_SCOPES = "pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,leads_retrieval";

export function facebookOAuthAvailable(): boolean {
  return !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET;
}

export function buildFacebookAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: FACEBOOK_OAUTH_SCOPES,
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
