import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { activateFacebookPageWebhooks, facebookOAuthAvailable, resolveFacebookPage, unsubscribeFacebookPageWebhooks } from "@/lib/facebook";
import { WEBHOOK_VERIFY_TOKEN } from "@/lib/instagram";
import { inboundBaseUrl } from "@/lib/siteUrl";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

const accessTokenSchema = z.object({ accessToken: z.string().trim().min(1, "Paste a real Page access token.").max(4096) });

// Facebook Page (Messenger + Lead Ads) — see src/lib/facebook.ts. Same
// shape as the Instagram config: paste a Page access token, the Page is
// resolved from it. Token is write-only and encrypted at rest.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    // Deliberately NOT selecting the token. src/lib/db.ts decrypts it on
    // read, so asking for it here meant a real Page credential was
    // decrypted on every Settings page load to answer a yes/no question.
    // facebookPageId is set and cleared in the same writes as the token
    // (see POST and DELETE below), so it answers the same question without
    // touching the secret.
    select: {
      facebookPageId: true,
      facebookPageName: true,
      facebookWebhookSubscribedAt: true,
    },
  });
  return NextResponse.json({
    success: true,
    connected: !!business?.facebookPageId,
    // Connected is not the same question as receiving. A Page whose
    // subscription call never succeeded is saved, readable and completely
    // silent, so Settings asks both and says so.
    receiving: !!business?.facebookWebhookSubscribedAt,
    pageId: business?.facebookPageId ?? null,
    pageName: business?.facebookPageName ?? null,
    webhookUrl: `${inboundBaseUrl()}/api/instagram/webhook`,
    verifyToken: WEBHOOK_VERIFY_TOKEN,
    oauthAvailable: facebookOAuthAvailable(),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const parsed = await parseJsonBody(request, accessTokenSchema);
  if (!parsed.ok) return parsed.response;
  const token = parsed.data.accessToken;
  const page = await resolveFacebookPage(token);
  if (!page) {
    return NextResponse.json({ success: false, message: "That token didn't work — make sure it's a Page access token, not a user token." }, { status: 400 });
  }
  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      // Cleared, then set below only if Meta confirms — a new token is a
      // new subscription question, and the old answer does not carry over.
      data: {
        facebookPageAccessToken: token,
        facebookPageId: page.id,
        facebookPageName: page.name ?? null,
        facebookWebhookSubscribedAt: null,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ success: false, message: "That Facebook Page is already connected to another FollowUp account." }, { status: 409 });
    }
    throw err;
  }
  // Same per-Page subscription as the OAuth paths; a pasted Page token
  // carries the same permissions, so the same call applies.
  const subscribed = await activateFacebookPageWebhooks(ctx.businessId, page.id, token);
  void recordAudit(ctx, "integration.facebook.update", {
    meta: {
      pageId: page.id,
      webhookSubscribed: subscribed.ok,
      ...(subscribed.ok ? {} : { webhookError: subscribed.message }),
    },
  });
  return NextResponse.json({
    success: true,
    pageId: page.id,
    pageName: page.name ?? null,
    receiving: subscribed.ok,
  });
}

export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  // Tell Meta to stop FIRST — after the update there is no token left to
  // unsubscribe with, and Meta would go on delivering this Page's DMs and
  // Lead Ads to a webhook that can no longer route them (they land in
  // InboundWebhookEvent with businessId null and sit for up to 90 days).
  const b = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { facebookPageId: true, facebookPageAccessToken: true },
  });
  if (b?.facebookPageId && b.facebookPageAccessToken) {
    // Never lets Meta being unreachable strand someone in a connection
    // they asked to leave: the disconnect is the thing they requested,
    // and it must happen whatever Facebook does.
    try {
      await unsubscribeFacebookPageWebhooks(b.facebookPageId, b.facebookPageAccessToken);
    } catch (err) {
      console.error(`Facebook unsubscribe failed on disconnect for business ${ctx.businessId}:`, err);
    }
  }

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: {
      facebookPageAccessToken: null,
      facebookPageId: null,
      facebookPageName: null,
      facebookWebhookSubscribedAt: null,
    },
  });
  void recordAudit(ctx, "integration.facebook.disconnect");
  return NextResponse.json({ success: true });
}
