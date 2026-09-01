import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailStatus } from "@/lib/integrations/gmail";

// GET /api/integrations/gmail/status — used by the Settings page (and
// Sidebar) to render the real connection state.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ connected: false }, { status: 401 });

  const status = await getGmailStatus();
  return NextResponse.json(status);
}
