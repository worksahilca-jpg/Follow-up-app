import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { recentTrackRecord } from "@/lib/showTheWork";

/**
 * GET /api/business/track-record — "You sent 18 of the last 20 as FollowUp
 * wrote them" (research round 2, #3), for Settings → Replies and check-ins.
 * Counts only, for the signed-in business; no message text leaves here.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const record = await recentTrackRecord(ctx.businessId);
  return NextResponse.json({ success: true, ...record });
}
