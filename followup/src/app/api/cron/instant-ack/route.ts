import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runDueInstantAcks } from "@/lib/acknowledge";

// The worker budgets itself by wall clock (see runDueInstantAcks) and hands
// back long before this; the ceiling is headroom, not the thing that ends
// the run. Deliberately lower than the 300s the daily fan-out crons ask
// for: this one runs every minute, and an invocation still going five
// minutes later would be stacking, not working.
export const maxDuration = 60;

/**
 * GET /api/cron/instant-ack — every minute (see vercel.json).
 *
 * Sends the DM acknowledgements whose two-minute grace period has run out
 * (DM_ACK_GRACE_PERIOD_MS in src/lib/acknowledge.ts). On Instagram,
 * Messenger and WhatsApp the acknowledgement is no longer sent from the
 * webhook: the owner gets those two minutes to answer the DM themselves,
 * and only if they haven't does FollowUp reply — and then tells them it
 * did.
 *
 * Every minute, not every five, because the wait is the product decision
 * and the tick is the error bar on it. At this granularity a lead who
 * writes at 12:00:10 is answered between 12:02:10 and 12:03:00 (plus
 * whatever lateness Vercel's scheduler adds, which it does not promise to
 * avoid): "two to three minutes", which is a number worth stating to
 * customers. At a five-minute tick the same wait would be anywhere from two
 * to seven minutes, which is no longer an instant reply.
 *
 * The run is cheap when there is nothing to do — one indexed range query
 * (Lead_ackDueAt_idx) returning no rows. Everything that makes it safe to
 * run this often (the atomic claim, the lease, every guarantee re-checked
 * at send time) lives in src/lib/acknowledge.ts, not here.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route (see
 * src/lib/cronAuth.ts). Without that env var set, this refuses every
 * request, cron included.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "instant-ack");
  if (unauthorized) return unauthorized;

  try {
    const result = await runDueInstantAcks();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Instant acknowledgement run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
