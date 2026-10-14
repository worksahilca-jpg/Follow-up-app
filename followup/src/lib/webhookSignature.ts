import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signed lead events (A-252). Every event FollowUp sends to a business's own
 * webhook (src/lib/outboundWebhook.ts) carries a signature made with a secret
 * only that business and FollowUp know, so the app receiving it (Zapier,
 * Make, their own server) can check it really came from FollowUp and wasn't
 * changed on the way. Without it, anyone who learned the URL could post fake
 * "new customer" events into the owner's tools.
 *
 * The header, the common scheme Stripe and others use:
 *
 *   X-FollowUp-Signature: t=1760464800,v1=<hex HMAC-SHA256 of "1760464800.<raw body>">
 *
 * The time is inside what's signed, so an old event can't be replayed as new:
 * a receiver checks the signature and that `t` is recent (five minutes).
 */

export const SIGNATURE_HEADER = "X-FollowUp-Signature";
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/** A new secret for one business: 32 random bytes, prefixed so it reads as what it is. */
export function newWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

function hmac(secret: string, t: number, body: string): string {
  return createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
}

/** The header value for this exact body, signed now. */
export function signatureHeader(secret: string, body: string, now: number = Date.now()): string {
  const t = Math.floor(now / 1000);
  return `t=${t},v1=${hmac(secret, t, body)}`;
}

/**
 * What a receiver does, here so the scheme has one tested description (and
 * for FollowUp's own tests): the signature matches this body and secret, and
 * it was made within the last five minutes.
 */
export function verifySignature(secret: string, body: string, header: string | null, now: number = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || !parts.v1) return false;
  if (Math.abs(Math.floor(now / 1000) - t) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = Buffer.from(hmac(secret, t, body), "hex");
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
