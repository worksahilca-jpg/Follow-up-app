import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { buildOutlookAuthUrl } from "@/lib/integrations/outlook";

// GET /api/integrations/outlook/connect — kicks off the Microsoft
// identity-platform consent screen. Linked from the "Connect" button on
// Settings. Mirrors /api/integrations/gmail/connect exactly, including its
// CSRF `state` fix (research/audit/2026-09-08-newer-surface-audit.md
// finding #4): `state` is a random token checked back on the callback,
// `next` (onboarding vs. Settings) travels in its own cookie instead.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));
  if (!(await requireAdmin(ctx))) return NextResponse.redirect(new URL("/settings?outlook=error&message=Only+an+admin+can+connect+Outlook", request.url));

  const next = new URL(request.url).searchParams.get("next") ?? undefined;
  const state = randomBytes(24).toString("base64url");

  try {
    const redirectUrl = buildOutlookAuthUrl(state);
    const res = NextResponse.redirect(redirectUrl);
    const cookieOpts = { httpOnly: true, secure: true, sameSite: "lax" as const, maxAge: 600, path: "/" };
    res.cookies.set("outlook_oauth_state", state, cookieOpts);
    if (next) res.cookies.set("outlook_oauth_next", next, cookieOpts);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Outlook sign-in";
    const url = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);
    url.searchParams.set("outlook", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
