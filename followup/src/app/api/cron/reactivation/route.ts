import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { classifyQuietLeads } from "@/lib/reactivation";
import { mapWithConcurrency } from "@/lib/concurrency";

// Same reasoning as the other fan-out crons: one invocation covers every
// eligible business, and the per-tick budget below is sized to finish
// inside this. Needs a Vercel plan that honors maxDuration above the Hobby
// tier's cap.
export const maxDuration = 300;

/**
 * How many leads one business may have judged in a single tick. Modest on
 * purpose — well under classifyQuietLeads' own default of 60. A verdict is
 * permanent and a quiet lead has by definition been quiet for 45+ days, so
 * nothing here is urgent; what matters is that the back catalogue is
 * already judged by the time an owner first opens the batch screen, not
 * that it is judged today.
 */
const MAX_CLASSIFICATIONS_PER_BUSINESS = 40;

/**
 * The whole tick's ceiling, across every business. Without it, the first
 * business the query returns with a five-year inbox would take the entire
 * run: the OpenAI spend, the wall-clock time, and the serverless timeout
 * that ends the tick before anyone else is looked at — so a 5,000-lead
 * back catalogue would quietly starve every other tenant, every tick,
 * indefinitely. Same shape as the per-run caps in src/lib/gmailSync.ts
 * (MAX_CLASSIFICATIONS_PER_RUN / MAX_SCORES_PER_RUN): whatever isn't
 * reached this tick is reached on the next one, because the pass is
 * resumable by design.
 */
const MAX_CLASSIFICATIONS_PER_TICK = 400;

/** A failing business never stops the rest; a few at a time, like the other crons. */
const BUSINESS_CONCURRENCY = 3;

/**
 * GET /api/cron/reactivation — invoked by Vercel Cron (see vercel.json).
 *
 * Judges a slice of every active business's quiet back catalogue so that
 * the reactivation screen is already populated when someone opens it,
 * rather than making the owner sit through hundreds of OpenAI calls the
 * first time they click into it. Nothing here sends anything: it only
 * decides what a human may later be offered.
 *
 * Protected by CRON_SECRET, identical to every other /api/cron/* route —
 * see src/lib/cronAuth.ts. Without that env var set, this refuses every
 * request, cron included.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "reactivation");
  if (unauthorized) return unauthorized;

  try {
    // Businesses with a connected inbox: the back catalogue this exists
    // for is imported email. A business with no connected mailbox has no
    // catalogue to judge, and paying to classify manual/CSV leads it never
    // asked about would be spend with nothing behind it.
    //
    // Only the three plain columns the gate needs — Business carries
    // AES-GCM encrypted third-party secrets (ENCRYPTED_FIELDS in
    // src/lib/db.ts), and selecting the whole row would decrypt
    // credentials for every tenant on every tick.
    const businesses = await prisma.business.findMany({
      where: {
        users: {
          some: {
            integrations: { some: { provider: { in: ["gmail", "outlook"] }, status: "connected" } },
          },
        },
      },
      select: { id: true, subscriptionStatus: true },
      orderBy: { id: "asc" },
    });

    // Paid subscription only, deliberately NOT passing tier through to
    // hasActiveAccess. Free tier's defining cap is that AI processing
    // stops after 20 leads a month (research/market/2026-09-11-tier-
    // pricing-recommendation.md §2.2); classifying an unbounded back
    // catalogue on the platform's shared OpenAI key is exactly what that
    // cap exists to prevent. Same gate as POST /api/reactivation/classify
    // and the weekly-digest cron.
    const eligible = businesses.filter((b) => hasActiveAccess(b.subscriptionStatus));

    let budget = MAX_CLASSIFICATIONS_PER_TICK;
    let classified = 0;
    let failed = 0;
    let remaining = 0;
    let processed = 0;
    let skipped = 0;

    await mapWithConcurrency(eligible, BUSINESS_CONCURRENCY, async (b) => {
      // Reserve out of the shared budget BEFORE awaiting anything. Two
      // workers checking a budget they only decrement afterwards would
      // both see the same room and both spend it — the same check-then-act
      // race the rate limiter was fixed for.
      const limit = Math.min(MAX_CLASSIFICATIONS_PER_BUSINESS, budget);
      if (limit <= 0) {
        skipped += 1;
        return;
      }
      budget -= limit;

      try {
        const result = await classifyQuietLeads(b.id, { limit });
        // Hand back what the reservation didn't actually spend (a business
        // with three quiet leads shouldn't hold 40 of the tick's budget),
        // counting failures as spent — a failed verdict still cost an
        // OpenAI call.
        budget += limit - result.classified - result.failed;
        processed += 1;
        classified += result.classified;
        failed += result.failed;
        remaining += result.remaining;
      } catch (err) {
        // One business's OpenAI outage or bad data must not end the tick
        // for everyone else.
        budget += limit;
        skipped += 1;
        console.error(`Quiet-lead classification failed for business ${b.id}:`, err);
      }
    });

    // `skipped` includes businesses the budget ran out on. They are not
    // starved: a judged lead is never judged again, so every business that
    // IS served shrinks its own backlog to nothing within a few ticks and
    // stops competing for the budget — the queue drains rather than
    // permanently favouring whoever sorts first.
    return NextResponse.json({
      success: true,
      businesses: eligible.length,
      processed,
      skipped,
      classified,
      failed,
      remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reactivation classification run failed.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
