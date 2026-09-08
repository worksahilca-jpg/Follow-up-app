import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { syncOutlookForAllBusinesses } from "@/lib/outlookSync";

// Every business with a connected Outlook, pulling only what's new via
// Graph's delta cursor. Same reasoning and CRON_SECRET protection as
// /api/cron/gmail-sync — until this exists, a new Outlook email only
// becomes a lead when the owner presses "Sync now."
export const maxDuration = 300;

// GET /api/cron/outlook-sync — invoked every few minutes by Vercel Cron
// (see vercel.json). The plaintext-credential encryption sweep already
// runs on the Gmail cron tick and covers every Integration row regardless
// of provider, so it isn't duplicated here.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "outlook-sync");
  if (unauthorized) return unauthorized;

  try {
    const result = await syncOutlookForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outlook sync run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
