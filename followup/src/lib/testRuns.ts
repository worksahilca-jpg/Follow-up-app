import { prisma } from "@/lib/db";
import { estimateCostMicros } from "@/lib/aiDecisionLog";
import { newAiTally, withAiContext, type AiTally } from "@/lib/integrations/openaiClient";
import {
  caseOutcomes,
  isTestId,
  kindOf,
  pickCases,
  readRunAsk,
  runToShow,
  TEST_IDS,
  type CaseOutcome,
  type RunAsk,
  type RunSummary,
  type TestHistory,
  type TestId,
} from "@/lib/testRunMath";

export * from "@/lib/testRunMath";

/**
 * Every run of an accuracy test (Admin → Accuracy tests), kept: night plan A1 + A3 + A4, 2026-10-31
 * (research/product/2026-10-31-make-followup-easy-to-train-and-fix.md).
 *
 * Before this a run showed its score once and kept nothing: a refresh lost it, there was no "better or worse than last
 * time", every run tested every case, and nobody knew the price until the bill (founder, 2026-10-30, after $41 went on
 * tests in one day: "bro thats too much no ??", and then "i dont want to compromise the quality"). So now:
 *  - every run is saved with its score, its failures, the version of FollowUp that ran it, and what it cost (A1);
 *  - the failures can be run again on their own, for cents (A4), and the price shows before anything runs;
 *  - a failure can be checked twice more: it counts as a failure only if it fails 2 times of 3, and a case that both
 *    passes and fails is marked "flaky" so it gets a look instead of a fix (A3).
 *
 * Only invented test cases ever run here. Nothing a customer wrote is stored.
 */

/** Runs a test with every AI call counted (and logged as a test, apart from real customers). */
export async function runCounted<T>(run: () => Promise<T>): Promise<{ result: T; tally: AiTally }> {
  const tally = newAiTally();
  const result = await withAiContext({ tag: "test", tally }, run);
  return { result, tally };
}

/** What the counted calls cost, in millionths of a dollar; null when none of the models used has a known price. */
export function tallyCostMicros(tally: AiTally): number | null {
  let total = 0;
  let priced = false;
  for (const [model, t] of Object.entries(tally.tokens)) {
    const micros = estimateCostMicros(model, t.input, t.output);
    if (micros == null) continue;
    total += micros;
    priced = true;
  }
  return priced ? total : null;
}

/** The deploy's commit, short; nothing locally. */
export const currentVersion = (): string | null => process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null;

/**
 * Saves a run. Never fails the run: a test that finished but couldn't be saved still shows its score (the page says it
 * wasn't kept).
 */
export async function saveTestRun(input: {
  test: TestId;
  ask: RunAsk;
  outcomes: CaseOutcome[];
  errors: number;
  result: unknown;
  tally: AiTally;
}): Promise<RunSummary | null> {
  try {
    const row = await prisma.testRun.create({
      data: {
        test: input.test,
        kind: kindOf(input.ask),
        recheckOf: input.ask.recheckOf,
        version: currentVersion(),
        cases: input.outcomes.length,
        passed: input.outcomes.filter((o) => o.ok).length,
        errors: input.errors,
        ran: input.outcomes.map((o) => o.name),
        failed: input.outcomes.filter((o) => !o.ok).map((o) => o.name),
        calls: input.tally.calls,
        costMicros: tallyCostMicros(input.tally),
        result: JSON.parse(JSON.stringify(input.result ?? null)),
      },
    });
    return toSummary(row);
  } catch (err) {
    console.warn("Accuracy tests: couldn't save a run:", err instanceof Error ? err.message : err);
    return null;
  }
}

type Row = {
  id: string;
  createdAt: Date;
  test: string;
  kind: string;
  recheckOf: string | null;
  version: string | null;
  cases: number;
  passed: number;
  errors: number;
  ran: string[];
  failed: string[];
  costMicros: number | null;
};

function toSummary(row: Row): RunSummary {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    test: (isTestId(row.test) ? row.test : "replies") as TestId,
    kind: row.kind === "only" || row.kind === "recheck" ? row.kind : "full",
    recheckOf: row.recheckOf,
    version: row.version,
    cases: row.cases,
    passed: row.passed,
    errors: row.errors,
    ran: row.ran,
    failed: row.failed,
    costMicros: row.costMicros,
  };
}

/** How many runs of each test the page lists. */
const HISTORY = 15;

/** Every test's recent runs, for /admin/tests. Empty when the table can't be read: the page still runs tests. */
export async function loadTestHistory(): Promise<Record<TestId, TestHistory>> {
  const empty = Object.fromEntries(TEST_IDS.map((t): [TestId, TestHistory] => [t, { runs: [], shown: null }])) as Record<TestId, TestHistory>;
  try {
    const out = { ...empty };
    const lists = await Promise.all(
      TEST_IDS.map((test) =>
        prisma.testRun.findMany({
          where: { test },
          orderBy: { createdAt: "desc" },
          take: HISTORY,
          select: { id: true, createdAt: true, test: true, kind: true, recheckOf: true, version: true, cases: true, passed: true, errors: true, ran: true, failed: true, costMicros: true },
        })
      )
    );
    const showIds: string[] = [];
    TEST_IDS.forEach((test, i) => {
      const runs = lists[i].map(toSummary);
      out[test] = { runs, shown: null };
      const show = runToShow(runs);
      if (show) showIds.push(show.id);
    });
    if (showIds.length) {
      const results = await prisma.testRun.findMany({ where: { id: { in: showIds } }, select: { id: true, test: true, result: true } });
      for (const r of results) if (isTestId(r.test)) out[r.test].shown = { id: r.id, result: r.result };
    }
    return out;
  } catch (err) {
    console.warn("Accuracy tests: couldn't read past runs:", err instanceof Error ? err.message : err);
    return empty;
  }
}


/**
 * One Run button press, start to finish: read what was asked, pick the cases, run them with every call counted, save
 * the run. The routes keep their own locks (founder only, POST only, never from another site); this is what's common.
 */
export async function runTest<C extends { name: string }, R>(
  test: TestId,
  body: unknown,
  all: readonly C[],
  run: (cases: C[]) => Promise<R>,
  errorsOf: (result: R) => number
): Promise<{ ok: true; result: R; saved: RunSummary | null } | { ok: false; error: string }> {
  const ask = readRunAsk(body);
  if ("error" in ask) return { ok: false, error: ask.error };
  const cases = pickCases(all, ask);
  if ("error" in cases) return { ok: false, error: cases.error };
  const { result, tally } = await runCounted(() => run(cases));
  const ran = cases.map((c) => c.name);
  const saved = await saveTestRun({ test, ask, outcomes: caseOutcomes(test, result, ran), errors: errorsOf(result), result, tally });
  return { ok: true, result, saved };
}
