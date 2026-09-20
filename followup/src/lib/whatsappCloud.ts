import { prisma } from "@/lib/db";
import { readMetaError } from "@/lib/metaGraph";
import { META_DM_WINDOW_HOURS } from "@/lib/metaWindow";

/**
 * WhatsApp on the owner's OWN number, through Meta's Cloud API.
 *
 * Founder's decision, 2026-09-19: "Nobody wants to bring or use a new
 * number that is nowhere exposed for a business." Meta's Coexistence
 * feature lets the number that already lives in the WhatsApp Business app
 * on the owner's phone be used through the API at the same time — the
 * owner keeps replying from the phone, FollowUp sees every message and can
 * reply from the same number. Twilio does not support that, so this talks
 * to graph.facebook.com directly, with the same "FollowUp" Meta app that
 * carries Instagram and Messenger. Scope and what is still unverified:
 * research/integrations/2026-09-19-whatsapp-coexistence.md.
 *
 * Three things live here: the connection record a send needs, the send
 * itself, and the Graph calls the connect flow makes (code exchange, app
 * subscription, number lookup). Inbound is src/lib/inbound/whatsappCloud.ts.
 */

// Pinned like src/lib/facebook.ts and src/lib/instagram.ts; bump together.
const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Meta's own code for "more than 24 hours since the customer last wrote —
// only an approved template may be sent now".
const RE_ENGAGEMENT_ERROR_CODE = 131047;

export type WhatsAppCloudConnection = {
  businessId: string;
  phoneNumberId: string;
  accessToken: string;
  templateName: string | null;
  templateLanguage: string | null;
};

/**
 * One button in Settings needs three things from the environment: the
 * app id (public, goes to the browser), the app secret (server, for the
 * code exchange) and the Embedded Signup configuration id created in the
 * Meta console with the WhatsApp Business app onboarding option — see
 * docs/meta-oauth-setup.md §3. Without all three Settings shows only the
 * paste-a-token fallback.
 */
export function whatsappSignupAvailable(): boolean {
  return !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET && !!process.env.WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID;
}

export async function getWhatsAppCloudConnection(businessId: string): Promise<WhatsAppCloudConnection | null> {
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      whatsappPhoneNumberId: true,
      whatsappAccessToken: true,
      whatsappCloudTemplateName: true,
      whatsappCloudTemplateLanguage: true,
    },
  });
  if (!b?.whatsappPhoneNumberId || !b.whatsappAccessToken) return null;
  return {
    businessId,
    phoneNumberId: b.whatsappPhoneNumberId,
    accessToken: b.whatsappAccessToken,
    templateName: b.whatsappCloudTemplateName,
    templateLanguage: b.whatsappCloudTemplateLanguage,
  };
}

/**
 * Meta addresses a person by their number in international format with
 * no "+" and no punctuation (a "wa_id"). Lead.phone carries the "+" so an
 * SMS from the same number lands on the same lead; strip it here, once.
 */
export function toWaId(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type WhatsAppCloudSendResult = {
  success: boolean;
  message?: string;
  /** Meta's message id ("wamid.…"), stored as Message.externalId so the statuses webhook can find the row. */
  sid?: string;
  status?: number;
  code?: number;
  /**
   * The approved template's name, set ONLY when the template was sent in
   * place of the written message — i.e. the 24-hour window had closed and
   * `body` was never delivered to anyone.
   *
   * This exists because the caller used to have no way to tell the two
   * apart. A template send returned a plain `{ success: true, sid }`, and
   * src/lib/sending.ts then recorded the undelivered draft as the outbound
   * message — so the owner's thread showed a personal reply the lead had
   * never seen, and the send counters, the rescued-leads report and the
   * draft-vs-sent learning data all counted it as a real follow-up.
   *
   * Every automated WhatsApp follow-up takes this path by construction:
   * the silence rule fires days after the lead's last message, which is
   * always outside the window.
   */
  sentTemplate?: string;
};

async function postMessage(conn: WhatsAppCloudConnection, envelope: Record<string, unknown>): Promise<WhatsAppCloudSendResult> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(conn.phoneNumberId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${conn.accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...envelope }),
  });
  if (!res.ok) return readMetaError(res, "WhatsApp rejected this message.", "WhatsApp");
  const data = await res.json().catch(() => ({}));
  const id = data?.messages?.[0]?.id;
  return { success: true, sid: typeof id === "string" ? id : undefined };
}

