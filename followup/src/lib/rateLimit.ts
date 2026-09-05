import { prisma } from "@/lib/db";

/**
 * Coarse, DB-backed rate limit for the public, unauthenticated lead-intake
 * endpoints (embed widget, generic webhook). Deliberately not an in-memory
 * counter — a serverless function instance's memory isn't shared with any
 * other instance handling the next request, so an in-memory count would
 * silently under-count and never actually cap anything. Counting real
 * Lead rows in Postgres is the one counter every instance genuinely
 * agrees on.
 *
 * Per-business rather than per-IP: the harm being prevented is a flood of
 * junk leads (and the real OpenAI spend each one with a message triggers)
 * against one business, and a distributed flood still hits the same cap
 * either way — IP headers behind Vercel's edge aren't reliable enough to
 * key a limit on regardless.
 */
export async function tooManyRecentLeads(
  businessId: string,
  source: string,
  { windowMinutes, max }: { windowMinutes: number; max: number }
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await prisma.lead.count({
    where: { businessId, source, createdAt: { gte: since } },
  });
  return count >= max;
}

/**
 * Rate limit for authenticated, costly manual actions (Gmail sync, spam
 * scan, AI draft regeneration) that have no natural table row to count
 * the way tooManyRecentLeads() counts Lead rows — backed by RateLimitHit
 * instead, one row per attempt. Same DB-backed reasoning as above (a
 * serverless instance's memory isn't shared, so only a shared Postgres
 * counter actually caps anything).
 *
 * This exists because OpenAI/Gmail API cost for these comes out of one
 * shared platform key, not billed per-business — the billing gate alone
 * only checks "is this business subscribed," not "how much have they
 * asked for in the last few minutes," so a single compromised or careless
 * signed-in account could otherwise run up a real bill against the
 * platform owner's own key, not just their own account.
 *
 * Records the attempt whether or not it's within the limit — a caller
 * that's over the limit should still short-circuit before doing the real
 * work, so the recorded hit reflects "asked for it," not "actually ran."
 */
export async function tooManyRecentActions(
  businessId: string,
  action: string,
  { windowMinutes, max }: { windowMinutes: number; max: number }
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const count = await prisma.rateLimitHit.count({
    where: { businessId, action, createdAt: { gte: since } },
  });
  await prisma.rateLimitHit.create({ data: { businessId, action } });
  return count >= max;
}
