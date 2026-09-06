import { NextRequest, NextResponse } from "next/server";
import { syncGmailForAllBusinesses } from "@/lib/gmailSync";

// Every business with a connected Gmail, each pulling only what's new since
// its last tick — small per business, but the count of businesses is the
// real variable. Needs a Vercel plan that honors maxDuration above the
// Hobby tier's cap; past a few hundred tenants this becomes a fan-out.
export const maxDuration = 300;

// GET /api/cron/gmail-sync — invoked every few minutes by Vercel Cron (see
// vercel.json). Until this existed, a new email only became a lead when
// the owner pressed "Sync now" in Settings — which is the exact opposite of
// "no lead goes cold": the lead was cold from the moment it arrived. Same
// CRON_SECRET protection as /api/cron/automation.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncGmailForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail sync run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
