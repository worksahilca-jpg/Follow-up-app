import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasActiveAccess, FREE_TIER_LEAD_CAP } from "@/lib/billing";

// GET /api/billing/status — backs the Billing section in Settings and the
// sidebar's "not subscribed" banner.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx)
    return NextResponse.json(
      { active: false, status: null, currentPeriodEnd: null, tier: "free", voiceAddonEnabled: false, leadsUsedThisMonth: 0, leadCap: FREE_TIER_LEAD_CAP },
      { status: 401 }
    );

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { subscriptionStatus: true, currentPeriodEnd: true, tier: true, voiceAddonEnabled: true },
  });
  const tier = business?.tier ?? "free";

  // Only worth counting on Free — Plus/Pro have no cap, and the count
  // itself only exists to answer "where does a Free business stand this
  // month," not as a general usage metric.
  let leadsUsedThisMonth = 0;
  if (tier === "free") {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    leadsUsedThisMonth = await prisma.lead.count({ where: { businessId: ctx.businessId, createdAt: { gte: monthStart } } });
  }

  return NextResponse.json({
    active: hasActiveAccess(business?.subscriptionStatus),
    status: business?.subscriptionStatus ?? null,
    currentPeriodEnd: business?.currentPeriodEnd?.toISOString() ?? null,
    tier,
    voiceAddonEnabled: business?.voiceAddonEnabled ?? false,
    leadsUsedThisMonth,
    leadCap: FREE_TIER_LEAD_CAP,
  });
}
