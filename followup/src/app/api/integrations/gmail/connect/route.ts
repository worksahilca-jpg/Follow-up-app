import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { startGmailOAuth } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/connect — kicks off the Google OAuth consent
// screen. Linked from the "Connect" button on Settings, and from the
// "Connect Gmail" step of onboarding (which passes ?next=onboarding so the
// callback route knows to send the user back there instead of Settings).
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));

  const next = new URL(request.url).searchParams.get("next") ?? undefined;

  try {
    const { redirectUrl } = await startGmailOAuth(next);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Gmail OAuth";
    const url = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);
    url.searchParams.set("gmail", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
