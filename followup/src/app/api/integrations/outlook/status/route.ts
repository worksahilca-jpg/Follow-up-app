import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getOutlookStatus, outlookOAuthAvailable } from "@/lib/integrations/outlook";

// GET /api/integrations/outlook/status — used by the Settings page to
// render real connection state, and whether the one-click button is
// available at all (MICROSOFT_CLIENT_ID/SECRET set).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ connected: false }, { status: 401 });

  const status = await getOutlookStatus(ctx.businessId);
  return NextResponse.json({ ...status, oauthAvailable: outlookOAuthAvailable() });
}
