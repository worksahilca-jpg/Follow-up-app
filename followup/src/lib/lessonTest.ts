import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { WAITING_STATUS, withWaitingLessons } from "@/lib/learning";
import { MODEL } from "@/lib/integrations/openaiClient";
import { REPLY_CASES, runReplyTries, tradeLessons, type CaseTries } from "@/lib/replyEval";
import { chanceSummary, hasLessonTest, LESSON_TEST_TRIES, summarize, type CaseOutcome, type TryOutcome } from "@/lib/lessonTestResult";
import { listWaiting, TEST_STALE_MS } from "@/lib/lessonReview";
import { targetedCases } from "@/lib/ruleTestMessages";

/**
 * "Test them" (A-319, 2026-10-23). FollowUp writes the kind's test replies (src/lib/replyEval.ts, 20 realtor Instagram
 * messages) LESSON_TEST_TRIES times without the waiting lessons and as many times with them, both halves at once, the
 * way a live reply is written; then compares them message by message (src/lib/lessonTestResult.ts) and keeps the
 * result. About 120 drafts and 120 checks: well under a dollar, and about two minutes. A reply that couldn't be written
 * fails the whole test: a missing reply must never make a lesson look harmless.
 *
 * Plan step 3 (2026-10-23): up to three waiting rules also get messages written for them (src/lib/ruleTestMessages.ts),
 * answered the same way, each read against its rule too. And when this kind has no chance check for the model in use
 * from the last CHANCE_FRESH_MS, the fixed messages are answered a third time without the lessons, alongside: how many
 * come out differently on their own is kept as a "chance" row and shown with every test after it.
 */

/** Five drafts at a time on each side, ten in all (fifteen with the chance check). */
export const LESSON_TEST_CONCURRENCY = 5;

/** A chance check counts for this long, for the model it ran on; then the next test runs a new one. */
export const CHANCE_FRESH_MS = 30 * 24 * 60 * 60_000;

export type RunTestResult = { ok: true; id: string } | { ok: false; reason: "no_test" | "nothing" | "running" | "failed"; message?: string };

function tryOutcomes(c: CaseTries | undefined): TryOutcome[] {
  return (c?.tries ?? []).map((t) => ({ reply: t.reply, problems: t.problems, hard: t.hard, ...(t.error ? { error: t.error } : {}) }));
}

function outcomes(without: CaseTries[], withLessons: CaseTries[]): CaseOutcome[] {
  return without.map((c, i) => ({
    name: c.name,
    said: c.said,
    ...(c.rule ? { rule: c.rule } : {}),
    without: tryOutcomes(c),
    with: tryOutcomes(withLessons[i]),
  }));
}

/** Whether this kind needs a chance check: none yet for the model in use, or the last one is too old. */
async function needsChanceCheck(trade: string): Promise<boolean> {
  const last = await prisma.lessonTest.findFirst({
    where: { trade, kind: "chance", status: "done", model: MODEL, createdAt: { gt: new Date(Date.now() - CHANCE_FRESH_MS) } },
    select: { id: true },
  });
  return !last;
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
    // The waiting rules, in the order they were taught, with the messages kept for their wording.
    const ruleIds = waiting.filter((w) => w.kind === "rule").map((w) => w.id);
    const rules = ruleIds.length
      ? await prisma.trainingRule.findMany({ where: { id: { in: ruleIds }, status: WAITING_STATUS }, select: { id: true, text: true, version: true, testMessages: true } })
      : [];
    const [targeted, chance] = await Promise.all([
      targetedCases(trade, ruleIds.map((id) => rules.find((r) => r.id === id)).filter((r): r is (typeof rules)[number] => !!r)),
      needsChanceCheck(trade),
    ]);
    const testCases = [...REPLY_CASES, ...targeted];
    const options = { tries: LESSON_TEST_TRIES, concurrency: LESSON_TEST_CONCURRENCY, cases: testCases };
    const [without, withLessons, again] = await Promise.all([
      tradeLessons(trade).then((lessons) => runReplyTries(lessons, options)),
      withWaitingLessons(trade, async () => runReplyTries(await tradeLessons(trade), options)),
      chance ? tradeLessons(trade).then((lessons) => runReplyTries(lessons, { ...options, cases: REPLY_CASES })) : Promise.resolve(null),
    ]);
    if (again) await saveChanceCheck(trade, without.slice(0, REPLY_CASES.length), again, byUserId);
    const cases = outcomes(without, withLessons);
    const summary = summarize(cases);
    if (summary.errors > 0) {
      const message = `FollowUp couldn't write ${summary.errors} of the ${(summary.cases + summary.targeted) * LESSON_TEST_TRIES * 2} replies. Test again.`;
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
        blocked: summary.blocked,
        targeted: summary.targeted,
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

/**
 * Keeps the chance check: the fixed messages answered twice with nothing changed. One that lost a reply isn't kept (the
 * next test runs another); it never fails the lesson test it ran beside.
 */
async function saveChanceCheck(trade: string, first: CaseTries[], second: CaseTries[], byUserId: string | null): Promise<void> {
  const chance = chanceSummary(first.map(tryOutcomes), second.map(tryOutcomes));
  if (chance.errors > 0) return;
  await prisma.lessonTest
    .create({
      data: {
        trade,
        kind: "chance",
        lessons: [],
        status: "done",
        tries: LESSON_TEST_TRIES,
        cases: chance.cases,
        better: chance.up,
        worse: chance.down,
        model: MODEL,
        byUserId,
        finishedAt: new Date(),
      },
    })
    .catch((err) => console.warn(`Couldn't keep the chance check for ${trade}:`, err instanceof Error ? err.message : err));
}
