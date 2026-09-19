import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { pollInstagramForAllBusinesses } from "@/lib/instagramPoll";

// One Graph call per business with a connected Instagram account, plus one
// per conversation that actually changed since the last tick — so a quiet
// account costs a single request. Same maxDuration posture as the other
// fan-out crons.
export const maxDuration = 300;

/**
 * GET /api/cron/instagram-poll — every few minutes (see vercel.json).
 *
 * The webhook is the fast path and stays exactly as it is; this is the one
 * that does not depend on Meta choosing to call us. See the header comment
 * in src/lib/instagramPoll.ts for the 2026-09-19 account that was
 * connected, subscribed and silent for an entire afternoon while the same
 * messages were readable through the API. Same CRON_SECRET protection as
 * every other cron route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "instagram-poll");
  if (unauthorized) return unauthorized;

  try {
    const result = await pollInstagramForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Instagram poll run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
