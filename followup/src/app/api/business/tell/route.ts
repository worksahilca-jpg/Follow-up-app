import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { proposeTellCorrection, proposeTellFacts } from "@/lib/integrations/openai";
import { labelKey, MAX_FACTS, MAX_LABEL, MAX_VALUE } from "@/lib/factLines";
import { saveOwnerFact } from "@/lib/businessFacts";
import { NEXT_QUESTION_GAP_MS } from "@/lib/dailyQuestion";
import {
  checkedWording,
  confirmedRows,
  correctionRows,
  currentTopic,
  MAX_ANSWER,
  playbackRows,
  tellRows,
  tellTopic,
  tellTopics,
  type TellState,
} from "@/lib/tellFollowUp";
import { addToDraft, clearDraft, loadTellState, tellPlayback, wordedTopic } from "@/lib/tellFollowUpData";

const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status });

const topic = z.string().trim().min(1).max(MAX_LABEL);
// "Answer them now": the skipped questions are back in the conversation, so the state sent back keeps them.
const again = z.boolean().optional();
const answer = z.string().trim().min(1, "Write your answer first.").max(MAX_ANSWER, `Keep it under ${MAX_ANSWER} characters.`);
// Questions skipped on this visit: with `again` they are still open, and the next question is the one after them.
const setAside = z.array(topic).max(20).optional();
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("answer"),
    topic,
    answer,
    // The words the owner saw (A-313), so the answer is read against them; the plain question when missing.
    question: z.string().trim().max(240).optional(),
    // The answer to FollowUp's one extra question: `previous` is the first answer, and FollowUp doesn't ask again.
    previous: z.string().trim().max(MAX_ANSWER).optional(),
    dug: z.boolean().optional(),
    again,
    setAside,
  }),
  z.object({ action: z.literal("skip"), topic, again, setAside }),
  z.object({ action: z.literal("playback"), again }),
  z.object({ action: z.literal("correct"), text: answer, again }),
  z.object({
    action: z.literal("confirm"),
    // The owner's edits on the play-back, typed by them: a name from the play-back and their new words.
    edits: z.array(z.object({ label: z.string().max(MAX_LABEL), value: z.string().max(MAX_VALUE) })).max(MAX_FACTS).optional(),
    again,
  }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("not_now") }),
]);

