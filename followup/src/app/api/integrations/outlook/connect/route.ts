import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { buildOutlookAuthUrl } from "@/lib/integrations/outlook";

// GET /api/integrations/outlook/connect — kicks off the Microsoft
// identity-platform consent screen. Linked from the "Connect" button on
// Settings. Mirrors /api/integrations/gmail/connect exactly.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));
  if (!(await requireAdmin(ctx))) return NextResponse.redirect(new URL("/settings?outlook=error&message=Only+an+admin+can+connect+Outlook", request.url));

  const next = new URL(request.url).searchParams.get("next") ?? undefined;

  try {
    const redirectUrl = buildOutlookAuthUrl(next);
    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start Outlook sign-in";
    const url = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);
    url.searchParams.set("outlook", "error");
    url.searchParams.set("message", message);
    return NextResponse.redirect(url);
  }
}
