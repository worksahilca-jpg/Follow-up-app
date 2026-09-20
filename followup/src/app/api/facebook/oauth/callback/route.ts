import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { activateFacebookPageWebhooks, exchangeFacebookAuthCode } from "@/lib/facebook";
import { encryptSecret } from "@/lib/crypto";
import { recordAudit } from "@/lib/audit";

/**
 * A person can be an admin on several Facebook Pages, but a business here
 * connects exactly one (Business.facebookPageId is unique). One Page:
 * save immediately. Several: stash the resolved list — already-derived
 * Page tokens, nothing left to exchange — in a short-lived, encrypted,
 * httpOnly cookie (10 min) and send the browser to a picker; see
 * /api/facebook/oauth/pending-pages and /select-page.
 */
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  const settingsUrl = new URL("/settings", appUrl());
  // Same as the Instagram callback: land on the Channels tab, where the
  // Facebook panel and its outcome message actually are.
  settingsUrl.hash = "social";
  if (!ctx) return NextResponse.redirect(new URL("/signin", appUrl()));
  if (!(await requireAdmin(ctx))) {
    settingsUrl.searchParams.set("facebook", "error");
    settingsUrl.searchParams.set("message", "Only an admin can connect Facebook");
    return NextResponse.redirect(settingsUrl);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  const expectedState = request.cookies.get("fb_oauth_state")?.value;

  const fail = (message: string) => {
    settingsUrl.searchParams.set("facebook", "error");
    settingsUrl.searchParams.set("message", message);
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete("fb_oauth_state");
    return res;
  };

  if (oauthError) return fail(oauthError);
  if (!code) return fail("No authorization code returned by Facebook.");
  if (!state || !expectedState || state !== expectedState) return fail("That sign-in link expired — try connecting again.");

  const redirectUri = `${appUrl()}/api/facebook/oauth/callback`;
  const exchanged = await exchangeFacebookAuthCode(code, redirectUri);
  if ("error" in exchanged) return fail(exchanged.error);

  if (exchanged.pages.length === 1) {
    const page = exchanged.pages[0];
    try {
      await prisma.business.update({
        where: { id: ctx.businessId },
        // Cleared, then set below only if Meta confirms — see the same
        // reasoning in /api/facebook/oauth/select-page.
        data: {
          facebookPageAccessToken: page.accessToken,
          facebookPageId: page.id,
          facebookPageName: page.name,
          facebookWebhookSubscribedAt: null,
        },
      });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        return fail("That Facebook Page is already connected to another FollowUp account.");
      }
      throw err;
    }
    // Without this Meta delivers no Messenger DM and no Lead Ad for the
    // Page (see subscribeFacebookPageWebhooks). Saved regardless; the
    // outcome lands in the audit row and in the column Settings reads,
    // so a silent Page can be explained rather than just being silent.
    const subscribed = await activateFacebookPageWebhooks(ctx.businessId, page.id, page.accessToken);
    void recordAudit(ctx, "integration.facebook.connect", {
      meta: {
        via: "oauth",
        pageId: page.id,
        webhookSubscribed: subscribed.ok,
        ...(subscribed.ok ? {} : { webhookError: subscribed.message }),
      },
    });
    settingsUrl.searchParams.set("facebook", "connected");
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete("fb_oauth_state");
    return res;
  }

  // Several Pages — encrypt the list (real access tokens inside) before
  // it ever touches a cookie, even an httpOnly one.
  const encrypted = encryptSecret(JSON.stringify(exchanged.pages));
  settingsUrl.searchParams.set("facebook", "choose_page");
  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("fb_oauth_state");
  res.cookies.set("fb_pending_pages", encrypted, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
