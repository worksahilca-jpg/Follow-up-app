import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { OAUTH_COOKIE_OPTS, oauthNextCookie, oauthReturnUrl } from "@/lib/oauthReturn";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { appUrl } from "@/lib/stripe";
import { buildFacebookAuthUrl, facebookOAuthAvailable } from "@/lib/facebook";

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", appUrl()));

  // Settings, or back into the onboarding step Connect was pressed from.
  // Not cosmetic: during onboarding the (app) layout redirects anyone whose
  // business isn't onboarded straight back to /onboarding, so a callback
  // aimed at /settings would bounce there carrying no message at all — the
  // owner would see the step again with no sign of what happened.
  const next = new URL(request.url).searchParams.get("next") ?? undefined;
  const fail = (message: string) => {
    const url = oauthReturnUrl(next, "social", appUrl());
    url.searchParams.set("facebook", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  };

  if (!(await requireAdmin(ctx))) return fail("Only an admin can connect Facebook");
  if (!facebookOAuthAvailable()) return fail("Facebook sign-in isn't set up yet");

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${appUrl()}/api/facebook/oauth/callback`;
  const res = NextResponse.redirect(buildFacebookAuthUrl(redirectUri, state));
  res.cookies.set("fb_oauth_state", state, OAUTH_COOKIE_OPTS);
  if (next) res.cookies.set(oauthNextCookie("fb"), next, OAUTH_COOKIE_OPTS);
  return res;
}
