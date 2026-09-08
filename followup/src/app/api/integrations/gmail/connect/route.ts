import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { startGmailOAuth } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/connect — kicks off the Google OAuth consent
// screen. Linked from the "Connect" button on Settings, and from the
// "Connect Gmail" step of onboarding (which passes ?next=onboarding so the
// callback route knows to send the user back there instead of Settings).
//
// `state` is a random CSRF token, checked back on the callback (same
// pattern as the Instagram/Facebook Connect flows — see e.g.
// src/app/api/instagram/oauth/start/route.ts) — fixes
// research/audit/2026-09-08-newer-surface-audit.md finding #4. `next`
// travels in its own cookie now instead of riding as `state` unchecked.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));
  if (!(await requireAdmin(ctx))) return NextResponse.redirect(new URL("/settings?gmail=error&message=Only+an+admin+can+connect+Gmail", request.url));

  const next = new URL(request.url).searchParams.get("next") ?? undefined;
  const state = randomBytes(24).toString("base64url");

  try {
    const { redirectUrl } = await startGmailOAuth(state);
    const res = NextResponse.redirect(redirectUrl);
    const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
    res.cookies.set("gmail_oauth_state", state, cookieOpts);
    if (next) res.cookies.set("gmail_oauth_next", next, cookieOpts);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Gmail OAuth";
    const url = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);
    url.searchParams.set("gmail", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
