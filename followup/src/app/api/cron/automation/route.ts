import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runAutomationForAllBusinesses } from "@/lib/automation";
import { runSequencesForAllBusinesses } from "@/lib/sequences";
import { pruneInboundWebhookEvents } from "@/lib/inboundEvents";
import { pruneRateLimitHits } from "@/lib/rateLimit";
import { remindStaleApprovalsForAllBusinesses } from "@/lib/staleApprovals";

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

  const errors: string[] = [];
  const failed = (label: string) => (err: unknown) => {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[cron] ${label} failed:`, err);
    errors.push(`${label}: ${message}`);
    return null;
  };

  try {
    /*
     * Two independent automated-sending paths, both business-paced daily:
     * the silence-triggered rule, and workflow (Sequence) steps. Run both
     * from the one cron invocation rather than doubling up on Vercel Cron
     * schedules for what's conceptually "today's automated sends."
     *
     * INDEPENDENT means independent. This was a bare Promise.all, which
     * rejects the moment either one does — and each of these starts with
     * an unguarded findMany, so one transient database error took down
     * far more than itself:
     *
     *   - the OTHER path's results were discarded, including sends it had
     *     already made, so the run's own record of what went out was lost
     *   - the stale-approval reminders below never ran
     *   - the inbound-event pruning below never ran
     *   - the route returned 500 having actually done some of the work
     *
     * All of that from a blip in a query that lists which businesses have
     * automation switched on. The per-business isolation inside each
     * function was already careful; the join between them was not.
     *
     * Each path now fails alone. A path that throws is recorded and the
     * rest of the tick continues.
     */
    const [automation, sequences] = await Promise.all([
      runAutomationForAllBusinesses().catch(failed("automation")),
      runSequencesForAllBusinesses().catch(failed("sequences")),
    ]);

    /*
     * The third thing an hourly tick owes an owner: a nudge about what is
     * waiting on THEM.
     *
     * Both paths above are about FollowUp acting. Neither says anything
     * when it has correctly decided not to act and handed the decision
     * back. Production on 2026-09-21 had twenty-three leads in the
     * approval queue, the oldest at 175 hours, with nobody told.
     *
     * After the sends, and outside their Promise.all on purpose: a
     * reminder is the least important thing this invocation does, and it
     * must never be able to fail a real send. It swallows its own errors
     * (see staleApprovals.ts) for the same reason pruning below does.
     */
    const staleApprovals = await remindStaleApprovalsForAllBusinesses().catch((err) => {
      failed("stale-approval reminders")(err);
      return { checked: 0, reminded: 0 };
    });
    // Retention for the raw inbound-capture log (InboundWebhookEvent):
    // processed rows after 14 days, unreplayed failures after 90. It is
    // written once per inbound message forever, so it needs a policy from
    // day one rather than joining AuditEvent / RateLimitHit /
    // ProcessedWebhookEvent on the unretained list
    // (research/product/2026-09-15-cost-to-serve-one-customer.md §2.1).
    // Deliberately outside the Promise.all and after it: a pruning failure
    // must never be able to fail the actual automation run.
    const pruned = await pruneInboundWebhookEvents().catch((err) => {
      failed("inbound webhook event pruning")(err);
      return { deleted: 0 };
    });
    // RateLimitHit off the unretained list too: one row per attempt at a
    // limited endpoint, public ones included, so without this a stranger
    // could grow it without bound. Same isolation as the prune above.
    const prunedRateLimitHits = await pruneRateLimitHits().catch((err) => {
      failed("rate-limit hit pruning")(err);
      return { deleted: 0 };
    });

    /*
     * 500 only when BOTH send paths died, which is the one case where the
     * tick genuinely did nothing and an uptime check should shout.
     *
     * A partial failure returns 200 with `errors` populated and whatever
     * ran reported honestly. That is deliberate: reporting a 500 for a run
     * that sent real messages would make the response a worse record than
     * no response at all, and the console.error above is what carries the
     * failure to Sentry either way.
     */
    const body = { success: errors.length === 0, automation, sequences, staleApprovals, pruned, prunedRateLimitHits, errors };
    const nothingRan = automation === null && sequences === null;
    return NextResponse.json(body, { status: nothingRan ? 500 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Automation run failed.";
    return NextResponse.json({ success: false, message, errors }, { status: 500 });
  }
}
