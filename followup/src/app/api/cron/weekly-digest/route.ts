import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { sendEmail } from "@/lib/integrations/gmail";
import { getRescueReport, renderRescueDigest } from "@/lib/rescued";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { appUrl } from "@/lib/stripe";
import { mapWithConcurrency } from "@/lib/concurrency";
import { tooManyRecentActions } from "@/lib/rateLimit";

export const maxDuration = 300;

/**
 * The week a digest belongs to: the UTC date of the Monday it began on
 * ("2026-09-21"). Any two moments in the same Monday-to-Sunday week give
 * the same key, so a repeat delivery of this Monday's run finds the claim
 * the first one took, and next Monday's run gets a fresh one.
 */
function digestWeekOf(now: Date): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

// Long enough to see every claim made under this week's key — two moments
// in the same week are always less than seven days apart. The week is in
// the key itself, so this never reaches back into last week's digest.
const DIGEST_CLAIM_WINDOW_MINUTES = 7 * 24 * 60;

/**
 * GET /api/cron/weekly-digest — Monday mornings (vercel.json). Emails every
 * admin of every active business "what FollowUp saved you this week",
 * sent from the business's own connected Gmail (no third-party mailer,
 * nothing leaves the account). Businesses without a connected Gmail are
 * skipped — the same report is always on the dashboard.
 *
 * At most once per admin per week (daily-path bug hunt 2026-09-25, F11).
 * Vercel can deliver the same scheduled run more than once and asks for
 * idempotent jobs; this route kept no record of having sent, so a repeat
 * delivery emailed every admin a second copy. Every other cron that sends
 * is claim-protected, and this one now is too — see the claim below.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "weekly-digest");
  if (unauthorized) return unauthorized;

  const week = digestWeekOf(new Date());

  const businesses = await prisma.business.findMany({
    where: { users: { some: { integrations: { some: { provider: "gmail", status: "connected" } } } } },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      tier: true,
      users: { where: { role: "ADMIN" }, select: { id: true, email: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  let alreadySent = 0;
  await mapWithConcurrency(businesses, 3, async (b) => {
    // B-004 (research/audit/backend-backlog.md): this doc comment says
    // "every active business", and the only documented exclusion is "no
    // connected Gmail" — so a tier-blind hasActiveAccess call silently
    // dropped every Free business (which by design has no Stripe
    // subscription at all, see @/lib/billing) was a bug, not a paywall.
    // Passing tier makes Free count as access here, same as lead
    // capture/sync already do.
    if (!hasActiveAccess(b.subscriptionStatus, b.tier) || b.users.length === 0) {
      skipped += 1;
      return;
    }
    try {
      const report = await getRescueReport(b.id, 7);
      // What is written and waiting. On an account with
      // holdAllForApproval on — the default since 2026-09-21 — automated
      // sends are zero by construction, so without this the weekly email
      // reports a week of nothing to a business whose queue may hold a
      // dozen replies that have sat there since Monday.
      const awaitingApproval = (await getPendingApprovals(b.id)).length;
      const body = renderRescueDigest(b.name, report, appUrl(), awaitingApproval);
      // The subject leads with whatever actually needs them. "0 came
      // back, 0 answered for you" is a demoralising and useless subject
      // on an account that is holding twelve drafts.
      const subject =
        awaitingApproval > 0
          ? `FollowUp this week: ${awaitingApproval} ${awaitingApproval === 1 ? "reply is" : "replies are"} waiting for your OK`
          : `FollowUp this week: ${report.rescued} came back, ${report.answeredForYou} answered for you`;
      for (const u of b.users) {
        // The claim, one per admin per week, taken right before the send.
        // It is the same atomic check-and-record the rate limits use
        // (src/lib/rateLimit.ts): a transaction-scoped advisory lock on
        // (business, key), so two deliveries arriving together are
        // serialised and exactly one of them sees an empty week. No new
        // column — RateLimitHit already doubles as a ledger this way for
        // the send caps (src/lib/sendCaps.ts), and it belongs to the
        // business, so deleting the business deletes these rows with it
        // (src/lib/businessData.ts).
        //
        // Per admin rather than per business: a first delivery cut off
        // between two admins leaves the second one for the repeat to send,
        // instead of losing it for the week.
        //
        // Kept when the send fails, deliberately. The promise is "at most
        // once", and a Gmail call that errors after Google accepted the
        // message would otherwise go out twice. A missed digest is a
        // week's summary the dashboard still shows; a duplicate is the bug.
        const claimedAlready = await tooManyRecentActions(b.id, `weekly_digest:${week}:${u.id}`, {
          windowMinutes: DIGEST_CLAIM_WINDOW_MINUTES,
          max: 1,
        });
        if (claimedAlready) {
          alreadySent += 1;
          continue;
        }
        const r = await sendEmail(b.id, { to: u.email, subject, body });
        if (r.success) sent += 1;
      }
    } catch (err) {
      skipped += 1;
      console.error(`Weekly digest failed for business ${b.id}:`, err);
    }
  });

  return NextResponse.json({ success: true, businesses: businesses.length, sent, skipped, alreadySent });
}
