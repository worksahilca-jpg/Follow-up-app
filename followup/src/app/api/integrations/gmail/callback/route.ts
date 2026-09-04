import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/callback — Google redirects here after the
// user approves (or denies) the consent screen. This URL must exactly match
// an "Authorized redirect URI" on the OAuth client in Google Cloud Console.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  // Echoed back verbatim from the `state` we sent in startGmailOAuth() —
  // the only signal for whether this round trip started from onboarding
  // or from Settings, since the whole detour through Google's consent
  // screen loses any client-side page state.
  const returnTo = new URL(searchParams.get("state") === "onboarding" ? "/onboarding" : "/settings", request.url);

  if (oauthError) {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", oauthError);
    return NextResponse.redirect(returnTo);
  }
  if (!code) {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", "No authorization code returned by Google.");
    return NextResponse.redirect(returnTo);
  }

  try {
    const { email } = await exchangeCodeForTokens(code, ctx.userId);
    returnTo.searchParams.set("gmail", "connected");
    returnTo.searchParams.set("email", email);
  } catch (err) {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", err instanceof Error ? err.message : "Gmail connection failed.");
  }

  return NextResponse.redirect(returnTo);
}
