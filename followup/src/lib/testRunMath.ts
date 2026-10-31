/**
 * The arithmetic of saved accuracy-test runs (src/lib/testRuns.ts saves them), kept apart from the database so the
 * page can use it in the browser: which cases a run uses, pass or fail per case, the price before a run, what changed
 * since the last one, and the 2-of-3 rule for a failure checked twice more. Night plan A1 + A3 + A4, 2026-10-31.
 */

export const TEST_IDS = ["email-check", "dm-check", "qualifying", "replies", "conversations", "replies-gpt-5.4-mini", "replies-gpt-5.4"] as const;
export type TestId = (typeof TEST_IDS)[number];

export const isTestId = (v: unknown): v is TestId => typeof v === "string" && (TEST_IDS as readonly string[]).includes(v);

/**
 * What one whole run costs, before any run of it has been saved. From the decision log, Oct 29–31 2026: the calls one
 * run makes times what each kind of call cost on average then (an email sort about 1¢, a reply written about 2.3¢, a
 * checklist read about 2.1¢, a conversation grade about 1.6¢). A guess until the first saved run replaces it.
 */
export const FIRST_ESTIMATE_MICROS: Record<TestId, number> = {
  "email-check": 1_600_000,
  "dm-check": 600_000,
  qualifying: 1_300_000,
  replies: 900_000,
  conversations: 3_000_000,
  "replies-gpt-5.4-mini": 150_000,
  "replies-gpt-5.4": 450_000,
};

export type RunKind = "full" | "only" | "recheck";

/** What the Run buttons send. Nothing: every case. `only`: just these cases. `repeat` 2: each of them twice (a recheck). */
export type RunAsk = { only: string[] | null; repeat: number; recheckOf: string | null };

const MAX_NAMES = 300;
const MAX_NAME = 300;

/** Reads a Run button's request. Anything odd is refused rather than guessed at: each run is paid model calls. */
export function readRunAsk(body: unknown): RunAsk | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  let only: string[] | null = null;
  if (b.only !== undefined && b.only !== null) {
    if (!Array.isArray(b.only) || b.only.length === 0 || b.only.length > MAX_NAMES || !b.only.every((n) => typeof n === "string" && n.length > 0 && n.length <= MAX_NAME)) {
      return { error: "Name the tests to run again as a list." };
    }
    only = [...new Set(b.only as string[])];
  }
  const repeat = b.repeat === undefined ? 1 : b.repeat;
  if (repeat !== 1 && repeat !== 2) return { error: "A test can be run once or twice." };
  if (repeat === 2 && !only) return { error: "Only failed tests are checked twice." };
  const recheckOf = typeof b.recheckOf === "string" && b.recheckOf.length > 0 && b.recheckOf.length <= 40 ? b.recheckOf : null;
  if (repeat === 2 && !recheckOf) return { error: "A recheck needs the run it checks." };
  return { only, repeat, recheckOf };
}

export const kindOf = (ask: RunAsk): RunKind => (ask.repeat === 2 ? "recheck" : ask.only ? "only" : "full");

/** The separator a repeated case's name carries ("Day 3 on Instagram · try 2"), so its result can't be mixed up. */
const TRY = " · try ";

export function baseName(name: string): string {
  const at = name.lastIndexOf(TRY);
  return at === -1 ? name : name.slice(0, at);
}

/**
 * The cases a run should use: all of them, only the named ones, or the named ones once per try. A name that no longer
 * exists (a case renamed since) is skipped; none left is an error, not an empty run.
 */
export function pickCases<C extends { name: string }>(all: readonly C[], ask: RunAsk): C[] | { error: string } {
  if (!ask.only) return [...all];
  const wanted = new Set(ask.only);
  const picked = all.filter((c) => wanted.has(c.name));
  if (picked.length === 0) return { error: "None of those tests exist any more. Run the whole test instead." };
  if (ask.repeat === 1) return picked;
  return picked.flatMap((c) => Array.from({ length: ask.repeat }, (_, t) => ({ ...c, name: `${c.name}${TRY}${t + 1}` })));
}

export type CaseOutcome = { name: string; ok: boolean };

type Named = { name?: unknown };
const failedNames = (list: unknown): Set<string> =>
  new Set((Array.isArray(list) ? (list as Named[]) : []).map((f) => (typeof f?.name === "string" ? f.name : "")).filter(Boolean));

/**
 * Pass or fail per case, the same for every test: the tests report their failures in their own shapes. A case that
 * couldn't run (a rate limit, no credit) counts as not passed, so "run what failed" runs it again.
 */
export function caseOutcomes(test: TestId, result: unknown, ran: readonly string[]): CaseOutcome[] {
  const r = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  if (test === "conversations") {
    const chats = (Array.isArray(r.chats) ? r.chats : []) as { name?: unknown; problems?: unknown; error?: unknown }[];
    const bad = new Set(chats.filter((c) => c.error || (Array.isArray(c.problems) && c.problems.length > 0)).map((c) => String(c.name)));
    const seen = new Set(chats.map((c) => String(c.name)));
    return ran.map((name) => ({ name, ok: seen.has(name) && !bad.has(name) }));
  }
  // The email check, the DM check, qualifying and the reply tests all list what went wrong by case name.
  const bad = failedNames(r.failures);
  return ran.map((name) => ({ name, ok: !bad.has(name) }));
}

