import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { exchangeOutlookAuthCode } from "@/lib/integrations/outlook";
import { recordAudit } from "@/lib/audit";

// GET /api/integrations/outlook/callback — Microsoft redirects here after
// the user approves (or denies) consent. This URL must exactly match a
// "Redirect URI" registered on the app in Azure AD / Entra ID. Mirrors
// /api/integrations/gmail/callback, including its CSRF `state` fix
// (research/audit/2026-09-08-newer-surface-audit.md finding #4).
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("outlook_oauth_state")?.value;
  // Set in its own cookie by the connect route — no longer trusted from
  // `state` itself, which is now a pure CSRF token actually checked below.
  const next = request.cookies.get("outlook_oauth_next")?.value;
  const returnTo = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);

  const fail = (message: string) => {
    returnTo.searchParams.set("outlook", "error");
    returnTo.searchParams.set("message", message);
    const res = NextResponse.redirect(returnTo);
    res.cookies.delete("outlook_oauth_state");
    res.cookies.delete("outlook_oauth_next");
    return res;
  };

  if (oauthError) return fail(oauthError);
  if (!code) return fail("No authorization code returned by Microsoft.");
  if (!state || !expectedState || state !== expectedState) return fail("That sign-in link expired — try connecting again.");

  let res: NextResponse;
  try {
    const { email } = await exchangeOutlookAuthCode(code, ctx.userId);
    void recordAudit(ctx, "integration.outlook.connect");
    returnTo.searchParams.set("outlook", "connected");
    returnTo.searchParams.set("email", email);
    res = NextResponse.redirect(returnTo);
  } catch (err) {
    returnTo.searchParams.set("outlook", "error");
    returnTo.searchParams.set("message", err instanceof Error ? err.message : "Outlook connection failed.");
    res = NextResponse.redirect(returnTo);
  }

  res.cookies.delete("outlook_oauth_state");
  res.cookies.delete("outlook_oauth_next");
  return res;
}
