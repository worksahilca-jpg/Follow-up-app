import { NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { sendEmail } from "@/lib/integrations/gmail";
import { getRescueReport, renderRescueDigest } from "@/lib/rescued";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { appUrl } from "@/lib/stripe";
import { mapWithConcurrency } from "@/lib/concurrency";

export const maxDuration = 300;

/**
 * GET /api/cron/weekly-digest — Monday mornings (vercel.json). Emails every
 * admin of every active business "what FollowUp saved you this week",
 * sent from the business's own connected Gmail (no third-party mailer,
 * nothing leaves the account). Businesses without a connected Gmail are
 * skipped — the same report is always on the dashboard.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request, "weekly-digest");
  if (unauthorized) return unauthorized;

  const businesses = await prisma.business.findMany({
    where: { users: { some: { integrations: { some: { provider: "gmail", status: "connected" } } } } },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      tier: true,
      users: { where: { role: "ADMIN" }, select: { email: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
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
        const r = await sendEmail(b.id, { to: u.email, subject, body });
        if (r.success) sent += 1;
      }
    } catch (err) {
      skipped += 1;
      console.error(`Weekly digest failed for business ${b.id}:`, err);
    }
  });

  return NextResponse.json({ success: true, businesses: businesses.length, sent, skipped });
}
