import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";

// GET /api/billing/status — backs the Billing section in Settings and the
// sidebar's "not subscribed" banner.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ active: false, status: null, currentPeriodEnd: null }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { subscriptionStatus: true, currentPeriodEnd: true },
  });

  return NextResponse.json({
    active: hasActiveAccess(business?.subscriptionStatus),
    status: business?.subscriptionStatus ?? null,
    currentPeriodEnd: business?.currentPeriodEnd?.toISOString() ?? null,
  });
}
