import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { reportCronFailure } from "@/lib/monitoring";
import { pollGoHighLevelForAllBusinesses } from "@/lib/ghlPoll";

// One request per connected GoHighLevel account, plus one per conversation with something new.
export const maxDuration = 300;

/**
 * GET /api/cron/ghl-poll — every two minutes (see vercel.json). Reads the texts and emails customers sent to the
 * owner's GoHighLevel (src/lib/ghlPoll.ts). Same CRON_SECRET protection as every other cron route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "ghl-poll");
  if (unauthorized) return unauthorized;

  try {
    const result = await pollGoHighLevelForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    reportCronFailure("ghl-poll", err);
    const message = err instanceof Error ? err.message : "GoHighLevel poll run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