/**
 * POST /api/business/tell — "Tell FollowUp about your business", a 5-minute meeting (A-311, A-314;
 * src/lib/tellFollowUp.ts).
 *
 *  - answer: one answer. What FollowUp takes from it waits in the meeting's draft; nothing is quoted to a customer. When
 *    the answer can't help a customer ("depends"), one more question instead (A-313), once per question.
 *  - skip: "Skip this one": left for when a real customer asks (A-101).
 *  - answer and skip reply with the next question, worded for this business (A-313), or, when none is left, the
 *    play-back of the whole business.
 *  - playback: the play-back again (coming back to a meeting that has finished its questions).
 *  - correct: "Anything wrong or missing?": what the owner wrote, taken into the draft, and the play-back again.
 *  - confirm: "Looks right": the draft, with the owner's edits, is saved as facts they typed and used from now on.
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
  // The daily question rests after the meeting, as after any answer (A-101); the card is offered once.
  const rested = { tellCardClosedAt: closed, questionAfter: new Date(now.getTime() + NEXT_QUESTION_GAP_MS) };

  if (body.action === "start" || body.action === "not_now") {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: body.action === "not_now" ? rested : { tellCardClosedAt: closed },
    });
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: body.action } });
    return NextResponse.json({ success: true });
  }

  if (body.action === "playback") {
    const state = await loadTellState(ctx.businessId, body.again);
    if (!state) return fail("Business not found.", 404);
    return NextResponse.json({ success: true, state, playback: await tellPlayback(ctx.businessId, state) });
  }

  if (body.action === "correct" || body.action === "answer") {
    // Reading what the owner wrote costs a model call: it counts toward the business's daily AI ceiling, like a draft.
    const { AI_RUNS_PER_BUSINESS_PER_DAY } = await import("@/lib/scoring");
    if (await tooManyRecentActions(ctx.businessId, "ai.run", AI_RUNS_PER_BUSINESS_PER_DAY)) {
      return fail("FollowUp has done a lot today. Try again tomorrow.", 429);
    }
  }

  if (body.action === "correct") {
    const state = await loadTellState(ctx.businessId, body.again);
    if (!state) return fail("Business not found.", 404);
    const known = playbackRows(state.facts, state.draft, state.topics.map((t) => t.label));
    const labels = [...new Set([...state.topics.map((t) => t.label), ...known.map((r) => r.label)])];
    const proposed = await proposeTellCorrection(body.text, known, labels).catch((err) => {
      console.error(`Could not read a "Tell FollowUp" correction for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
      return null;
    });
    const rows = correctionRows(body.text, proposed, labels);
    if (rows.length === 0) return fail("FollowUp couldn't tell what to change. Tap Edit on the line instead.", 422);
    await addToDraft(ctx.businessId, rows);
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "corrected", facts: rows.length } });
    const after = await loadTellState(ctx.businessId, body.again);
    return NextResponse.json({ success: true, state: after, playback: after ? await tellPlayback(ctx.businessId, after) : null });
  }

  if (body.action === "confirm") {
    const state = await loadTellState(ctx.businessId, body.again);
    if (!state) return fail("Business not found.", 404);
    const rows = confirmedRows(playbackRows(state.facts, state.draft, state.topics.map((t) => t.label)), body.edits ?? []);
    if (!rows) return fail("That changed. Open it again and check.", 400);
    const existing = await prisma.businessFact.findMany({ where: { businessId: ctx.businessId }, select: { label: true } });
    const have = new Set(existing.map((f) => labelKey(f.label)));
    const adding = rows.filter((r) => !have.has(labelKey(r.label))).length;
    if (existing.length + adding > MAX_FACTS) {
      return fail(`FollowUp keeps up to ${MAX_FACTS} things. Remove one in Settings first.`, 409);
    }
    for (const r of rows) await saveOwnerFact(ctx.businessId, r.label, r.value);
    await clearDraft(ctx.businessId);
    await prisma.business.update({ where: { id: ctx.businessId }, data: rested });
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "confirmed", facts: rows.length } });
    return NextResponse.json({ success: true, saved: rows.length });
  }

  // Only the questions this conversation asks: it is not a second way to add any fact.
  const asked = tellTopic(business.industry, body.topic);
  if (!asked) return fail("That question isn't one FollowUp asks.", 400);

  if (body.action === "answer") {
    const labels = tellTopics(business.industry).map((t) => t.label);
    // A hiccup never loses the answer: without the model's reading, the whole answer is kept under the question.
    const proposed = await proposeTellFacts(body.question || asked.question, body.answer, labels, body.previous).catch((err) => {
      console.error(`Could not read a "Tell FollowUp" answer for business ${ctx.businessId}:`, err instanceof Error ? err.message : err);
      return null;
    });
    // One more question when the answer gives a customer nothing to act on, never twice on one question.
    const dig = !body.dug && proposed?.vague ? checkedWording({ question: proposed.dig, example: proposed.digExample }, asked) : null;
    if (dig) return NextResponse.json({ success: true, dig });
    const rows = tellRows(asked, body.answer, proposed, labels);
    if (rows.length === 0) return fail("FollowUp couldn't read that. Try saying it in a sentence or two.", 422);
    await addToDraft(ctx.businessId, rows);
    await prisma.business.update({ where: { id: ctx.businessId }, data: rested });
    void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "answered", facts: rows.length } });
    return NextResponse.json({ success: true, ...(await nextStep(ctx.businessId, body.again, body.setAside)) });
  }

  // skip
  const skipped = business.questionsSkipped.some((l) => labelKey(l) === labelKey(asked.label)) ? business.questionsSkipped : [...business.questionsSkipped, asked.label];
  await prisma.business.update({ where: { id: ctx.businessId }, data: { questionsSkipped: skipped, ...rested } });
  void recordAudit(ctx, "business.tell", { targetType: "business", targetId: ctx.businessId, meta: { decision: "skipped" } });
  return NextResponse.json({ success: true, ...(await nextStep(ctx.businessId, body.again, body.setAside)) });
}

/**
 * Where the meeting is now: its next question worded for this business (A-313), or, with nothing left to ask, the
 * play-back of the whole business (A-314).
 */
async function nextStep(businessId: string, again?: boolean, setAside?: string[]) {
  const state: TellState | null = await loadTellState(businessId, again);
  if (!state) return { state, next: null, playback: null };
  const next = await wordedTopic(businessId, currentTopic(state, setAside), [...state.facts, ...state.draft]);
  return { state, next, playback: next ? null : await tellPlayback(businessId, state) };
}
