import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runDueHoldingMessages } from "@/lib/holdingMessage";

// Every five minutes (see vercel.json), so "30 minutes" is 30 to 35 in
// practice — an honest error bar for a message whose whole job is that the
// customer isn't left wondering. The ceiling matches the per-minute crons:
// anything not reached is reached on the next tick.
export const maxDuration = 60;

/**
 * GET /api/cron/holding-messages — the "we got you" message
 * (src/lib/holdingMessage.ts, founder 2026-09-26): a price or date
 * question the owner hasn't answered in 30 minutes gets one short message
 * that promises nothing. Every rule about whether one goes lives there.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route (see
 * src/lib/cronAuth.ts).
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "holding-messages");
  if (unauthorized) return unauthorized;

  try {
    const result = await runDueHoldingMessages();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Holding-message run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
