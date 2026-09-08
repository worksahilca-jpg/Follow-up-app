import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { appUrl } from "@/lib/stripe";
import { buildFacebookAuthUrl, facebookOAuthAvailable } from "@/lib/facebook";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", appUrl()));
  if (!(await requireAdmin(ctx))) {
    return NextResponse.redirect(`${appUrl()}/settings?facebook=error&message=Only+an+admin+can+connect+Facebook`);
  }
  if (!facebookOAuthAvailable()) {
    return NextResponse.redirect(`${appUrl()}/settings?facebook=error&message=Facebook+sign-in+isn't+set+up+yet`);
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${appUrl()}/api/facebook/oauth/callback`;
  const res = NextResponse.redirect(buildFacebookAuthUrl(redirectUri, state));
  res.cookies.set("fb_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
