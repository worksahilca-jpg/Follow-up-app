import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";

/**
 * GET/POST /api/business/privacy — the one consent switch for using this
 * business's conversations to improve FollowUp (Business.allowModelTraining;
 * docs/security-roadmap.md, "Training on customer data — the rules").
 *
 * Off by default. Until 2026-09-19 the column existed with nothing in the
 * UI that could turn it on, so no business could ever have said yes. Now
 * Settings → Your data and the onboarding ask both post here. Admin-only,
 * like every other account-wide setting, and audited so the trail shows
 * who flipped it and when.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { allowModelTraining: true } });
  return NextResponse.json({ success: true, allowModelTraining: business?.allowModelTraining ?? false });
}

const schema = z.object({ allowModelTraining: z.boolean() });

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  await prisma.business.update({ where: { id: ctx.businessId }, data: { allowModelTraining: parsed.data.allowModelTraining } });
  void recordAudit(ctx, parsed.data.allowModelTraining ? "business.training.opt_in" : "business.training.opt_out");
  return NextResponse.json({ success: true, allowModelTraining: parsed.data.allowModelTraining });
}
