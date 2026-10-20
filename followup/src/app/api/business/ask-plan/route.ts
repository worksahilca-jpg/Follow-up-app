import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { proposeAskPlan } from "@/lib/integrations/openai";
import { ASK_PLAN_LABEL, MAX_WORDS, finishPlan, followUpOrder, readAskPlan, reorderPlan } from "@/lib/askPlan";
import { templateFor } from "@/lib/qualification";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

/**
 * GET /api/business/ask-plan — for "What FollowUp asks" and its row in Settings: whether this business has the
 * checklist at all (real estate), the owner's questions if any, and FollowUp's own order to show before them.
 */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  const [business, isAdmin] = await Promise.all([
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { industry: true, askPlan: true } }),
    requireAdmin(ctx),
  ]);
  if (!business) return fail("Business not found.", 404);
  const template = templateFor(business.industry);
  return NextResponse.json({
    success: true,
    realtor: Boolean(template),
    isAdmin,
    plan: template ? readAskPlan(business.askPlan) : null,
    followUpOrder: template ? followUpOrder(template.rounds.buy) : [],
  });
}

/**
 * POST /api/business/ask-plan — what the owner asks a new buyer, in their own words and order (A-302,
 * src/lib/askPlan.ts).
 *
 *  - { words }: FollowUp reads them into the owner's questions and keeps them. From the one-question card on Today
 *    (A-101) or "Change your words".
 *  - { notNow: true }: the card's "Not now". The question isn't asked again.
 *  - { order }: the owner dragged the questions into a new order.
 *  - { clear: true }: "Use FollowUp's order instead".
 *
 * Admin only: these questions go to customers in the business's name. Real estate only, the one line of work with a
 * checklist. Audited without the words themselves.
 */
const schema = z.union([
  z.object({ words: z.string().trim().min(1, "Write what you ask, then save.").max(MAX_WORDS, `Keep it under ${MAX_WORDS} characters.`) }),
  z.object({ notNow: z.literal(true) }),
  z.object({ order: z.array(z.string().max(60)).min(1).max(20) }),
  z.object({ clear: z.literal(true) }),
]);


export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  if (!(await requireAdmin(ctx))) return fail("Only an admin can change this.", 403);
  if (await tooManyRecentActions(ctx.businessId, "business.askPlan", { windowMinutes: 60, max: 30 })) {
    return fail("Too many changes. Wait a few minutes and try again.", 429);
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { industry: true, askPlan: true, questionsSkipped: true },
  });
  if (!business) return fail("Business not found.", 404);
  if (!templateFor(business.industry)) return fail("This is for realtors for now.", 400);
  const next = new Date(Date.now() + NEXT_QUESTION_GAP_MS);

  if ("notNow" in body) {
    const skipped = business.questionsSkipped.includes(ASK_PLAN_LABEL) ? business.questionsSkipped : [...business.questionsSkipped, ASK_PLAN_LABEL];
    await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: next, questionsSkipped: skipped } });
    void recordAudit(ctx, "business.ask_plan", { targetType: "business", targetId: ctx.businessId, meta: { decision: "not_now" } });
    return NextResponse.json({ success: true });
  }

  if ("clear" in body) {
    await prisma.business.update({ where: { id: ctx.businessId }, data: { askPlan: Prisma.DbNull } });
    void recordAudit(ctx, "business.ask_plan", { targetType: "business", targetId: ctx.businessId, meta: { decision: "followup_order" } });
    return NextResponse.json({ success: true, plan: null });
  }

  if ("order" in body) {
    const current = readAskPlan(business.askPlan);
    const moved = current ? reorderPlan(current, body.order) : null;
    if (!moved) return fail("Those questions changed. Reload the page and try again.", 409);
    await prisma.business.update({ where: { id: ctx.businessId }, data: { askPlan: moved as unknown as Prisma.InputJsonValue } });
    void recordAudit(ctx, "business.ask_plan", { targetType: "business", targetId: ctx.businessId, meta: { decision: "reordered" } });
    return NextResponse.json({ success: true, plan: moved });
  }

  // Reading the words costs a model call: it counts toward the business's daily AI ceiling, like a draft.
  const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
  if (await tooManyRecentActions(ctx.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) {
    return fail("FollowUp has done a lot today. Try again tomorrow.", 429);
  }
  const proposed = await proposeAskPlan(body.words).catch((err) => {
    console.error(`Could not read the ask plan for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
    return null;
  });
  if (!proposed) return fail("FollowUp couldn't read that just now. Try again in a minute.", 503);
  const plan = finishPlan(body.words, proposed);
  if (!plan) return fail("FollowUp couldn't find questions in that. Write what you ask a new buyer, in order.", 422);

  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { askPlan: plan as unknown as Prisma.InputJsonValue, questionAfter: next },
  });
  void recordAudit(ctx, "business.ask_plan", {
    targetType: "business",
    targetId: ctx.businessId,
    meta: { decision: "made", questions: plan.steps.length, forCall: plan.forCall.length },
  });
  return NextResponse.json({ success: true, plan });
}
