import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { facebookOAuthAvailable, resolveFacebookPage } from "@/lib/facebook";
import { WEBHOOK_VERIFY_TOKEN } from "@/lib/instagram";
import { appUrl } from "@/lib/stripe";
import { recordAudit } from "@/lib/audit";

// Facebook Page (Messenger + Lead Ads) — see src/lib/facebook.ts. Same
// shape as the Instagram config: paste a Page access token, the Page is
// resolved from it. Token is write-only and encrypted at rest.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { facebookPageId: true, facebookPageName: true, facebookPageAccessToken: true },
  });
  return NextResponse.json({
    success: true,
    connected: !!business?.facebookPageAccessToken,
    pageId: business?.facebookPageId ?? null,
    pageName: business?.facebookPageName ?? null,
    webhookUrl: `${appUrl()}/api/instagram/webhook`,
    verifyToken: WEBHOOK_VERIFY_TOKEN,
    oauthAvailable: facebookOAuthAvailable(),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const token = typeof body.accessToken === "string" ? body.accessToken.trim() : "";
  if (!token) return NextResponse.json({ success: false, message: "Paste a real Page access token." }, { status: 400 });
  const page = await resolveFacebookPage(token);
  if (!page) {
    return NextResponse.json({ success: false, message: "That token didn't work — make sure it's a Page access token, not a user token." }, { status: 400 });
  }
  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: { facebookPageAccessToken: token, facebookPageId: page.id, facebookPageName: page.name ?? null },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: false, message: "That Facebook Page is already connected to another FollowUp account." }, { status: 409 });
    }
    throw err;
  }
  void recordAudit(ctx, "integration.facebook.update", { meta: { pageId: page.id } });
  return NextResponse.json({ success: true, pageId: page.id, pageName: page.name ?? null });
}

export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { facebookPageAccessToken: null, facebookPageId: null, facebookPageName: null },
  });
  void recordAudit(ctx, "integration.facebook.disconnect");
  return NextResponse.json({ success: true });
}