/**
 * Sends one WhatsApp message from the connected number.
 *
 * Inside 24 hours of the lead's last message: the words as written. Past
 * that — or before the lead has ever written, which Meta treats the same
 * way — only the business's approved utility template may go out, with
 * the lead's first name in its one placeholder. No template on file means
 * a plain refusal in words the owner can act on. Never a fallback to
 * another channel (R-003, design-brain/decisions/rejected.md).
 *
 * `hoursSinceLead` is measured by the caller (metaWindowFor in
 * src/lib/sending.ts) so this function has no database dependency of its
 * own and the window rule is the one already used for Instagram and
 * Messenger. Meta's own re-engagement error (131047) is still handled, in
 * case the clocks disagree by a minute.
 */
export async function sendWhatsAppCloud(
  conn: WhatsAppCloudConnection,
  to: string,
  body: string,
  options: { hoursSinceLead: number | null; leadFirstName?: string }
): Promise<WhatsAppCloudSendResult> {
  const waId = toWaId(to);
  if (!waId) return { success: false, message: "This lead's WhatsApp number isn't usable." };

  // Flags itself on the way out: what the lead receives here is the
  // template, never `body`, and the caller has to be able to record that.
  const sendTemplate = async (): Promise<WhatsAppCloudSendResult> => {
    const result = await postMessage(conn, {
      to: waId,
      type: "template",
      template: {
        name: conn.templateName,
        language: { code: conn.templateLanguage || "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: options.leadFirstName || "there" }] }],
      },
    });
    return result.success ? { ...result, sentTemplate: conn.templateName ?? undefined } : result;
  };

  const noTemplate = {
    success: false,
    message:
      "WhatsApp only allows a free-form reply within 24 hours of the customer's last message. Past that it needs an approved template, and none is set up in Settings → WhatsApp. They'll need to write again first, or you can add the template.",
  };

  const outsideWindow = options.hoursSinceLead === null || options.hoursSinceLead > META_DM_WINDOW_HOURS;
  if (outsideWindow) {
    if (!conn.templateName) return noTemplate;
    return sendTemplate();
  }

  const result = await postMessage(conn, { to: waId, type: "text", text: { preview_url: false, body } });
  if (result.success || result.code !== RE_ENGAGEMENT_ERROR_CODE) return result;
  if (!conn.templateName) return noTemplate;
  return sendTemplate();
}

// --- The connect flow's Graph calls (src/app/api/whatsapp/**) -----------

/**
 * Trades the code Embedded Signup hands the browser for a business
 * integration token. No redirect_uri: Meta's Embedded Signup exchange is
 * documented without one, unlike the Facebook Login flow in
 * src/lib/facebook.ts.
 */
export async function exchangeWhatsAppSignupCode(code: string): Promise<{ accessToken: string } | { error: string }> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return { error: "WhatsApp connect isn't configured yet." };
  const res = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`
  );
  if (!res.ok) {
    await readMetaError(res, "Meta rejected that sign-in.", "WhatsApp connect");
    return { error: "Meta rejected that sign-in — try connecting again." };
  }
  const data = await res.json().catch(() => ({}));
  return typeof data?.access_token === "string" ? { accessToken: data.access_token } : { error: "Meta didn't return an access token." };
}

/** Without this, Meta delivers no webhooks for the account — it is the subscription, not the webhook URL, that turns them on. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await readMetaError(res, "Couldn't subscribe to this WhatsApp account.", "WhatsApp connect");
    return { ok: false, message: err.message };
  }
  return { ok: true };
}

/** Best effort on disconnect; a failure here changes nothing the app relies on (the token is dropped either way). */
export async function unsubscribeAppFromWaba(wabaId: string, accessToken: string): Promise<void> {
  await fetch(`${GRAPH}/${encodeURIComponent(wabaId)}/subscribed_apps`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

/** The number as Meta shows it, and whether the token can actually read it — the same "does this token work" check the Instagram paste path does. */
export async function lookupWhatsAppNumber(
  phoneNumberId: string,
  accessToken: string
): Promise<{ displayNumber: string; verifiedName: string | null } | null> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = await res.json().catch(() => null);
  if (typeof data?.display_phone_number !== "string") return null;
  return { displayNumber: data.display_phone_number, verifiedName: typeof data.verified_name === "string" ? data.verified_name : null };
}
