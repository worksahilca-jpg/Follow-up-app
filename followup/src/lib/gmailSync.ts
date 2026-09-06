import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { fetchSalesConversations } from "@/lib/integrations/gmail";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { detectReplies } from "@/lib/outcomes";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Lead } from "@/lib/types";

// The automatic sync asks Gmail for threads newer than the last completed
// run, minus this much overlap — clock skew and a thread whose last
// message landed mid-run must never fall in a gap between two ticks.
// Re-seeing a thread is cheap (known threads skip the classifier).
const SYNC_OVERLAP_MS = 15 * 60_000;
// How often the automatic sync does a DEEP pass (the same 90-day,
// 100-thread pull as the manual "Sync now") instead of the incremental
// tick. Nobody should ever have to press "Sync now": a new connection
// gets its first deep pass on the very next tick, and after that once a
// day — which is also how a classifier improvement re-judges an entire
// inbox on its own (known and previously-rejected threads skip the AI
// call, so a deep pass costs Gmail reads, not OpenAI spend).
const DEEP_SYNC_INTERVAL_MS = 24 * 60 * 60_000;

export type GmailSyncResult = { count: number; scored: number; repliesDetected: number; leads: Lead[] };

/**
 * One inbox sync for one business: pull threads, upsert leads, score +
 * draft each, then check for replies to follow-ups already sent. The same
 * body behind the manual "Sync now" button and the automatic cron — the
 * only difference is `since`, which the cron passes to narrow the pull to
 * what's new (see fetchSalesConversations). Records lastSyncedAt on the
 * Gmail Integration when it completes, so the next automatic tick knows
 * where to start.
 */
export async function syncGmailForBusiness(businessId: string, options: { since?: Date } = {}): Promise<GmailSyncResult> {
  const startedAt = new Date();
  const isDeep = !options.since;
  const leads = await fetchSalesConversations(businessId, options);

  const scoredFlags = await mapWithConcurrency(leads, 5, async (lead) => {
    try {
      return await scoreAndDraftForLead(lead.id);
    } catch (err) {
      // One lead failing to score shouldn't fail the whole sync.
      console.error(`Failed to score lead ${lead.id}:`, err);
      return false;
    }
  });

  let repliesDetected = 0;
  try {
    repliesDetected = await detectReplies(businessId);
  } catch (err) {
    // Outcome tracking failing shouldn't fail the sync that just
    // succeeded — leads are still saved and scored either way.
    console.error(`Failed to detect replies for business ${businessId}:`, err);
  }

  await prisma.integration.updateMany({
    where: { provider: "gmail", status: "connected", user: { businessId } },
    data: { lastSyncedAt: startedAt, ...(isDeep ? { deepSyncedAt: startedAt } : {}) },
  });

  return { count: leads.length, scored: scoredFlags.filter(Boolean).length, repliesDetected, leads };
}

/**
 * The automatic version, across every business with a connected Gmail and
 * active billing — what turns "a lead only shows up when the owner clicks
 * Sync now" into "a lead shows up within minutes of emailing," which is
 * the actual promise (PRODUCT_DIRECTION.md: no lead goes cold, no human
 * doing this job). Businesses are processed a few at a time; one failing
 * never stops the rest.
 */
export async function syncGmailForAllBusinesses(): Promise<{ businesses: number; synced: number; newLeads: number; failed: number }> {
  const integrations = await prisma.integration.findMany({
    where: { provider: "gmail", status: "connected" },
    select: {
      lastSyncedAt: true,
      deepSyncedAt: true,
      user: { select: { businessId: true, business: { select: { subscriptionStatus: true } } } },
    },
  });

  // One entry per business (a business could have more than one connected
  // user); the earliest timestamps win so nothing is skipped.
  const byBusiness = new Map<string, { lastSyncedAt: Date | null; deepSyncedAt: Date | null }>();
  for (const i of integrations) {
    const businessId = i.user.businessId;
    if (!businessId || !hasActiveAccess(i.user.business?.subscriptionStatus)) continue;
    const prev = byBusiness.get(businessId);
    const earlier = (a: Date | null, b: Date | null) => (!a || !b ? null : a < b ? a : b);
    byBusiness.set(businessId, {
      lastSyncedAt: prev ? earlier(prev.lastSyncedAt, i.lastSyncedAt) : i.lastSyncedAt,
      deepSyncedAt: prev ? earlier(prev.deepSyncedAt, i.deepSyncedAt) : i.deepSyncedAt,
    });
  }

  let synced = 0;
  let newLeads = 0;
  let failed = 0;
  await mapWithConcurrency([...byBusiness.entries()], 3, async ([businessId, { lastSyncedAt, deepSyncedAt }]) => {
    // Deep pass (no `since`) when this business has never had one or its
    // last one is a day old; otherwise the cheap incremental tick.
    const deepDue = !deepSyncedAt || Date.now() - deepSyncedAt.getTime() > DEEP_SYNC_INTERVAL_MS;
    const since = deepDue ? undefined : new Date((lastSyncedAt ?? new Date()).getTime() - SYNC_OVERLAP_MS);
    try {
      const result = await syncGmailForBusiness(businessId, since ? { since } : {});
      synced += 1;
      newLeads += result.count;
    } catch (err) {
      failed += 1;
      console.error(`Automatic Gmail sync failed for business ${businessId}:`, err);
    }
  });

  return { businesses: byBusiness.size, synced, newLeads, failed };
}
