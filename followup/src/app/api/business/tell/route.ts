import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { proposeTellFacts } from "@/lib/integrations/openai";
import { labelKey, MAX_FACTS, MAX_LABEL, MAX_VALUE } from "@/lib/factLines";
import { saveOwnerFact } from "@/lib/businessFacts";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";
import { checkedRows, checkedWording, currentTopic, MAX_ANSWER, MAX_ROWS, tellRows, tellTopic, tellTopics } from "@/lib/tellFollowUp";
import { loadTellState, wordedTopic } from "@/lib/tellFollowUpData";

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

const topic = z.string().trim().min(1).max(MAX_LABEL);
// "Answer them now": the skipped questions are back in the conversation, so the state sent back keeps them.
const again = z.boolean().optional();
const answer = z.string().trim().min(1, "Write your answer first.").max(MAX_ANSWER, `Keep it under ${MAX_ANSWER} characters.`);
// Questions skipped on this visit: with `again` they are still open, and the next question is the one after them.
const setAside = z.array(topic).max(20).optional();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("read"),
    topic,
    answer,
    // The words the owner saw (A-313), so the answer is read against them; the plain question when missing.
    question: z.string().trim().max(240).optional(),
    // The answer to FollowUp's one extra question: `previous` is the first answer, and FollowUp doesn't ask again.
    previous: z.string().trim().max(MAX_ANSWER).optional(),
    dug: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("use"),
    topic,
    answer,
    rows: z.array(z.object({ label: z.string().max(MAX_LABEL), value: z.string().max(MAX_VALUE) })).min(1).max(MAX_ROWS),
    again,
    setAside,
  }),
  z.object({ action: z.literal("skip"), topic, again, setAside }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("not_now") }),
]);

/**
 * POST /api/business/tell — "Tell FollowUp about your business" (A-311, src/lib/tellFollowUp.ts).
 *
 *  - read: what FollowUp took from one answer, to show the owner. Saves nothing. When the answer can't help a
 *    customer ("depends"), one more question instead (A-313), once per question.
 *  - use: the owner said "Use these": each row is saved as a fact they typed, used in replies from now on.
 *  - skip: "Skip this one": left for when a real customer asks (A-101).
 *  - use and skip answer with the next question, worded for this business when FollowUp can (A-313).
 *  - start / not_now: the card on Today was answered; it is offered once. "Not now" also rests the daily question.
 *
 * Admin only, like every fact, because answers go into replies sent in the business's name. Audited without the
 * words themselves.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return fail("Not signed in.", 401);
  if (!(await requireAdmin(ctx))) return fail("Only an admin can teach FollowUp about the business.", 403);
  if (await tooManyRecentActions(ctx.businessId, "business.tell", { windowMinutes: 60, max: 80 })) {
    return fail("Too many changes. Wait a few minutes and try again.", 429);
  }
  const parsed = await parseJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { industry: true, questionsSkipped: true, tellCardClosedAt: true },
  });
  if (!business) return fail("Business not found.", 404);
  const now = new Date();
  const closed = business.tellCardClosedAt ?? now;

  if (body.action === "start" || body.action === "not_now") {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: body.action === "not_now" ? { tellCardClosedAt: closed, questionAfter: new Date(now.getTime() + NEXT_QUESTION_GAP_MS) } : { tellCardClosedAt: closed },
    });
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: body.action } });
    return NextResponse.json({ success: true });
  }

  // Only the questions this conversation asks: it is not a second way to add any fact.
  const asked = tellTopic(business.industry, body.topic);
  if (!asked) return fail("That question isn't one FollowUp asks.", 400);

  if (body.action === "read") {
    // Reading an answer costs a model call: it counts toward the business's daily AI ceiling, like a draft.
    const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
    if (await tooManyRecentActions(ctx.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) {
      return fail("FollowUp has done a lot today. Try again tomorrow.", 429);
    }
    const labels = tellTopics(business.industry).map((t) => t.label);
    // A hiccup never loses the answer: without the model's reading, the whole answer is shown under the question.
    const proposed = await proposeTellFacts(body.question || asked.question, body.answer, labels, body.previous).catch((err) => {
      console.error(`Could not read a "Tell FollowUp" answer for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
      return null;
    });
    // One more question when the answer gives a customer nothing to act on, never twice on one question.
    const dig = !body.dug && proposed?.vague ? checkedWording({ question: proposed.dig, example: proposed.digExample }, asked) : null;
    if (dig) return NextResponse.json({ success: true, dig });
    const rows = tellRows(asked, body.answer, proposed, labels);
    if (rows.length === 0) return fail("FollowUp couldn't read that. Try saying it in a sentence or two.", 422);
    return NextResponse.json({ success: true, rows });
  }

  if (body.action === "use") {
    const rows = checkedRows(asked, body.answer, body.rows);
    if (!rows) return fail("That changed. Send your answer again.", 400);
    const existing = await prisma.businessFact.findMany({ where: { businessId: ctx.businessId }, select: { label: true } });
    const have = new Set(existing.map((f) => labelKey(f.label)));
    const adding = rows.filter((r) => !have.has(labelKey(r.label))).length;
    if (existing.length + adding > MAX_FACTS) {
      return fail(`FollowUp keeps up to ${MAX_FACTS} things. Remove one in Settings first.`, 409);
    }
    for (const r of rows) await saveOwnerFact(ctx.businessId, r.label, r.value);
    // The daily question rests after a conversation, as after any answer (A-101).
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: { tellCardClosedAt: closed, questionAfter: new Date(now.getTime() + NEXT_QUESTION_GAP_MS) },
    });
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "used", facts: rows.length } });
    return NextResponse.json({ success: true, ...(await nextStep(ctx.businessId, body.again, body.setAside)) });
  }

  // skip
  const skipped = business.questionsSkipped.some((l) => labelKey(l) === labelKey(asked.label)) ? business.questionsSkipped : [...business.questionsSkipped, asked.label];
  await prisma.business.update({
    where: { id: ctx.businessId },
    data: { questionsSkipped: skipped, tellCardClosedAt: closed, questionAfter: new Date(now.getTime() + NEXT_QUESTION_GAP_MS) },
  });
  void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "skipped" } });
  return NextResponse.json({ success: true, ...(await nextStep(ctx.businessId, body.again, body.setAside)) });
}

/** Where the conversation is now, and its next question worded for this business (A-313). */
async function nextStep(businessId: string, again?: boolean, setAside?: string[]) {
  const state = await loadTellState(businessId, again);
  const next = state ? await wordedTopic(businessId, currentTopic(state, setAside), state.facts) : null;
  return { state, next };
}
