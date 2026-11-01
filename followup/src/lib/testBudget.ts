import { prisma } from "@/lib/db";

/**
 * A daily limit on what tests may spend on the AI, so tests can never use up the credit real customers need.
 *
 * Oct 30, 2026: the accuracy tests spent about $41 in one day while real customers used under $1 in seven, the OpenAI
 * credit ran out, and from then on no customer was answered (research: reports/FollowUp right track check.md, change 1).
 * Every AI call made under the "test" tag (accuracy tests, Train's lesson tests and their practice messages) counts
 * against this limit; real customers' calls never do and are never stopped by it.
 *
 * The limit is $10 over the last 24 hours, or TEST_DAILY_BUDGET_USD when that is set to a positive number.
 */

const DEFAULT_USD = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000;
/** How long a spend total is reused before the database is asked again, so a run of many calls asks rarely. */
const CACHE_MS = 30_000;

export function testBudgetMicros(): number {
  const usd = Number(process.env.TEST_DAILY_BUDGET_USD);
  return Math.round((Number.isFinite(usd) && usd > 0 ? usd : DEFAULT_USD) * 1_000_000);
}

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/**
 * Pure: why a test can't run now, or null when it can. `estimate` is what the run is expected to cost (0 for a single
 * call, which is stopped only once the limit is reached).
 */
export function budgetVerdict(spent: number, estimate: number, budget: number): string | null {
  if (spent >= budget) {
    return `Tests have used today's limit (${dollars(budget)} in 24 hours), so real customers' replies keep the credit. Try again tomorrow.`;
  }
  if (estimate > 0 && spent + estimate > budget) {
    return `This would cost ${dollars(estimate)}, and only ${dollars(budget - spent)} of today's ${dollars(budget)} test limit is left. Run only what failed, or try again tomorrow.`;
  }
  return null;
}

let cached: { at: number; micros: number } | null = null;

/** What tests spent on the AI in the last 24 hours, in millionths of a dollar. */
export async function testSpentMicros(now = Date.now(), fresh = false): Promise<number> {
  if (!fresh && cached && now - cached.at < CACHE_MS) return cached.micros;
  const out = await prisma.aiDecision.aggregate({
    where: { purpose: { startsWith: "test:" }, createdAt: { gte: new Date(now - WINDOW_MS) } },
    _sum: { costMicros: true },
  });
  cached = { at: now, micros: out._sum.costMicros ?? 0 };
  return cached.micros;
}

/** Before a test run: can it run, given what it should cost? Reads the latest total. */
export async function checkTestBudget(estimate: number): Promise<string | null> {
  return budgetVerdict(await testSpentMicros(Date.now(), true), estimate, testBudgetMicros());
}

/**
 * Before each AI call made under the "test" tag (src/lib/integrations/openaiClient.ts): false once today's limit is
 * used, so a run already going stops there. If the total can't be read, the call goes ahead: a test is never blocked
 * by a database hiccup, and the run's own price check has already happened.
 */
export async function testCallAllowed(): Promise<boolean> {
  try {
    return (await testSpentMicros()) < testBudgetMicros();
  } catch {
    return true;
  }
}

/** For tests of this module. */
export function resetTestBudgetCache(): void {
  cached = null;
}
