import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { OAUTH_COOKIE_OPTS, oauthNextCookie, oauthReturnUrl } from "@/lib/oauthReturn";
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
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", appUrl()));

  // Where to land afterwards — Settings, or back in the onboarding flow the
  // owner pressed Connect from. Carried in a cookie rather than OAuth
  // `state`, which stays a pure CSRF token (same reasoning as the Gmail
  // connect route). Every failure path below honours it too: being told
  // "only an admin can do this" on a page you never opened is worse than
  // the refusal itself.
  const next = new URL(request.url).searchParams.get("next") ?? undefined;
  const fail = (message: string) => {
    const url = oauthReturnUrl(next, "social", appUrl());
    url.searchParams.set("instagram", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  if (!(await requireAdmin(ctx))) return fail("Only an admin can connect Instagram");
  if (!instagramOAuthAvailable()) return fail("Instagram sign-in isn't set up yet");

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${appUrl()}/api/instagram/oauth/callback`;
  const res = NextResponse.redirect(buildInstagramAuthUrl(redirectUri, state));
  res.cookies.set("ig_oauth_state", state, OAUTH_COOKIE_OPTS);
  if (next) res.cookies.set(oauthNextCookie("ig"), next, OAUTH_COOKIE_OPTS);
  return res;
}
