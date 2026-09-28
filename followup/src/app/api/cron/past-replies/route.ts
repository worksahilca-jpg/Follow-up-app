import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { reportCronFailure } from "@/lib/monitoring";
import { readAllPastReplies } from "@/lib/pastReplies";

export const maxDuration = 60;

/**
 * GET /api/cron/past-replies — every five minutes (see vercel.json).
 *
 * Reads one more page of sent Gmail for each business that turned on
 * "Write like me" and is still reading (src/lib/pastReplies.ts). A single
 * cheap query and nothing else when no one is. Protected by CRON_SECRET
 * like every other /api/cron/* route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "past-replies");
  if (unauthorized) return unauthorized;
  try {
    const result = await readAllPastReplies();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    reportCronFailure("past-replies", err);
    const message = err instanceof Error ? err.message : "Reading past replies failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
