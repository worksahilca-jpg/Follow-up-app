import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { recordAppOpen } from "@/lib/appOpens";

// POST /api/account/seen — "this person opened FollowUp today" (see
// src/lib/appOpens.ts). Sent once per browser day by SeenPing in the app
// layout; the server keeps it to one row per person per local day. Writes
// nothing but who and when, and only for the signed-in person themself.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const recorded = await recordAppOpen({ businessId: ctx.businessId, userId: ctx.userId }).catch(() => false);
  return NextResponse.json({ success: true, recorded });
}
