import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { getTeamData } from "@/lib/team";
import { inviteAloneIsEnough } from "@/lib/auth";

// GET /api/team — real members + pending invites for the signed-in user's
// own business, plus that user's own role (drives whether the Settings
// page shows invite/role/remove controls at all).
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

  const data = await getTeamData(ctx.businessId, ctx.userId);
  if (!data) return NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
  // Whether an invite is enough on its own to get someone in.
  //
  // src/lib/auth.ts checks ALLOWED_EMAILS (or an approved AccessRequest)
  // BEFORE it looks for a team invite, so while that allowlist is set an
  // invited teammate is turned away at sign-in and the invite they were
  // emailed never gets consumed. Settings said "They'll join
  // automatically the next time they sign in" regardless — an instruction
  // that cannot work, which the owner only discovers by watching a
  // colleague fail to get in.
  return NextResponse.json({ success: true, ...data, inviteAloneIsEnough: inviteAloneIsEnough() });
}
