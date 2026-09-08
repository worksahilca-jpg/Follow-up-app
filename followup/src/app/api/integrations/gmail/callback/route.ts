import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { ensureGmailWatch, exchangeCodeForTokens } from "@/lib/integrations/gmail";
import { recordAudit } from "@/lib/audit";

// GET /api/integrations/gmail/callback — Google redirects here after the
// user approves (or denies) the consent screen. This URL must exactly match
// an "Authorized redirect URI" on the OAuth client in Google Cloud Console.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("gmail_oauth_state")?.value;
  // Set in its own cookie by the connect route (see that file) — no longer
  // trusted from `state` itself, which is now a pure CSRF token actually
  // checked below (research/audit/2026-09-08-newer-surface-audit.md
  // finding #4).
  const next = request.cookies.get("gmail_oauth_next")?.value;
  const returnTo = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);

  const fail = (message: string) => {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", message);
    const res = NextResponse.redirect(returnTo);
    res.cookies.delete("gmail_oauth_state");
    res.cookies.delete("gmail_oauth_next");
    return res;
  };

  if (oauthError) return fail(oauthError);
  if (!code) return fail("No authorization code returned by Google.");
  if (!state || !expectedState || state !== expectedState) return fail("That sign-in link expired — try connecting again.");

  let res: NextResponse;
  try {
    const { email } = await exchangeCodeForTokens(code, ctx.userId);
    void recordAudit(ctx, "integration.gmail.connect");
    // Best-effort: push is an accelerator, the poll still works without it.
    await ensureGmailWatch(ctx.businessId).catch(() => null);
    returnTo.searchParams.set("gmail", "connected");
    returnTo.searchParams.set("email", email);
    res = NextResponse.redirect(returnTo);
  } catch (err) {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", err instanceof Error ? err.message : "Gmail connection failed.");
    res = NextResponse.redirect(returnTo);
  }

  res.cookies.delete("gmail_oauth_state");
  res.cookies.delete("gmail_oauth_next");
  return res;
}
