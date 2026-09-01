import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getGmailStatus } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/status — used by the Settings page (and
// Sidebar) to render the real connection state for the signed-in user's
// own business.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ connected: false }, { status: 401 });

  const status = await getGmailStatus(ctx.businessId);
  return NextResponse.json(status);
}
