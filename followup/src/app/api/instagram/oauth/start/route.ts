import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { appUrl } from "@/lib/stripe";
import { buildInstagramAuthUrl, instagramOAuthAvailable } from "@/lib/instagram";

/**
 * GET /api/instagram/oauth/start — "Connect with Instagram" button target.
 * Admin-only (matches the manual-token POST route). Redirects to
 * Instagram's own authorize screen; the state cookie is checked back in
 * the callback to rule out a forged redirect landing on someone else's
 * signed-in session.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", appUrl()));
  if (!(await requireAdmin(ctx))) {
    return NextResponse.redirect(`${appUrl()}/settings?instagram=error&message=Only+an+admin+can+connect+Instagram`);
  }
  if (!instagramOAuthAvailable()) {
    return NextResponse.redirect(`${appUrl()}/settings?instagram=error&message=Instagram+sign-in+isn't+set+up+yet`);
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${appUrl()}/api/instagram/oauth/callback`;
  const res = NextResponse.redirect(buildInstagramAuthUrl(redirectUri, state));
  res.cookies.set("ig_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
