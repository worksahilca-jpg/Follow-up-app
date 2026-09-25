import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { appUrl } from "@/lib/stripe";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { applySourceRouting } from "@/lib/sourceRouting";
import { recordAuthFailure } from "@/lib/monitoring";
import type { Lead } from "@prisma/client";
import { CARRIER_CHANNELS_AVAILABLE } from "@/lib/pricing";

/**
 * Twilio SMS/voice request validation and shared helpers for
 * src/app/api/twilio/**. No `twilio` npm package here on purpose — the
 * signature check is ~10 lines of Node's built-in crypto (Twilio's own
 * algorithm: base64(HMAC-SHA1(authToken, url + sorted "key"+"value" pairs
 * concatenated))), not worth a dependency for. Reference:
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string | null
): boolean {
  if (!signature) return false;
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  // Lengths matching is required before timingSafeEqual — it throws on a
  // mismatch rather than returning false, and a forged signature of the
  // wrong length is exactly the case this needs to reject anyway.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Twilio signs the exact URL it was configured with in the Console — the
 * same one Settings generated (src/app/api/twilio/config) — on the www
 * host since 2026-09-25, on the apex before; candidateSignedUrls() below
 * accepts either spelling.
 * `request.url` inside a Next.js route handler isn't reliably identical
 * byte-for-byte on every platform (proxy/protocol rewriting is a known,
 * silent source of signature-validation failures elsewhere), so every
 * caller reconstructs the canonical URL from appUrl() + the request's own
 * pathname instead of trusting request.url directly.
 */
export function canonicalRequestUrl(request: Request): string {
  const { pathname, search } = new URL(request.url);
  return `${appUrl()}${pathname}${search}`;
}

/**
 * StatusCallback URL for an outbound SMS/WhatsApp send — same
 * inboundBaseUrl()-based construction as recordingStatusCallback in
 * src/app/api/twilio/voice/[secret]/route.ts, pointed at the delivery-
 * status webhook instead. Twilio POSTs here every time a message's
 * status changes (queued → sent → delivered/undelivered/failed).
 */
function statusCallbackUrl(secret: string): string {
  return `${inboundBaseUrl()}/api/twilio/status/${secret}`;
}

/**
 * Every URL Twilio might legitimately have signed this request against.
 * The production domain 308-redirects apex → www (Vercel's domain
 * config), and Twilio follows redirects and signs against the URL it
 * finally hits — so a webhook configured as https://followupbase.io/…
 * arrives signed for https://www.followupbase.io/…, and checking only
 * the appUrl() form rejected every real inbound call as spoofed. Each
 * candidate still has to produce an exact HMAC match; this only widens
 * which host spelling is accepted, never the secret or the params.
 */
function candidateSignedUrls(request: Request): string[] {
  // Path AND query: Twilio signs the whole URL it called, and the voice
  // fallback action is configured as ".../voice/<secret>?stage=fallback".
  // Dropping the query made every fallback request look forged.
  const { pathname: path, search } = new URL(request.url);
  const pathname = `${path}${search}`;
  const base = appUrl();
  const candidates = new Set<string>([`${base}${pathname}`]);
  const toggled = /^https?:\/\/www\./i.test(base) ? base.replace(/^(https?:\/\/)www\./i, "$1") : base.replace(/^(https?:\/\/)/i, "$1www.");
  candidates.add(`${toggled}${pathname}`);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (forwardedHost) candidates.add(`https://${forwardedHost}${pathname}`);
  return [...candidates];
}

/** validateTwilioSignature() across every host spelling this request could have been signed for — see candidateSignedUrls(). */
export function validateTwilioRequestSignature(
  authToken: string,
  request: Request,
  params: Record<string, string>,
  signature: string | null
): boolean {
  const valid = candidateSignedUrls(request).some((url) => validateTwilioSignature(authToken, url, params, signature));
  // Coarse route label only — every path here is /api/twilio/<kind>/[secret],
  // so the trailing segment is always the live per-business secret itself.
  // Dropping it (rather than reporting the full pathname) keeps this in line
  // with recordAuthFailure()'s own contract: which check failed and which
  // route, never a credential (research/audit/2026-09-09-seventh-pass-audit.md
  // finding #1 — this call was putting the raw secret in Sentry's `extra`).
  if (!valid) {
    const route = new URL(request.url).pathname.replace(/\/[^/]+$/, "");
    recordAuthFailure("twilio_signature", { route });
  }
  return valid;
}

