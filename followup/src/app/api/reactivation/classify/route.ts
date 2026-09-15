import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasActiveAccess, billingLockedMessage } from "@/lib/billing";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { classifyQuietLeads } from "@/lib/reactivation";
import { recordAudit } from "@/lib/audit";

// One pass is up to DEFAULT_CLASSIFY_LIMIT (60) OpenAI calls at
// concurrency 4 — seconds, not minutes, but comfortably past a default
// serverless timeout on a slow day. Same ceiling as the other AI-heavy
// manual actions (Gmail sync, spam scan).
export const maxDuration = 300;

/**
 * POST /api/reactivation/classify — judge the next batch of this
 * business's quiet leads, on demand.
 *
 * ## One batch per call, on purpose
 *
 * classifyQuietLeads() is deliberately resumable (see the header comment
 * in src/lib/reactivation.ts), so this route does exactly one batch and
 * returns immediately with what it did:
 *
 *   { success: true, classified, remaining, failed }
 *
 * `remaining` is how many eligible leads this pass did not reach. The
 * client's contract is simple: while `remaining > 0`, call this again —
 * that is the whole progress loop, and it is why the batch screen can say
 * "43 of your 200 judged so far" instead of showing a spinner for four
 * minutes and then timing out. Every verdict is written as it completes,
 * so a call that dies half way through (deploy, timeout, frozen function)
 * still banks the work it finished; the next call picks up exactly where
 * it stopped. A long-running job queue would buy nothing here that
 * resumability doesn't already give us.
 *
 * One caveat for whoever writes that loop: `remaining` is "eligible but
 * not fetched in this pass" (classifyQuietLeads counts it as the eligible
 * total minus the batch it took), so leads the pass fetched and then
 * SKIPPED — a lost claim race, a failed OpenAI call — are not in it. The
 * last call of a drain can therefore come back `{ remaining: 0, failed: 3
 * }` with three leads still unjudged. Treat a non-zero `failed` as "come
 * back later", not as "done": the cron retries them regardless, so the
 * screen just needs to not claim the catalogue is fully judged.
 *
 * ## Access
 *
 * Admin, unlike the batch view. This spends real money on the platform's
 * shared OpenAI key — a five-year inbox is hundreds of classifications —
 * and "should we pay to judge the whole back catalogue" is an
 * account-level decision of the same kind as changing the automation
 * settings, not a per-rep one. Nothing is lost by gating it: the cron
 * (/api/cron/reactivation) drains the same backlog for every active
 * business on its own, so this route is only ever the impatient path.
 *
 * Billing: a live paid subscription, checked directly with hasActiveAccess
 * rather than through requireActiveBilling — this is one of the handful of
 * genuinely Plus/Pro-only capabilities (like crmSync.ts's CRM import),
 * and Free tier's defining cap is precisely that AI processing stops after
 * 20 leads a month (research/market/2026-09-11-tier-pricing-
 * recommendation.md §2.2). Letting a $0 business classify an unbounded
 * back catalogue on the shared key is the one thing that cap exists to
 * prevent. requireActiveBilling() would admit them, so it is not used here.
 *
 * Takes no request body. The batch size is not a client-controlled cost
 * knob — an accepted `limit` would just be a way to ask for more spend per
 * rate-limited call, and the resumable loop above already makes a fixed
 * batch size the right shape.
 *
 * Scoping: businessId comes only from the session; classifyQuietLeads
 * filters every query on it.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }

  // Only the plain column this decision needs — Business carries AES-GCM
  // encrypted third-party secrets (ENCRYPTED_FIELDS in src/lib/db.ts) and
  // a whole-row read would decrypt credentials this route never touches.
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { subscriptionStatus: true },
  });
  if (!hasActiveAccess(business?.subscriptionStatus)) {
    return NextResponse.json({ success: false, message: await billingLockedMessage(ctx.businessId) }, { status: 402 });
  }

  // 6 per 10 minutes — up to ~360 classifications per business per ten
  // minutes, which drains a large back catalogue in well under an hour
  // while capping what a single compromised or careless admin account can
  // run up against the shared OpenAI key. Atomic (see checkAndRecordHit in
  // src/lib/rateLimit.ts): the count and the recorded hit happen inside one
  // advisory-locked transaction, so a burst of parallel clicks can't all
  // read the same pre-flood count and all pass.
  if (await tooManyRecentActions(ctx.businessId, "reactivation-classify", { windowMinutes: 10, max: 6 })) {
    return NextResponse.json(
      { success: false, message: "Still judging the last batch — try again in a few minutes." },
      { status: 429 }
    );
  }

  try {
    const result = await classifyQuietLeads(ctx.businessId);

    // reactivation.ts audits each individual verdict; this records who
    // asked for the pass at all, which is the question "why did we spend
    // this" actually needs answering.
    void recordAudit(ctx, "ai.quiet_outcome_classify_run", { meta: result });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not judge your quiet leads.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
