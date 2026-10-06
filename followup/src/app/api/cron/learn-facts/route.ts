import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { reportCronFailure } from "@/lib/monitoring";
import { learnFromSentReplies } from "@/lib/businessFacts";

export const maxDuration = 60;

/**
 * GET /api/cron/learn-facts — every ten minutes (see vercel.json).
 *
 * Reads each reply sent through FollowUp once, for things the business tells
 * every customer (src/lib/businessFacts.ts). One cheap query and nothing else
 * when there is nothing new. Protected by CRON_SECRET like every other
 * /api/cron/* route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "learn-facts");
  if (unauthorized) return unauthorized;
  try {
    const result = await learnFromSentReplies();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    reportCronFailure("learn-facts", err);
    const message = err instanceof Error ? err.message : "Learning from sent replies failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
