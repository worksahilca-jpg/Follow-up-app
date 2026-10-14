import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { readQualification } from "@/lib/qualification";
import { choosePlan, cleanDays, readFollowUpPlans, type FollowUpPlans, type PlanId } from "@/lib/followUpPlans";

/**
 * The follow-up plans (A-245): Fast, Long and the owner's own, for the
 * plans window (/workflows) and the Settings box. GET is for anyone on the
 * account; changing them is an admin's, like every other account setting.
 */

const days = z.array(z.number().int()).max(20);
const bodySchema = z.object({
  // null puts the plan back to its drawn days.
  fast: days.nullable().optional(),
  long: days.nullable().optional(),
  // null deletes My own.
  own: z
    .object({
      days,
      after: z.enum(["stop", "monthly"]),
      useFor: z.enum(["most", "later", "picked"]),
    })
    .nullable()
    .optional(),
});

/** How many open customers each plan has right now ("Used for most customers · 9 now"). */
async function countsFor(businessId: string, plans: FollowUpPlans): Promise<Record<PlanId, number>> {
  const leads = await prisma.lead.findMany({
    where: { businessId, stage: { notIn: ["WON", "LOST"] }, automationTier: { not: "OFF" }, sequenceId: null, saidNoAt: null },
    select: { followUpPlan: true, qualification: true },
  });
  const counts: Record<PlanId, number> = { fast: 0, long: 0, own: 0 };
  for (const l of leads) counts[choosePlan(plans, l.followUpPlan, readQualification(l.qualification)?.tier ?? null)] += 1;
  return counts;
}

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { followUpPlans: true, industry: true, holdAllForApproval: true },
  });
  const plans = readFollowUpPlans(business?.followUpPlans);
  return NextResponse.json({
    success: true,
    plans,
    counts: await countsFor(ctx.businessId, plans),
    realtor: /real ?estate|realtor|realty/i.test(business?.industry ?? ""),
    holdAll: business?.holdAllForApproval ?? true,
    isAdmin: await requireAdmin(ctx),
  });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change the plans." }, { status: 403 });
  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { followUpPlans: true } });
  const next: FollowUpPlans = { ...readFollowUpPlans(business?.followUpPlans) };
  const body = parsed.data;
  for (const key of ["fast", "long"] as const) {
    if (body[key] === undefined) continue;
    if (body[key] === null) {
      delete next[key];
      continue;
    }
    const cleaned = cleanDays(body[key]);
    if (!cleaned) return NextResponse.json({ success: false, message: "Pick at least one day between 1 and 45." }, { status: 400 });
    next[key] = cleaned;
  }
  if (body.own === null) delete next.own;
  else if (body.own) {
    const cleaned = cleanDays(body.own.days);
    if (!cleaned) return NextResponse.json({ success: false, message: "Pick at least one day between 1 and 45." }, { status: 400 });
    next.own = { days: cleaned, after: body.own.after, useFor: body.own.useFor };
  }

  const stored = Object.keys(next).length ? (next as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
  await prisma.business.update({ where: { id: ctx.businessId }, data: { followUpPlans: stored } });
  void recordAudit(ctx, "automation.plans.changed", { meta: { fast: next.fast ?? null, long: next.long ?? null, own: next.own ?? null } });
  return NextResponse.json({ success: true, plans: next, counts: await countsFor(ctx.businessId, next) });
}
