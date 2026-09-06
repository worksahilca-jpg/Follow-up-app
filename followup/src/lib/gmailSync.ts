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
// A connection that has never auto-synced starts from here rather than the
// full 90-day manual pull — the manual "Sync now" on connect already
// covered history; this only needs to catch what's arrived since.
const FIRST_SYNC_LOOKBACK_MS = 24 * 60 * 60_000;

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
    data: { lastSyncedAt: startedAt },
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
    select: { lastSyncedAt: true, user: { select: { businessId: true, business: { select: { subscriptionStatus: true } } } } },
  });

  // One entry per business (a business could have more than one connected
  // user), earliest lastSyncedAt wins so nothing is skipped.
  const byBusiness = new Map<string, Date | null>();
  for (const i of integrations) {
    const businessId = i.user.businessId;
    if (!businessId || !hasActiveAccess(i.user.business?.subscriptionStatus)) continue;
    const prev = byBusiness.get(businessId);
    if (prev === undefined || (i.lastSyncedAt && prev && i.lastSyncedAt < prev) || !i.lastSyncedAt) {
      byBusiness.set(businessId, i.lastSyncedAt ?? null);
    }
  }

  let synced = 0;
  let newLeads = 0;
  let failed = 0;
  await mapWithConcurrency([...byBusiness.entries()], 3, async ([businessId, lastSyncedAt]) => {
    const since = new Date((lastSyncedAt ? lastSyncedAt.getTime() - SYNC_OVERLAP_MS : Date.now() - FIRST_SYNC_LOOKBACK_MS));
    try {
      const result = await syncGmailForBusiness(businessId, { since });
      synced += 1;
      newLeads += result.count;
    } catch (err) {
      failed += 1;
      console.error(`Automatic Gmail sync failed for business ${businessId}:`, err);
    }
  });

  return { businesses: byBusiness.size, synced, newLeads, failed };
}
