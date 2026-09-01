import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/callback — Google redirects here after the
// user approves (or denies) the consent screen. This URL must exactly match
// an "Authorized redirect URI" on the OAuth client in Google Cloud Console.
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(new URL("/signin", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");

  const settingsUrl = new URL("/settings", request.url);

  if (oauthError) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("message", oauthError);
    return NextResponse.redirect(settingsUrl);
  }
  if (!code) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("message", "No authorization code returned by Google.");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    const { email } = await exchangeCodeForTokens(code);
    settingsUrl.searchParams.set("gmail", "connected");
    settingsUrl.searchParams.set("email", email);
  } catch (err) {
    settingsUrl.searchParams.set("gmail", "error");
    settingsUrl.searchParams.set("message", err instanceof Error ? err.message : "Gmail connection failed.");
  }

  return NextResponse.redirect(settingsUrl);
}
