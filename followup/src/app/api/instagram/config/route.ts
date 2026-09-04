import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { resolveInstagramUserId, WEBHOOK_VERIFY_TOKEN } from "@/lib/instagram";
import { appUrl } from "@/lib/stripe";

/**
 * GET/POST/DELETE /api/instagram/config — this business's Instagram
 * connection. Unlike Twilio, there's no per-business URL to generate:
 * the webhook is app-wide (see src/app/api/instagram/webhook), so
 * Settings only ever needs a paste-the-token flow — the account ID gets
 * resolved automatically from the token via the Graph API rather than
 * asked for by hand.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { instagramUserId: true, instagramAccessToken: true },
  });

  return NextResponse.json({
    success: true,
    connected: !!business?.instagramAccessToken,
    instagramUserId: business?.instagramUserId ?? null,
    webhookUrl: `${appUrl()}/api/instagram/webhook`,
    verifyToken: WEBHOOK_VERIFY_TOKEN,
  });
}

/**
 * POST { accessToken } — validates the token by calling the Graph API's
 * own /me (also how the account's Instagram user ID gets resolved), then
 * saves both. Rejects up front with a clear message if the token doesn't
 * actually work, rather than saving something broken and failing silently
 * later when a real DM comes in.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!accessToken) {
    return NextResponse.json({ success: false, message: "Paste a real access token." }, { status: 400 });
  }

  const resolved = await resolveInstagramUserId(accessToken);
  if (!resolved) {
    return NextResponse.json(
      { success: false, message: "That token didn't work — double-check you copied the whole thing." },
      { status: 400 }
    );
  }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { instagramAccessToken: accessToken, instagramUserId: resolved.id },
  });

  return NextResponse.json({ success: true, instagramUserId: resolved.id, username: resolved.username ?? null });
}

/** DELETE — disconnect: clears the token and account ID. */
export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { instagramAccessToken: null, instagramUserId: null },
  });
  return NextResponse.json({ success: true });
}
