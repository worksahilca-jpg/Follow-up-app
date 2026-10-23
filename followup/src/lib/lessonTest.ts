import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { withWaitingLessons } from "@/lib/learning";
import { MODEL } from "@/lib/integrations/openaiClient";
import { runReplyTries, tradeLessons, type CaseTries } from "@/lib/replyEval";
import { hasLessonTest, LESSON_TEST_TRIES, summarize, type CaseOutcome } from "@/lib/lessonTestResult";
import { listWaiting, TEST_STALE_MS } from "@/lib/lessonReview";

/**
 * "Test them" (A-319, 2026-10-23). FollowUp writes the kind's test replies (src/lib/replyEval.ts, 20 realtor Instagram
 * messages) LESSON_TEST_TRIES times without the waiting lessons and as many times with them, both halves at once, the
 * way a live reply is written; then compares them message by message (src/lib/lessonTestResult.ts) and keeps the
 * result. About 120 drafts and 120 checks: well under a dollar, and about two minutes. A reply that couldn't be written
 * fails the whole test: a missing reply must never make a lesson look harmless.
 */

/** Five drafts at a time on each side, ten in all. */
export const LESSON_TEST_CONCURRENCY = 5;

export type RunTestResult = { ok: true; id: string } | { ok: false; reason: "no_test" | "nothing" | "running" | "failed"; message?: string };

function outcomes(without: CaseTries[], withLessons: CaseTries[]): CaseOutcome[] {
  return without.map((c, i) => ({
    name: c.name,
    said: c.said,
    without: c.tries.map((t) => ({ reply: t.reply, problems: t.problems, ...(t.error ? { error: t.error } : {}) })),
    with: (withLessons[i]?.tries ?? []).map((t) => ({ reply: t.reply, problems: t.problems, ...(t.error ? { error: t.error } : {}) })),
  }));
}

export async function runLessonTest(trade: string, byUserId: string | null): Promise<RunTestResult> {
  if (!hasLessonTest(trade)) return { ok: false, reason: "no_test" };
  const waiting = await listWaiting(trade);
  if (waiting.length === 0) return { ok: false, reason: "nothing" };
  const busy = await prisma.lessonTest.findFirst({
    where: { trade, status: "running", createdAt: { gt: new Date(Date.now() - TEST_STALE_MS) } },
    select: { id: true },
  });
  if (busy) return { ok: false, reason: "running" };

  const row = await prisma.lessonTest.create({
    data: { trade, lessons: waiting.map((w) => w.key), status: "running", tries: LESSON_TEST_TRIES, model: MODEL, byUserId },
    select: { id: true },
  });
  try {
    const options = { tries: LESSON_TEST_TRIES, concurrency: LESSON_TEST_CONCURRENCY };
    const [without, withLessons] = await Promise.all([
      tradeLessons(trade).then((lessons) => runReplyTries(lessons, options)),
      withWaitingLessons(trade, async () => runReplyTries(await tradeLessons(trade), options)),
    ]);
    const cases = outcomes(without, withLessons);
    const summary = summarize(cases);
    if (summary.errors > 0) {
      const message = `FollowUp couldn't write ${summary.errors} of the ${summary.cases * LESSON_TEST_TRIES * 2} replies. Test again.`;
      await prisma.lessonTest.update({ where: { id: row.id }, data: { status: "failed", cases: summary.cases, error: message, finishedAt: new Date() } });
      return { ok: false, reason: "failed", message };
    }
    await prisma.lessonTest.update({
      where: { id: row.id },
      data: {
        status: "done",
        cases: summary.cases,
        passedWithout: summary.passedWithout,
        passedWith: summary.passedWith,
        better: summary.better,
        worse: summary.worse,
        results: cases as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    console.error(`Lesson test ${row.id} for ${trade} failed:`, err instanceof Error ? err.message : err);
    const message = "The test stopped before it finished. Test again.";
    await prisma.lessonTest.update({ where: { id: row.id }, data: { status: "failed", error: message, finishedAt: new Date() } }).catch(() => {});
    return { ok: false, reason: "failed", message };
  }
}
