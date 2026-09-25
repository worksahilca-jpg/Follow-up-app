import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runOwnerAlerts } from "@/lib/ownerAlerts";

// Runs every minute; an invocation still going a minute later would be
// stacking, not working. Same ceiling and reasoning as instant-ack.
export const maxDuration = 60;

/**
 * GET /api/cron/owner-alerts — every minute (see vercel.json).
 *
 * Emails and phone-notifies an owner when a customer wrote and FollowUp's
 * reply is waiting for their OK — see src/lib/ownerAlerts.ts for exactly
 * what counts, and why it is derived from the approval queue rather than
 * raised by the code that holds a draft.
 *
 * Every minute because the founder's bar is "told within minutes, approve
 * within five": at this tick an alert lands a minute or two after the
 * reply is ready. Cheap when there is nothing to do — with no alert keys
 * set it returns without touching the database, and otherwise it only
 * opens the queue of a business where something was held or heard from in
 * the last few hours.
 *
 * Protected by CRON_SECRET like every other /api/cron/* route.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "owner-alerts");
  if (unauthorized) return unauthorized;

  try {
    const result = await runOwnerAlerts();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Owner alert run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