/** application/x-www-form-urlencoded body → plain string map, as Twilio always sends it. */
export async function parseTwilioForm(request: Request): Promise<Record<string, string>> {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }
  return params;
}

/**
 * Twilio's own webhooks need a phone number, not businessId+secret, to
 * find the right business — that's what twilioSecret in the URL path is
 * for. No billing check here, and the inbound SMS/WhatsApp routes don't
 * make one either: capture never pauses on billing state, because an
 * inbound Twilio webhook that's refused is a lead deleted rather than
 * deferred (nothing retries it, and the sender is told nothing). The
 * spending half pauses instead, inside checkAiEligibility (@/lib/billing).
 * The voice route is the exception and still gates itself — see the
 * comment there.
 */
export async function findBusinessByTwilioSecret(secret: string): Promise<{
  id: string;
  name: string;
  twilioAuthToken: string | null;
  twilioAccountSid: string | null;
  voiceAgentEnabled: boolean;
} | null> {
  return prisma.business.findUnique({
    where: { twilioSecret: secret },
    select: { id: true, name: true, twilioAuthToken: true, twilioAccountSid: true, voiceAgentEnabled: true },
  });
}

/** Escapes text for use inside TwiML — a `<Say>` body or an XML attribute value (business names and phone numbers are the only user-influenced strings that ever land in TwiML here, and neither has been escaped anywhere in this file until the voice agent needed to put a business name inside a `<Say>`). */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Downloads the actual recording audio from Twilio's authenticated media
 * URL. A recordingStatusCallback only hands you a base RecordingUrl —
 * appending an extension (.mp3, the smallest/most portable format Twilio
 * offers) and authenticating with the business's own Account SID/Auth
 * Token (the same pair already used for outbound sendSms, not a new
 * credential) is required to actually fetch the bytes.
 */
