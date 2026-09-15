import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runOutboundRetries } from "@/lib/sending";

// The worker budgets itself by wall clock (see runOutboundRetries) and hands
// back well before this, so the ceiling is headroom rather than the thing
// that ends the run.
export const maxDuration = 300;

/**
 * GET /api/cron/outbound-retry — every five minutes (see vercel.json).
 *
 * Re-sends the automated messages a provider refused for a reason that fixes
 * itself: a Twilio 500, a Gmail rate limit, a socket that hung up. Without
 * this, those messages were simply never sent — the funnel returned
 * { success: false } and the caller moved on.
 *
 * Five minutes, not an hour, because the first retry is two minutes out: a
 * follow-up that lands an hour late has missed the moment it was written for.
 * Everything that makes this safe to run this often — the atomic claim, the
 * bounded attempts, the guards re-checked at send time — lives in
 * src/lib/sending.ts and src/lib/sendQueue.ts, not here.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route (see
 * src/lib/cronAuth.ts). Without that env var set, this refuses every request,
 * cron included.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "outbound-retry");
  if (unauthorized) return unauthorized;

  try {
    const result = await runOutboundRetries();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Outbound retry run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
