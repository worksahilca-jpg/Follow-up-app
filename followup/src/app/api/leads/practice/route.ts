import { NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { deleteLeadCascade } from "@/lib/leads-admin";
import { forgetSender } from "@/lib/senderVerdicts";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { recordAudit } from "@/lib/audit";

/**
 * Practice customers: the ones "See it work: send yourself a practice email" made
 * (POST /api/leads/test-lead stamps source "Test lead"). Founder, 2026-10-05 (A-093):
 * testers' practice customers cluttered their lists and their numbers.
 *
 * Only that exact source is ever touched. A customer an owner typed in by hand looks
 * exactly like a real one, so nothing here guesses: the source is the whole rule.
 */
const PRACTICE_SOURCE = "Test lead";

async function practiceLeads(businessId: string) {
  return prisma.lead.findMany({ where: { businessId, source: PRACTICE_SOURCE }, select: { id: true, email: true } });
}

// GET /api/leads/practice — how many there are, so Settings shows the row only when it has work.
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  const count = await prisma.lead.count({ where: { businessId: ctx.businessId, source: PRACTICE_SOURCE } });
  return NextResponse.json({ success: true, count });
}

// DELETE /api/leads/practice — removes every practice customer in this business, and only those.
export async function DELETE() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  if (await tooManyRecentActions(ctx.businessId, "leads.practice.delete", { windowMinutes: 60, max: 10 })) {
    return NextResponse.json({ success: false, message: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }

  const leads = await practiceLeads(ctx.businessId);
  for (const lead of leads) {
    // The tenant goes with it: deleteLeadCascade re-checks ownership right before the rows go.
    await deleteLeadCascade(lead.id, ctx.businessId);
    await forgetSender(ctx.businessId, lead.email);
  }
  void recordAudit(ctx, "leads.practice.delete", { meta: { count: leads.length } });
  return NextResponse.json({ success: true, removed: leads.length });
}