export async function fetchTwilioRecording(recordingUrl: string, accountSid: string, authToken: string): Promise<Buffer> {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Twilio recording fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Optimistic find-or-create — Lead has a `(businessId, phone)` unique
 * constraint backing this, so two concurrent inbound messages for the same
 * new contact can't both create a Lead: whichever request's `create` loses
 * the race gets a P2002, which is caught below and turned into the same
 * "just update lastContacted" outcome the non-race path takes. Not a plain
 * Prisma `upsert` because `applySourceRouting` must run exactly once, only
 * on genuine creation.
 */
export async function findOrCreateLeadByPhone(
  businessId: string,
  phone: string,
  source: string,
  // A display name the channel already knows (WhatsApp sends the person's
  // profile name with every message). Used on creation, and to replace a
  // name that is still just the phone number — never to overwrite a name
  // the owner typed. Twilio's SMS/WhatsApp paths pass nothing and get the
  // number as before.
  name?: string | null
): Promise<Lead> {
  const displayName = name?.trim() || null;
  const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
  if (existing) {
    return prisma.lead.update({
      where: { id: existing.id },
      data: { lastContacted: new Date(), ...(displayName && existing.name === phone ? { name: displayName } : {}) },
    });
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: displayName ?? phone,
        phone,
        source,
        stage: "NEW",
        lastContacted: new Date(),
        assignedToId: await pickAssignee(businessId),
      },
    });
    await applySourceRouting(businessId, lead.id, source);
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
 * Atomically claims the right to send this lead a missed-call text-back —
 * same conditional-updateMany pattern as checkRapidEngagement()'s dedup
 * (src/lib/engagement.ts): succeeds only if lastMissedCallTextAt is null
 * or older than the cooldown, so this doubles as both a de-spam measure
 * (a caller who calls back two or three times in a row before anyone
 * answers — a very normal "missed call, try again" pattern — gets one
 * text, not three) and a concurrency guard (two near-simultaneous calls
 * from the same number can't both win the race and both send).
 *
 * `optedOutAt: null` is part of the claim, not a separate pre-check, and
 * it is the one condition here that is a legal requirement rather than a
 * UX nicety. The missed-call text-back is the ONLY outbound message in
 * this app that does not go through sendFollowUpToLead() (see
 * src/app/api/twilio/voice/[secret], which calls sendSms() directly), so
 * it was also the only one that never met that funnel's TCPA/CTIA
 * opt-out hard stop: a lead who replied STOP and later called the
 * business got an automated text anyway. Enforcing it inside the claim
 * — rather than in the caller — keeps it atomic with the cooldown and
 * keeps the guarantee stated in this file's own STOP_KEYWORDS comment
 * ("no send path here — manual, automated, or a sequence — can ignore
 * it") actually true.
 */
export async function claimMissedCallTextBack(leadId: string, cooldownMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMinutes * 60_000);
  const claim = await prisma.lead.updateMany({
    where: {
      id: leadId,
      optedOutAt: null,
      OR: [{ lastMissedCallTextAt: null }, { lastMissedCallTextAt: { lt: since } }],
    },
    data: { lastMissedCallTextAt: new Date() },
  });
  return claim.count === 1;
}

/**
 * wss:// URL of the separate always-on audio-bridge service that actually
 * holds a live call's Media Stream open and talks to OpenAI's Realtime API
 * (see /voice-agent at the repo root — a different Vercel project,
 * because Twilio's Media Streams need a persistent bidirectional
 * connection Next.js's own request/response model can't hold open, see
 * research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md).
 * Returns null when VOICE_AGENT_WS_URL isn't configured — callers must
 * treat that as "the live agent isn't available," never throw, since a
 * missing env var must never turn into a dropped call: the voicemail
 * fallback in src/app/api/twilio/voice/[secret]/route.ts is what runs
 * instead.
 */
export function voiceAgentStreamUrl(secret: string): string | null {
  const base = process.env.VOICE_AGENT_WS_URL;
  if (!base) return null;
  // The secret rides as a query param (?secret=...), not a path segment —
  // the bridge service is a single, plainly-named zero-config Vercel
  // Node.js Function (/voice-agent/api/stream.js), so this avoids any
  // ambiguity about how Vercel's dynamic-route file-naming interacts with
  // that function's raw WebSocket-upgrade handling.
  return `${base.replace(/\/$/, "")}/api/stream?secret=${encodeURIComponent(secret)}`;
}

/**
 * Authenticates a request FROM the voice-agent bridge service TO
 * src/app/api/twilio/voice-agent-callback/[secret] — the one inbound
 * request in this whole Twilio integration that doesn't come from Twilio
 * itself, so Twilio's own signature scheme (validateTwilioSignature above)
 * doesn't apply. A shared bearer secret set as VOICE_AGENT_CALLBACK_SECRET
 * on both services, checked on top of the per-business twilioSecret
 * already in the URL path — both have to be known to inject a fake
 * transcript. Fails closed (returns false) if the secret was never
 * configured, rather than accepting every request.
 */
export function validateVoiceAgentCallbackAuth(request: Request): boolean {
  const expected = process.env.VOICE_AGENT_CALLBACK_SECRET;
  if (!expected) {
    recordAuthFailure("voice_agent_callback", { reason: "not_configured" });
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  const valid = a.length === b.length && timingSafeEqual(a, b);
  if (!valid) recordAuthFailure("voice_agent_callback", { reason: "bad_token" });
  return valid;
}

/**
 * One authenticated call to Twilio's REST API on behalf of a business —
 * the same Basic-auth shape sendSms()/sendWhatsApp() already use, factored
 * out now that number configuration and call-log reads need it too. Throws
 * with Twilio's own message on a non-2xx so callers can surface it as-is.
 */
async function twilioApi(
  accountSid: string,
  authToken: string,
  path: string,
  init?: { method?: "GET" | "POST"; form?: Record<string, string> }
): Promise<Record<string, unknown>> {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const url = path.startsWith("https://") ? path : `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`;
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init?.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init?.form ? new URLSearchParams(init.form).toString() : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.message === "string" ? data.message : `Twilio API error ${res.status}`);
  }
  return data;
}

export type TwilioNumberConfig = {
  sid: string;
  phoneNumber: string;
  voiceUrl: string;
  voiceMethod: string;
  smsUrl: string;
  smsMethod: string;
  voiceCapable: boolean;
  smsCapable: boolean;
};

/**
 * What Twilio currently has configured on this business's number — the
 * "A call comes in" / "A message comes in" webhooks a user would otherwise
 * have to read off the Twilio Console. Null if the number isn't in this
 * account at all (wrong Account SID, or a number typed with a typo).
 */
