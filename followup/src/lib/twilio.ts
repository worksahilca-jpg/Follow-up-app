import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { appUrl } from "@/lib/stripe";
import { applySourceRouting } from "@/lib/sourceRouting";
import type { Lead } from "@prisma/client";

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
 * same one Settings generated via appUrl() (src/app/api/twilio/config).
 * `request.url` inside a Next.js route handler isn't reliably identical
 * byte-for-byte on every platform (proxy/protocol rewriting is a known,
 * silent source of signature-validation failures elsewhere), so every
 * caller reconstructs the canonical URL from appUrl() + the request's own
 * pathname instead of trusting request.url directly.
 */
export function canonicalRequestUrl(request: Request): string {
  return `${appUrl()}${new URL(request.url).pathname}`;
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
 * for. Also checks requireActiveBilling isn't needed here the way the
 * other inbound webhooks do it inline, since SMS/voice callers can't see
 * any error response anyway (Twilio just gets an empty TwiML reply either
 * way) — so callers check billing themselves and decide what TwiML to
 * return.
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
  source: string
): Promise<Lead> {
  const existing = await prisma.lead.findFirst({ where: { businessId, phone } });
  if (existing) {
    return prisma.lead.update({ where: { id: existing.id }, data: { lastContacted: new Date() } });
  }
  try {
    const lead = await prisma.lead.create({
      data: {
        businessId,
        name: phone,
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
 */
export async function claimMissedCallTextBack(leadId: string, cooldownMinutes: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMinutes * 60_000);
  const claim = await prisma.lead.updateMany({
    where: { id: leadId, OR: [{ lastMissedCallTextAt: null }, { lastMissedCallTextAt: { lt: since } }] },
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
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
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
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`, {
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
  const [callsData, alertsData] = await Promise.all([
    twilioApi(accountSid, authToken, `/Calls.json?To=${encodeURIComponent(phoneNumber)}&PageSize=${limit}`),
    twilioApi(accountSid, authToken, `/Notifications.json?PageSize=50`),
  ]);
  const errorByCall = new Map<string, string>();
  for (const n of (alertsData.notifications as Array<Record<string, unknown>> | undefined) ?? []) {
    const callSid = typeof n.call_sid === "string" ? n.call_sid : null;
    if (!callSid || errorByCall.has(callSid)) continue;
    const code = n.error_code ? String(n.error_code) : "";
    let text = typeof n.message_text === "string" ? n.message_text : "";
    // message_text is often a form-encoded bag like "Msg=...&url=..."; keep just the message.
    const msgMatch = /(?:^|&)Msg=([^&]*)/.exec(text);
    if (msgMatch) text = decodeURIComponent(msgMatch[1].replace(/\+/g, " "));
    errorByCall.set(callSid, [code, text].filter(Boolean).join(" — "));
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
): Promise<{ success: boolean; message?: string; sid?: string }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { twilioAccountSid: true, twilioAuthToken: true, twilioPhoneNumber: true },
  });
  if (!business?.twilioAccountSid || !business.twilioAuthToken || !business.twilioPhoneNumber) {
    return { success: false, message: "Twilio isn't fully connected yet — check Settings → Phone (SMS + calls)." };
  }

  const params = new URLSearchParams({ To: to, From: business.twilioPhoneNumber, Body: body });
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
    return { success: false, message: typeof data.message === "string" ? data.message : "Twilio rejected this message." };
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
 * Deliberately narrow, matching Phase 1's real scope: WhatsApp only
 * allows free-form text within 24 hours of the lead's last inbound
 * message — reaching them outside that window requires a pre-approved
 * message template, which isn't built yet. Twilio surfaces that case as
 * error 63016; this catches it specifically so the failure reads as an
 * honest explanation instead of a generic "Twilio rejected this."
 */
export async function sendWhatsApp(
  businessId: string,
  to: string,
  body: string
): Promise<{ success: boolean; message?: string; sid?: string }> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { twilioAccountSid: true, twilioAuthToken: true, whatsappPhoneNumber: true },
  });
  if (!business?.twilioAccountSid || !business.twilioAuthToken || !business.whatsappPhoneNumber) {
    return { success: false, message: "WhatsApp isn't fully connected yet — check Settings → Phone (SMS + calls)." };
  }

  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${business.whatsappPhoneNumber}`,
    Body: body,
  });
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
    if (data.code === 63016) {
      return {
        success: false,
        message:
          "This WhatsApp conversation is more than 24 hours old — WhatsApp requires a pre-approved message template to reach them now (not yet supported here). They'll need to message you again to reopen the window, or try replying by text or email instead.",
      };
    }
    return { success: false, message: typeof data.message === "string" ? data.message : "Twilio rejected this message." };
  }
  return { success: true, sid: typeof data.sid === "string" ? data.sid : undefined };
}
