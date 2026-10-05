import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { findBusinessIdByGmailAddress } from "@/lib/integrations/gmail";
import { syncGmailForBusinessFromPush } from "@/lib/gmailSync";
import { recordAuthFailure } from "@/lib/monitoring";
import { google } from "googleapis";

// Constant-time, matching every other shared-secret check in this codebase
// (Twilio's signature, the cron secret, the unsubscribe token) — a plain
// `!==` against a query-string secret is a timing side-channel an attacker
// can probe by request volume alone. Length-checked first since
// timingSafeEqual throws on a length mismatch rather than returning false.
function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Google's own Pub/Sub push envelope — https://cloud.google.com/pubsub/docs/push.
// Loosely typed on purpose: only `message.data` is ever read, and this
// endpoint already treats anything it doesn't recognize as a no-op 204
// (see the doc comment below) rather than an error, so validation here
// only needs to safely narrow the shape, not reject the rest of it.
const pubSubPushSchema = z.object({
  message: z.object({ data: z.string().optional() }).optional(),
});

export const maxDuration = 120;

/**
 * Google's signed push token (security review L8, 2026-10-05). With authentication turned on
 * for the Pub/Sub subscription, Google signs every push with a short-lived token in the
 * Authorization header, so no secret has to sit in the URL (where request logs keep it).
 * Turned on by setting GMAIL_PUSH_AUDIENCE (the audience typed into the subscription) and
 * GMAIL_PUSH_SERVICE_ACCOUNT (the service account it signs as); see docs/gmail-push-setup.md.
 * While they are unset, the URL secret below is still the check.
 */
async function validGooglePushToken(authorization: string | null, audience: string, serviceAccount: string): Promise<boolean> {
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!idToken) return false;
  try {
    const ticket = await new google.auth.OAuth2().verifyIdToken({ idToken, audience });
    const claims = ticket.getPayload();
    return !!claims && claims.email === serviceAccount && claims.email_verified === true;
  } catch {
    return false;
  }
}

/**
 * POST /api/integrations/gmail/push?secret=GMAIL_PUSH_SECRET — the Pub/Sub
 * push subscription endpoint for Gmail watch notifications (see
 * ensureGmailWatch in src/lib/integrations/gmail.ts and
 * docs/gmail-push-setup.md). Google POSTs
 * { message: { data: base64({ emailAddress, historyId }) } } the moment a
 * watched inbox changes.
 *
 * Responds 204 immediately and does the sync in `after()` — Pub/Sub's ack
 * deadline is ten seconds and a sync can take a minute; a slow response
 * would just be redelivered. Anything unrecognised is also a 204: a
 * non-2xx makes Pub/Sub retry forever, and there is nothing to retry.
 * Authentication is the shared secret in the URL, which only Google's
 * subscription config knows; a missing GMAIL_PUSH_SECRET disables the
 * endpoint entirely.
 */
export async function POST(request: NextRequest) {
  const audience = process.env.GMAIL_PUSH_AUDIENCE;
  const serviceAccount = process.env.GMAIL_PUSH_SERVICE_ACCOUNT;
  if (audience && serviceAccount) {
    // Signed push is on: only Google's token is accepted, the URL secret no longer is.
    if (!(await validGooglePushToken(request.headers.get("authorization"), audience, serviceAccount))) {
      recordAuthFailure("gmail_push_token");
      return NextResponse.json({ success: false }, { status: 403 });
    }
  } else {
    const secret = process.env.GMAIL_PUSH_SECRET;
    if (!secret) return NextResponse.json({ success: false }, { status: 404 });
    const provided = request.nextUrl.searchParams.get("secret");
    if (!provided || !secretsMatch(provided, secret)) {
      recordAuthFailure("gmail_push_secret");
      return NextResponse.json({ success: false }, { status: 403 });
    }
  }

  const rawPayload = await request.json().catch(() => null);
  const payload = pubSubPushSchema.safeParse(rawPayload);
  const data = payload.success ? payload.data.message?.data : undefined;
  if (!data) return new NextResponse(null, { status: 204 });

  let emailAddress: string | undefined;
  try {
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    emailAddress = typeof decoded?.emailAddress === "string" ? decoded.emailAddress : undefined;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!emailAddress) return new NextResponse(null, { status: 204 });

  const businessId = await findBusinessIdByGmailAddress(emailAddress);
  if (!businessId) return new NextResponse(null, { status: 204 });

  after(async () => {
    try {
      await syncGmailForBusinessFromPush(businessId);
    } catch (err) {
      console.error(`Push-triggered Gmail sync failed for business ${businessId}:`, err);
    }
  });

  return new NextResponse(null, { status: 204 });
}
