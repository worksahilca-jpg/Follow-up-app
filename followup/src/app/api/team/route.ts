import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getTeamData } from "@/lib/team";

// GET /api/team — real members + pending invites for the signed-in user's
// own business, plus that user's own role (drives whether the Settings
// page shows invite/role/remove controls at all).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const data = await getTeamData(ctx.businessId, ctx.userId);
  if (!data) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  return NextResponse.json({ success: true, ...data });
}
