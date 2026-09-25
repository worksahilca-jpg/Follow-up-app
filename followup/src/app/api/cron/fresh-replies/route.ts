import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runFreshRepliesForAllBusinesses } from "@/lib/automation";

// Every minute, like /api/cron/instant-ack, and for the same reason the
// ceiling is lower than the hourly fan-out's 300s: an invocation still
// running when the next one starts would be stacking, not working. Anything
// not reached is reached a minute later.
export const maxDuration = 60;

/**
 * GET /api/cron/fresh-replies — every minute (see vercel.json).
 *
 * A reply within five minutes of any new customer message, on every
 * channel, at any hour — the founder's follow-up strategy, 2026-09-25. On a
 * holding account (the default) that means the drafted reply is waiting on
 * Today and the owner has been told; on an account that sends without
 * asking, a low-risk reply goes out and anything the risk check flags
 * still waits for the owner.
 *
 * The tick is the error bar on "five minutes": capture writes the draft
 * in-line, the worker waits one minute (two on a DM channel, the owner's
 * head start) and this runs once a minute, so a message is answered or
 * held between one and three minutes after it arrives — plus however long
 * its channel takes to reach FollowUp at all (a webhook: seconds; the
 * mailbox syncs: up to two minutes).
 *
 * Cheap when there is nothing to do: one indexed range query on
 * Lead.lastContacted. Every rule about WHETHER to send lives in
 * runAutomationForBusiness (src/lib/automation.ts), not here.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route (see
 * src/lib/cronAuth.ts). Without that env var set, this refuses every
 * request, cron included.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "fresh-replies");
  if (unauthorized) return unauthorized;

  try {
    const result = await runFreshRepliesForAllBusinesses();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fresh-reply run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
