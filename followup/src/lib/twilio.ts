import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { pickAssignee } from "@/lib/assignment";
import { appUrl } from "@/lib/stripe";
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
export async function findBusinessByTwilioSecret(
  secret: string
): Promise<{ id: string; twilioAuthToken: string | null } | null> {
  return prisma.business.findUnique({
    where: { twilioSecret: secret },
    select: { id: true, twilioAuthToken: true },
  });
}

/**
 * Phone numbers have no unique DB constraint (unlike email's
 * businessId_email), so this is a manual find-or-create rather than a
 * Prisma upsert — an SMS and a later call from the same number should
 * become one lead, not two.
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
  return prisma.lead.create({
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
