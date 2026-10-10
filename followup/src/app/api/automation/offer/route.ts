import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { REPLY_FOR_ME_OFFER } from "@/lib/replyForMeOffer";

// POST /api/automation/offer — "Let FollowUp reply for you?" was answered
// (A-218: asked once). Records only that it was asked; saying yes goes
// through /api/automation/settings like every other way of granting it.
// Admin-only: the question is business-wide, like the switch it offers.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) {
    return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  }
  if (await tooManyRecentActions(ctx.businessId, `automation.offer:${ctx.userId}`, { windowMinutes: 10, max: 10 })) {
    return NextResponse.json({ success: false, message: "Too many requests. Try again in a few minutes." }, { status: 429 });
  }

  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { dismissedSetupSteps: true } });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });
  if (!business.dismissedSetupSteps.includes(REPLY_FOR_ME_OFFER)) {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: { dismissedSetupSteps: [...new Set([...business.dismissedSetupSteps, REPLY_FOR_ME_OFFER])] },
    });
    void recordAudit(ctx, "automation.offer.answered");
  }
  return NextResponse.json({ success: true });
}
