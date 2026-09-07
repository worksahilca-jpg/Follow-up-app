import { NextRequest, NextResponse, after } from "next/server";
import { findBusinessIdByGmailAddress } from "@/lib/integrations/gmail";
import { syncGmailForBusinessFromPush } from "@/lib/gmailSync";

export const maxDuration = 120;

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
  const secret = process.env.GMAIL_PUSH_SECRET;
  if (!secret) return NextResponse.json({ success: false }, { status: 404 });
  if (request.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const data: string | undefined = payload?.message?.data;
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