export async function getTwilioNumberConfig(
  accountSid: string,
  authToken: string,
  phoneNumber: string
): Promise<TwilioNumberConfig | null> {
  const data = await twilioApi(accountSid, authToken, `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`);
  const numbers = data.incoming_phone_numbers as Array<Record<string, unknown>> | undefined;
  const n = numbers?.[0];
  if (!n) return null;
  const caps = (n.capabilities ?? {}) as Record<string, unknown>;
  return {
    sid: String(n.sid),
    phoneNumber: String(n.phone_number ?? phoneNumber),
    voiceUrl: typeof n.voice_url === "string" ? n.voice_url : "",
    voiceMethod: typeof n.voice_method === "string" ? n.voice_method : "",
    smsUrl: typeof n.sms_url === "string" ? n.sms_url : "",
    smsMethod: typeof n.sms_method === "string" ? n.sms_method : "",
    voiceCapable: !!caps.voice,
    smsCapable: !!caps.sms,
  };
}

/**
 * Points the number's inbound webhooks at FollowUp — the exact edit a user
 * would otherwise make by hand in Twilio Console → Phone Numbers → the
 * number → Voice/Messaging Configuration. Exists because that console
 * page is hidden behind an "upgrade your account" wall on trial accounts,
 * and because pasting two URLs by hand was the single most error-prone
 * step of connecting a number (a `www.` or an old domain silently fails
 * the signature check on every call).
 */
