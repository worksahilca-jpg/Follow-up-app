import { prisma } from "@/lib/db";

/**
 * Atomic check-and-record behind every rate limit in this file. The
 * original shape here was a plain `count()` read followed, several
 * awaits later in the caller, by whatever row would make the count go up
 * — no transaction, no lock. That let arbitrarily many concurrent callers
 * (e.g. 200 simultaneous POSTs to the public embed-lead endpoint, whose
 * businessId is deliberately not a secret) all read the same pre-flood
 * count before any of them had recorded anything, and all pass the check
 * — defeating the exact abuse/cost-bomb protection this file exists for
 * against a concurrent flood, as opposed to a slow/sequential one. See
 * research/audit/2026-09-09-fourth-pass-audit.md finding #2.
 *
 * Fix: count and record the hit together, inside one Postgres
 * transaction-scoped advisory lock keyed to (businessId, key) —
 * `pg_advisory_xact_lock` fully serializes concurrent callers for the
 * same key, so the count taken inside the lock can never be stale
 * relative to another caller's insert. The lock is held only for this
 * function's own transaction (released automatically on commit) — never
 * across the caller's own, much slower work (OpenAI calls, external
 * sends), which stays entirely outside this function.
 */
async function checkAndRecordHit(
  businessId: string,
  key: string,
  { windowMinutes, max }: { windowMinutes: number; max: number }
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:${key}`}))`;
    const count = await tx.rateLimitHit.count({ where: { businessId, action: key, createdAt: { gte: since } } });
    // Recorded whether or not it's within the limit — a caller that's
    // over the limit still short-circuits before doing the real work, so
    // the recorded hit reflects "asked for it," not "actually ran."
    await tx.rateLimitHit.create({ data: { businessId, action: key } });
    return count >= max;
  });
}

/**
 * Rate limit for the public, unauthenticated lead-intake endpoints (embed
 * widget, generic webhook). Per-business rather than per-IP: the harm
 * being prevented is a flood of junk leads (and the real OpenAI spend
 * each one with a message triggers) against one business, and a
 * distributed flood still hits the same cap either way — IP headers
 * behind Vercel's edge aren't reliable enough to key a limit on
 * regardless. Counts every attempt at the endpoint (via the shared
 * RateLimitHit table, same as tooManyRecentActions below), not just
 * successfully-created Lead rows — a flood of requests that fail
 * validation costs nothing to run but is still exactly the kind of
 * traffic this cap exists to blunt.
 */
export async function tooManyRecentLeads(
  businessId: string,
  source: string,
  opts: { windowMinutes: number; max: number }
): Promise<boolean> {
  return checkAndRecordHit(businessId, `lead:${source}`, opts);
}

/**
 * Rate limit for authenticated, costly manual actions (Gmail sync, spam
 * scan, AI draft regeneration) — backed by RateLimitHit, one row per
 * attempt.
 *
 * This exists because OpenAI/Gmail API cost for these comes out of one
 * shared platform key, not billed per-business — the billing gate alone
 * only checks "is this business subscribed," not "how much have they
 * asked for in the last few minutes," so a single compromised or careless
 * signed-in account could otherwise run up a real bill against the
 * platform owner's own key, not just their own account.
 */
export async function tooManyRecentActions(
  businessId: string,
  action: string,
  opts: { windowMinutes: number; max: number }
): Promise<boolean> {
  return checkAndRecordHit(businessId, action, opts);
}
