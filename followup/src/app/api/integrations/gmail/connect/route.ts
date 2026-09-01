import { NextRequest, NextResponse } from "next/server";
import { startGmailOAuth } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/connect — kicks off the Google OAuth consent
// screen. Linked from the "Connect" button on Settings.
export async function GET(request: NextRequest) {
  try {
    const { redirectUrl } = await startGmailOAuth();
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Gmail OAuth";
    const url = new URL("/settings", request.url);
    url.searchParams.set("gmail", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