/** A saved run as the page shows it: everything but the full result. */
export type RunSummary = {
  id: string;
  createdAt: string;
  test: TestId;
  kind: RunKind;
  recheckOf: string | null;
  version: string | null;
  cases: number;
  passed: number;
  errors: number;
  ran: string[];
  failed: string[];
  costMicros: number | null;
};

/** What the page opens with for one test: its recent runs (newest first) and the full result of the one to show. */
export type TestHistory = { runs: RunSummary[]; shown: { id: string; result: unknown } | null };

/** The run a page should show: the newest that isn't a recheck (a recheck is shown with the run it checked). */
export function runToShow(runs: readonly RunSummary[]): RunSummary | null {
  return runs.find((r) => r.kind !== "recheck") ?? null;
}

/**
 * About what running `count` cases of a test will cost: the newest saved whole run's price per case, or the first
 * estimate before there is one. Times `repeat` for a recheck.
 */
export function estimateRunMicros(test: TestId, runs: readonly RunSummary[], totalCases: number, count: number, repeat = 1): number {
  const priced = runs.find((r) => r.costMicros != null && r.cases > 0 && r.kind === "full") ?? runs.find((r) => r.costMicros != null && r.cases > 0);
  const perCase = priced ? (priced.costMicros as number) / priced.cases : FIRST_ESTIMATE_MICROS[test] / Math.max(1, totalCases);
  return Math.round(perCase * count * repeat);
}

/** "about $2.70"; "under 1¢" for almost nothing. */
export function priceWords(micros: number): string {
  if (micros < 10_000) return "under 1¢";
  return `about $${(micros / 1_000_000).toFixed(2)}`;
}

/** A run against the one before it of the same test: what started passing, what started failing. */
export type Change = { before: RunSummary; nowPassing: string[]; nowFailing: string[] };

/**
 * Compared case by case with the newest earlier run that ran those cases (a recheck compares with nothing: its case
 * names carry tries). Only cases both runs ran are compared.
 */
export function compareWithBefore(run: RunSummary, earlier: readonly RunSummary[]): Change | null {
  if (run.kind === "recheck") return null;
  const before = earlier.find((r) => r.id !== run.id && r.kind !== "recheck" && r.createdAt < run.createdAt && r.ran.some((n) => run.ran.includes(n)));
  if (!before) return null;
  const ranBefore = new Set(before.ran);
  const failedBefore = new Set(before.failed);
  const failedNow = new Set(run.failed);
  const both = run.ran.filter((n) => ranBefore.has(n));
  return {
    before,
    nowPassing: both.filter((n) => failedBefore.has(n) && !failedNow.has(n)),
    nowFailing: both.filter((n) => !failedBefore.has(n) && failedNow.has(n)),
  };
}

/** What a recheck decided about each failure it ran twice more (the 2-of-3 rule, A3). */
export type Steady = {
  /** Failed again at least once more: failed 2 or 3 times of 3. Real. */
  stillFailing: string[];
  /** Passed both tries: failed 1 time of 3, so it counts as passing, marked flaky. */
  passedOnRetry: string[];
  /** Passed at least once and failed at least twice: still a failure, but not every time. */
  flaky: string[];
};

export function steadyVerdict(recheck: RunSummary): Steady {
  const tries = new Map<string, { passed: number; failed: number }>();
  const failed = new Set(recheck.failed);
  for (const name of recheck.ran) {
    const t = tries.get(baseName(name)) ?? { passed: 0, failed: 0 };
    if (failed.has(name)) t.failed += 1;
    else t.passed += 1;
    tries.set(baseName(name), t);
  }
  const out: Steady = { stillFailing: [], passedOnRetry: [], flaky: [] };
  for (const [name, t] of tries) {
    if (t.failed === 0) out.passedOnRetry.push(name);
    else {
      out.stillFailing.push(name);
      if (t.passed > 0) out.flaky.push(name);
    }
  }
  return out;
}

/**
 * Cases that both passed and failed on the same version of FollowUp, in its saved runs: the AI or the checker varies
 * on them, so a fail there is a reason to look, not proof. Free: no new calls.
 */
export function flakyOnVersion(runs: readonly RunSummary[], version: string | null): string[] {
  if (!version) return [];
  const seen = new Map<string, { passed: boolean; failed: boolean }>();
  for (const r of runs) {
    if (r.version !== version) continue;
    const failed = new Set(r.failed);
    for (const raw of r.ran) {
      const name = baseName(raw);
      const s = seen.get(name) ?? { passed: false, failed: false };
      if (failed.has(raw)) s.failed = true;
      else s.passed = true;
      seen.set(name, s);
    }
  }
  return [...seen].filter(([, s]) => s.passed && s.failed).map(([n]) => n);
}
