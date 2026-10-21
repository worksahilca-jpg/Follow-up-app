import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";

/**
 * POST /api/business/inbox-summary — "Got it" on "Your last 90 days" (A-306): the card isn't shown again. Admin only,
 * like the card itself.
 */
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  await prisma.business.update({ where: { id: ctx.businessId }, data: { inboxSummarySeenAt: new Date() } });
  return NextResponse.json({ success: true });
}
