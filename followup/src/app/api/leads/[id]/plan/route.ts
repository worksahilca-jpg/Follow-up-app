import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { readFollowUpPlans } from "@/lib/followUpPlans";
import { sendRefusal } from "@/lib/sendingControl";
import { ownerStopsStaying } from "@/lib/stayInTouchData";
import { ownerSetsMoment } from "@/lib/theirMomentData";

/**
 * "Change plan" on a customer's page (A-245): put this one customer on
 * Fast, Long or My own, or hand the choice back to FollowUp (null). It can
 * also stop waiting for the day they asked for ("Don't wait"), when the
 * owner knows better. Either way it only changes what FollowUp sends on its
 * own; replies to the customer are untouched. For a customer staying in
 * touch (A-260), `stayInTouch: false` stops the notes: nothing more is
 * written to them unless they write.
 */
const schema = z.object({
  plan: z.enum(["fast", "long", "own"]).nullable().optional(),
  stopWaiting: z.literal(true).optional(),
  stayInTouch: z.literal(false).optional(),
  // "Their moment" (A-262): another day ("YYYY-MM-DD"), or null for none.
  moment: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const lead = await prisma.lead.findFirst({ where: { id, businessId: ctx.businessId }, select: { id: true } });
  if (!lead) return NextResponse.json({ success: false, message: "Customer not found." }, { status: 404 });

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { plan, stopWaiting, stayInTouch, moment } = parsed.data;
  if (stayInTouch === false) {
    await ownerStopsStaying(ctx.businessId, lead.id, ctx.userId);
    return NextResponse.json({ success: true });
  }
  if (moment !== undefined) {
    const at = moment === null ? null : new Date(`${moment}T12:00:00Z`);
    if (at && (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 86_400_000)) {
      return NextResponse.json({ success: false, message: "Pick a day ahead." }, { status: 400 });
    }
    await ownerSetsMoment(ctx.businessId, lead.id, ctx.userId, at);
    return NextResponse.json({ success: true });
  }
  if (plan === undefined && !stopWaiting) return NextResponse.json({ success: false, message: "Nothing to change." }, { status: 400 });

  // Not waiting any more can make a message go sooner, so with "Only admins
  // send" (A-041) on, it is an admin's call, like turning a customer on.
  if (stopWaiting && (await sendRefusal(ctx.businessId, ctx.userId))) {
    return NextResponse.json({ success: false, message: "Only admins send on this account, so only an admin can change this." }, { status: 403 });
  }

  if (plan === "own") {
    const business = await prisma.business.findUnique({ where: { id: ctx.businessId }, select: { followUpPlans: true } });
    if (!readFollowUpPlans(business?.followUpPlans).own) {
      return NextResponse.json({ success: false, message: "Set up your own plan first, on the plans page." }, { status: 400 });
    }
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      ...(plan !== undefined ? { followUpPlan: plan } : {}),
      ...(stopWaiting ? { followUpNotBefore: null } : {}),
    },
  });
  void recordAudit(ctx, "lead.plan.changed", { targetType: "lead", targetId: lead.id, meta: { plan: plan ?? null, stopWaiting: Boolean(stopWaiting) } });
  return NextResponse.json({ success: true });
}
