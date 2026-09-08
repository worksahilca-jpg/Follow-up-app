import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { exchangeOutlookAuthCode } from "@/lib/integrations/outlook";
import { recordAudit } from "@/lib/audit";

// GET /api/integrations/outlook/callback — Microsoft redirects here after
// the user approves (or denies) consent. This URL must exactly match a
// "Redirect URI" registered on the app in Azure AD / Entra ID. Mirrors
// /api/integrations/gmail/callback.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  // Echoed back verbatim from the `state` we sent in buildOutlookAuthUrl().
  const returnTo = new URL(searchParams.get("state") === "onboarding" ? "/onboarding" : "/settings", request.url);

  if (oauthError) {
    returnTo.searchParams.set("outlook", "error");
    returnTo.searchParams.set("message", oauthError);
    return NextResponse.redirect(returnTo);
  }
  if (!code) {
    returnTo.searchParams.set("outlook", "error");
    returnTo.searchParams.set("message", "No authorization code returned by Microsoft.");
    return NextResponse.redirect(returnTo);
  }

  try {
    const { email } = await exchangeOutlookAuthCode(code, ctx.userId);
    void recordAudit(ctx, "integration.outlook.connect");
    returnTo.searchParams.set("outlook", "connected");
    returnTo.searchParams.set("email", email);
  } catch (err) {
    returnTo.searchParams.set("outlook", "error");
    returnTo.searchParams.set("message", err instanceof Error ? err.message : "Outlook connection failed.");
  }

  return NextResponse.redirect(returnTo);
}
