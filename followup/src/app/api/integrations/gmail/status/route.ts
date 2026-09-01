import { NextResponse } from "next/server";
import { getGmailStatus } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/status — used by the Settings page to render
// the real connection state instead of local demo state.
export async function GET() {
  const status = await getGmailStatus();
  return NextResponse.json(status);
}