export async function setTwilioNumberWebhooks(
  accountSid: string,
  authToken: string,
  numberSid: string,
  urls: { voiceUrl: string; smsUrl: string }
): Promise<void> {
  await twilioApi(accountSid, authToken, `/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "POST",
    form: { VoiceUrl: urls.voiceUrl, VoiceMethod: "POST", SmsUrl: urls.smsUrl, SmsMethod: "POST" },
  });
}

export type TwilioRecentCall = {
  sid: string;
  from: string;
  status: string;
  direction: string;
  durationSeconds: number;
  startTime: string | null;
  error: string | null;
};

/**
 * The last few inbound calls to this number, each joined to any Twilio
 * error/warning notification raised for it (the "11200 HTTP retrieval
 * failure" / "13224" style codes the Console shows in red) — so a failed
 * test call can be diagnosed from inside FollowUp without the Console.
 */
export async function listRecentTwilioCalls(
  accountSid: string,
  authToken: string,
  phoneNumber: string,
  limit = 5
): Promise<TwilioRecentCall[]> {
  const callsData = await twilioApi(accountSid, authToken, `/Calls.json?To=${encodeURIComponent(phoneNumber)}&PageSize=${limit}`);

  // Error lookups are best-effort on purpose: the Monitor Alerts API is
  // the current home for these, the legacy /Notifications resource is
  // gone on newer accounts (a 404 from it was the first thing a real
  // account hit here), and neither should ever stop the call list itself
  // from rendering.
  const errorByCall = new Map<string, string>();
  const remember = (callSid: unknown, code: unknown, text: unknown) => {
    if (typeof callSid !== "string" || errorByCall.has(callSid)) return;
    let msg = typeof text === "string" ? text : "";
    const msgMatch = /(?:^|&)Msg=([^&]*)/.exec(msg);
    if (msgMatch) msg = decodeURIComponent(msgMatch[1].replace(/\+/g, " "));
    errorByCall.set(callSid, [code ? String(code) : "", msg].filter(Boolean).join(" — "));
  };
  try {
    const alerts = await twilioApi(accountSid, authToken, "https://monitor.twilio.com/v1/Alerts?PageSize=50");
    for (const a of (alerts.alerts as Array<Record<string, unknown>> | undefined) ?? []) {
      remember(a.resource_sid, a.error_code, a.alert_text);
    }
  } catch {
    try {
      const legacy = await twilioApi(accountSid, authToken, "/Notifications.json?PageSize=50");
      for (const n of (legacy.notifications as Array<Record<string, unknown>> | undefined) ?? []) {
        remember(n.call_sid, n.error_code, n.message_text);
      }
    } catch {
      // No error detail available for this account — the calls still list.
    }
  }

  return (((callsData.calls as Array<Record<string, unknown>> | undefined) ?? []).map((c) => ({
    sid: String(c.sid),
    from: typeof c.from === "string" ? c.from : "",
    status: typeof c.status === "string" ? c.status : "",
    direction: typeof c.direction === "string" ? c.direction : "",
    durationSeconds: Number(c.duration ?? 0),
    startTime: typeof c.start_time === "string" ? c.start_time : null,
    error: errorByCall.get(String(c.sid)) ?? null,
  })));
}

/** application/xml TwiML response — Twilio requires this content type for both SMS and Voice webhook replies. */
export function twiml(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

/**
 * isOptOutMessage / isOptInMessage MOVED to src/lib/optOutKeywords.ts.
 *
 * They were never Twilio-specific — they are the app's own record of a
 * lead's consent — and they now serve four channels: SMS and WhatsApp
 * (src/lib/inbound/twilioMessage.ts), Instagram and Messenger DMs
 * (src/lib/inbound/meta.ts), plus the instant acknowledgement's
 * don't-be-cheerful-at-a-STOP gate (src/lib/acknowledge.ts). Keeping the
 * one matcher in a zero-dependency leaf module is what stops a second,
 * subtly different copy appearing for the DM channels.
 */

/**
 * Sends a real outbound SMS via Twilio's REST API — the reverse of
 * everything else in this file, which only ever receives. Called from
 * src/lib/sending.ts as the fallback for a lead that has a phone but no
 * email. No `twilio` npm package here either: this is one plain
 * form-encoded POST with HTTP Basic Auth (Account SID as the username,
 * Auth Token as the password — Twilio's own REST API convention), not
 * worth a dependency for.
 */
export async function sendSms(
  businessId: string,
  to: string,
  body: string
  // `status` is Twilio's own HTTP status on a failure, passed through
  // deliberately: src/lib/sending.ts classifies a failed send as transient or
  // permanent, and a 503 and a 400 both arrive here as prose ("Twilio
  // rejected this message"). Without the number, an outage was
  // indistinguishable from a bad phone number and the message was dropped
  // rather than retried.
): Promise<{ success: boolean; message?: string; sid?: string; status?: number }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { twilioAccountSid: true, twilioAuthToken: true, twilioPhoneNumber: true, twilioSecret: true },
  });
  if (!business?.twilioAccountSid || !business.twilioAuthToken || !business.twilioPhoneNumber) {
    // Points at wherever the owner can actually go. CARRIER_CHANNELS_-
    // AVAILABLE hides the Phone panel, so telling them to check a page
    // that is not in their Settings sends them looking for something
    // that does not exist — the one thing an error message must never do.
    return {
      success: false,
      message: CARRIER_CHANNELS_AVAILABLE
        ? "Twilio isn't fully connected yet — check Settings → Phone (SMS + calls)."
        : "Text messages aren't switched on for this account yet, so this one couldn't go out. Email and the DM channels still work.",
    };
  }

  const params = new URLSearchParams({ To: to, From: business.twilioPhoneNumber, Body: body });
  if (business.twilioSecret) params.set("StatusCallback", statusCallbackUrl(business.twilioSecret));
  const auth = Buffer.from(`${business.twilioAccountSid}:${business.twilioAuthToken}`).toString("base64");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${business.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      success: false,
      message: typeof data.message === "string" ? data.message : "Twilio rejected this message.",
      status: res.status,
    };
  }
  return { success: true, sid: typeof data.sid === "string" ? data.sid : undefined };
}

/**
 * Sends a real outbound WhatsApp message via the same Twilio Messages
 * API as sendSms() above, just with the `whatsapp:` scheme prefixed onto
 * both numbers per Twilio's WhatsApp API — see
 * research/integrations/2026-09-06-whatsapp-business-production-readiness.md
 * for why this path (Twilio, not direct Meta Cloud API) was chosen: no
 * Meta App Review needed, same Account SID/Auth Token already saved for
 * SMS/voice, and it reuses this exact request shape almost verbatim.
 *
 * WhatsApp only allows free-form text within 24 hours of the lead's last
 * inbound message — Twilio surfaces a reply outside that window as error
 * 63016. When the business has approved a template (Business.whatsapp
 * TemplateSid — see schema.prisma for how that gets there), this retries
 * the send via Twilio's Content API instead of giving up: ContentSid +
 * ContentVariables {"1": leadFirstName} in place of Body, substituting the
 * lead's first name into the template's one approved placeholder. No
 * template configured still falls back to the old behavior — an honest
 * explanation instead of a generic "Twilio rejected this," so the caller
 * (src/lib/sending.ts) can fall back to text/email.
 */
export async function sendWhatsApp(
  businessId: string,
  to: string,
  body: string,
  options: { leadFirstName?: string } = {}
  // See sendSms above for why `status` is passed through on a failure.
  //
  // `sentTemplate` mirrors the Cloud API sender (src/lib/whatsappCloud.ts):
  // set ONLY when the approved template went out INSTEAD of `body`,
  // because the 24-hour window had closed. Without it the caller cannot
  // tell a real send from a substitution and records the undelivered
  // draft as the outbound message — the owner then reads a personal reply
  // in their thread that the lead never saw. Fixed on the Cloud path
  // 2026-09-20; this is the same bug on the older Twilio path.
): Promise<{ success: boolean; message?: string; sid?: string; status?: number; sentTemplate?: string }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      twilioAccountSid: true,
      twilioAuthToken: true,
      whatsappPhoneNumber: true,
      whatsappTemplateSid: true,
      twilioSecret: true,
    },
  });
  if (!business?.twilioAccountSid || !business.twilioAuthToken || !business.whatsappPhoneNumber) {
    // This is the LEGACY Twilio WhatsApp path; its fields are edited in
    // the Phone panel, which CARRIER_CHANNELS_AVAILABLE now hides. The
    // live way to connect WhatsApp is Settings → WhatsApp (Meta's Cloud
    // API, src/lib/whatsappCloud.ts), so that is where this points —
    // "Settings → Phone (SMS + calls)" named a panel that is not on the
    // page and a path nobody should be set up on any more.
    return { success: false, message: "WhatsApp isn't fully connected yet — connect it in Settings → WhatsApp." };
  }

  const auth = Buffer.from(`${business.twilioAccountSid}:${business.twilioAuthToken}`).toString("base64");
  const messagesUrl = `https://api.twilio.com/2010-04-01/Accounts/${business.twilioAccountSid}/Messages.json`;
  const statusCallback = business.twilioSecret ? statusCallbackUrl(business.twilioSecret) : undefined;

  const send = (params: URLSearchParams) => {
    if (statusCallback) params.set("StatusCallback", statusCallback);
    return fetch(messagesUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  };

  const res = await send(
    new URLSearchParams({
      To: `whatsapp:${to}`,
      From: `whatsapp:${business.whatsappPhoneNumber}`,
      Body: body,
    })
  );
  const data = await res.json().catch(() => ({}));

  if (res.ok) return { success: true, sid: typeof data.sid === "string" ? data.sid : undefined };

  if (data.code === 63016) {
    if (!business.whatsappTemplateSid) {
      return {
        success: false,
        message:
          // Same correction as above: the panel this named is hidden, and
          // "try replying by text" offered a channel the same flag turns
          // off. What is left that actually works is email, and the one
          // thing that genuinely reopens WhatsApp is the lead writing in.
          "This WhatsApp conversation is more than 24 hours old, and WhatsApp only allows a pre-approved template after that — none is set up on this account. They'll need to message you again to reopen the window; until then, email is the way to reach them.",
      };
    }

    const templateRes = await send(
      new URLSearchParams({
        To: `whatsapp:${to}`,
        From: `whatsapp:${business.whatsappPhoneNumber}`,
        ContentSid: business.whatsappTemplateSid,
        ContentVariables: JSON.stringify({ "1": options.leadFirstName ?? "there" }),
      })
    );
    const templateData = await templateRes.json().catch(() => ({}));
    if (!templateRes.ok) {
      return {
        success: false,
        message:
          typeof templateData.message === "string"
            ? `The WhatsApp template send was rejected: ${templateData.message}`
            : "Twilio rejected the WhatsApp template send.",
        status: templateRes.status,
      };
    }
    return {
      success: true,
      sid: typeof templateData.sid === "string" ? templateData.sid : undefined,
      // Twilio identifies a template by its Content SID; that is the only
      // name we hold for it, so that is what the record names. Meta's
      // side has a human template name — neither invents the body text.
      sentTemplate: business.whatsappTemplateSid,
    };
  }

  return {
    success: false,
    message: typeof data.message === "string" ? data.message : "Twilio rejected this message.",
    status: res.status,
  };
}
