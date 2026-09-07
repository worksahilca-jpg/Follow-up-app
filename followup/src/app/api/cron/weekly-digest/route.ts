import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { sendEmail } from "@/lib/integrations/gmail";
import { getRescueReport, renderRescueDigest } from "@/lib/rescued";
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
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const businesses = await prisma.business.findMany({
    where: { users: { some: { integrations: { some: { provider: "gmail", status: "connected" } } } } },
    select: {
      id: true,
      name: true,
      subscriptionStatus: true,
      users: { where: { role: "ADMIN" }, select: { email: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  await mapWithConcurrency(businesses, 3, async (b) => {
    if (!hasActiveAccess(b.subscriptionStatus) || b.users.length === 0) {
      skipped += 1;
      return;
    }
    try {
      const report = await getRescueReport(b.id, 7);
      const body = renderRescueDigest(b.name, report, appUrl());
      for (const u of b.users) {
        const r = await sendEmail(b.id, { to: u.email, subject: `FollowUp this week: ${report.rescued} came back, ${report.answeredForYou} answered for you`, body });
        if (r.success) sent += 1;
      }
    } catch (err) {
      skipped += 1;
      console.error(`Weekly digest failed for business ${b.id}:`, err);
    }
  });

  return NextResponse.json({ success: true, businesses: businesses.length, sent, skipped });
}
