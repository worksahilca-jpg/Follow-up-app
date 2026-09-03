import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";

/**
 * GET/POST /api/twilio/config — this business's Twilio setup: the two
 * webhook URLs to paste into the Twilio Console, and whether an Auth
 * Token is saved (never the token's value itself — see below).
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { twilioSecret: true, twilioAuthToken: true },
  });

  const secret = business?.twilioSecret ?? null;
  return NextResponse.json({
    success: true,
    smsUrl: secret ? `${appUrl()}/api/twilio/sms/${secret}` : null,
    voiceUrl: secret ? `${appUrl()}/api/twilio/voice/${secret}` : null,
    hasAuthToken: !!business?.twilioAuthToken,
  });
}

/**
 * POST { authToken? } — generates twilioSecret if it doesn't exist yet
 * (idempotent: calling this again without changing anything keeps the
 * same URLs, unlike the other webhook config routes, since regenerating
 * would silently break a live phone number's console config), and
 * saves/updates authToken if one is passed. The token is write-only —
 * GET never echoes it back, same treatment as a password, since it's
 * what actually authenticates inbound requests as really being from
 * Twilio.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const authToken = typeof body.authToken === "string" ? body.authToken.trim() : undefined;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { twilioSecret: true },
  });

  const secret = business?.twilioSecret ?? randomBytes(24).toString("base64url");
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      twilioSecret: secret,
      ...(authToken !== undefined ? { twilioAuthToken: authToken || null } : {}),
    },
  });

  return NextResponse.json({
    success: true,
    smsUrl: `${appUrl()}/api/twilio/sms/${secret}`,
    voiceUrl: `${appUrl()}/api/twilio/voice/${secret}`,
  });
}

/** DELETE — disconnect: clears both the secret and the auth token, so old Twilio config stops working. */
export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { twilioSecret: null, twilioAuthToken: null },
  });
  return NextResponse.json({ success: true });
}
