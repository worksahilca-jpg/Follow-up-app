import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { MAX_FACTS, MAX_LABEL, MAX_VALUE } from "@/lib/factLines";
import { saveOwnerFact } from "@/lib/businessFacts";
import { isAskableLabel, NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";

/**
 * POST /api/business/question — the one question a day on Today (A-101,
 * src/lib/dailyQuestion.ts).
 *
 * { label, answer } saves the answer as a fact the owner typed;
 * { label } with no answer is "Not now", and that question is left for
 * when a real customer asks it. Either way the next question waits about a
 * day. Admin only, like every fact, because an answer goes into replies
 * sent in the business's name. Audited without the words themselves.
 */
const schema = z.object({
  label: z.string().trim().min(1).max(MAX_LABEL),
  answer: z.string().trim().max(MAX_VALUE, `Keep it under ${MAX_VALUE} characters.`).optional(),
});

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can change this." }, { status: 403 });
  if (await tooManyRecentActions(ctx.businessId, "business.question", { windowMinutes: 60, max: 60 })) {
    return NextResponse.json({ success: false, message: "Too many changes. Wait a few minutes and try again." }, { status: 429 });
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { label, answer } = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { industry: true, questionsSkipped: true },
  });
  if (!business) return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });
  // Only the questions this card can ask: it is not a second way to add any fact.
  if (!isAskableLabel(business.industry, label)) {
    return NextResponse.json({ success: false, message: "That question isn't one FollowUp asks." }, { status: 400 });
  }

  const next = new Date(Date.now() + NEXT_QUESTION_GAP_MS);
  if (answer) {
    const fact = await saveOwnerFact(ctx.businessId, label, answer);
    if (!fact) {
      return NextResponse.json({ success: false, message: `FollowUp keeps up to ${MAX_FACTS}. Remove one in Settings first.` }, { status: 409 });
    }
    await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: next } });
    void recordAudit(ctx, "business.question", { targetType: "business_fact", targetId: fact.id, meta: { decision: "answered" } });
    return NextResponse.json({ success: true });
  }

  const skipped = business.questionsSkipped.includes(label) ? business.questionsSkipped : [...business.questionsSkipped, label];
  await prisma.business.update({ where: { id: ctx.businessId }, data: { questionAfter: next, questionsSkipped: skipped } });
  void recordAudit(ctx, "business.question", { targetType: "business", targetId: ctx.businessId, meta: { decision: "not_now" } });
  return NextResponse.json({ success: true });
}
