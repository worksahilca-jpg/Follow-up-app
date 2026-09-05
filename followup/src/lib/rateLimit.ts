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
