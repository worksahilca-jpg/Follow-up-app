import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runAutomationForAllBusinesses } from "@/lib/automation";
import { runSequencesForAllBusinesses } from "@/lib/sequences";
import { pruneInboundWebhookEvents } from "@/lib/inboundEvents";

// One invocation covers every business with automation enabled — at real
// tenant counts that's comfortably past a default serverless timeout even
// with the concurrency in automation.ts. Needs a Vercel plan that honors
// maxDuration above the Hobby tier's 10s cap; if the tenant count outgrows
// even that, this needs to become a fan-out (one job enqueued per business)
// rather than one function doing all of them.
export const maxDuration = 300;

// GET /api/cron/automation — invoked automatically once an hour by Vercel
// Cron (see vercel.json's "0 * * * *"). Runs the auto-send check across every business
// with automation enabled, in one pass, in place of the manual "Run
// automation check now" button in Settings.
//
// Protected by CRON_SECRET: when that env var is set, Vercel signs its own
// cron requests with an `Authorization: Bearer <CRON_SECRET>` header, so
// this rejects anyone hitting the URL directly without it. Set CRON_SECRET
// in the deployment's environment variables (any long random string) —
// without it, this route refuses every request, cron included.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "automation");
  if (unauthorized) return unauthorized;

  try {
    // Two independent automated-sending paths, both business-paced daily:
    // the silence-triggered rule, and workflow (Sequence) steps. Run both
    // from the one cron invocation rather than doubling up on Vercel Cron
    // schedules for what's conceptually "today's automated sends."
    const [automation, sequences] = await Promise.all([
      runAutomationForAllBusinesses(),
      runSequencesForAllBusinesses(),
    ]);
    // Retention for the raw inbound-capture log (InboundWebhookEvent):
    // processed rows after 14 days, unreplayed failures after 90. It is
    // written once per inbound message forever, so it needs a policy from
    // day one rather than joining AuditEvent / RateLimitHit /
    // ProcessedWebhookEvent on the unretained list
    // (research/product/2026-09-15-cost-to-serve-one-customer.md §2.1).
    // Deliberately outside the Promise.all and after it: a pruning failure
    // must never be able to fail the actual automation run.
    const pruned = await pruneInboundWebhookEvents().catch((err) => {
      console.error("[cron] inbound webhook event pruning failed:", err);
      return { deleted: 0 };
    });
    return NextResponse.json({ success: true, automation, sequences, pruned });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
