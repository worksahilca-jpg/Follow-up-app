import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { fetchOutlookConversations } from "@/lib/integrations/outlook";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { detectReplies } from "@/lib/outcomes";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Lead } from "@/lib/types";

// Same shape as gmailSync.ts's caps, for the same reason: keep one
// invocation comfortably inside the serverless time limit so a pass
// finishes and stamps itself instead of restarting from zero next tick.
const MAX_CLASSIFICATIONS_PER_RUN = 25;
const MAX_SCORES_PER_RUN = 15;

export type OutlookSyncResult = { count: number; scored: number; repliesDetected: number; truncated: boolean; leads: Lead[] };

/** Same self-healing purpose as gmailSync.ts's scoreUnscoredLeads() — kept
 * separate (rather than shared) because it's already this small and each
 * sync module staying self-contained means a change to one channel's
 * sync loop can't accidentally affect the other's. */
async function scoreUnscoredLeads(businessId: string, limit: number): Promise<number> {
  const unscored = await prisma.lead.findMany({
    where: { businessId, scoreReason: null, conversations: { some: { messages: { some: {} } } } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const flags = await mapWithConcurrency(unscored, 5, async ({ id }) => {
    try {
      return await scoreAndDraftForLead(id);
    } catch (err) {
      console.error(`Failed to score lead ${id}:`, err);
      return false;
    }
  });
  return flags.filter(Boolean).length;
}

/**
 * One inbox sync for one business's Outlook connection — mirrors
 * syncGmailForBusiness() in gmailSync.ts. No `since` parameter here:
 * Graph's own delta cursor (Integration.deltaLink) already tracks "what's
 * new" internally, so every call is naturally incremental once the first
 * one has run.
 */
export async function syncOutlookForBusiness(businessId: string): Promise<OutlookSyncResult> {
  let scored = await scoreUnscoredLeads(businessId, MAX_SCORES_PER_RUN);

  let truncated = false;
  const leads = await fetchOutlookConversations(businessId, {
    maxClassifications: MAX_CLASSIFICATIONS_PER_RUN,
    onResult: (info) => {
      truncated = info.truncated;
    },
  });

  const toScore = leads.filter((l) => l.touched).slice(0, Math.max(0, MAX_SCORES_PER_RUN - scored));
  const scoredFlags = await mapWithConcurrency(toScore, 5, async (lead) => {
    try {
      return await scoreAndDraftForLead(lead.id);
    } catch (err) {
      console.error(`Failed to score lead ${lead.id}:`, err);
      return false;
    }
  });
  scored += scoredFlags.filter(Boolean).length;

  let repliesDetected = 0;
  try {
    repliesDetected = await detectReplies(businessId);
  } catch (err) {
    console.error(`Failed to detect replies for business ${businessId}:`, err);
  }

  await prisma.integration.updateMany({
    where: { provider: "outlook", status: "connected", user: { businessId } },
    data: { lastSyncedAt: new Date(), lastSyncError: null },
  });

  return { count: leads.length, scored, repliesDetected, truncated, leads };
}

/**
 * The automatic version, across every business with a connected Outlook
 * and active billing — mirrors syncGmailForAllBusinesses(). No push
 * equivalent yet (Graph subscriptions exist but need a renewal loop and a
 * validated public webhook of their own); the cron poll below is the only
 * path today, same as Gmail before push was added — still turns "only
 * updates when the owner clicks Sync now" into "seen within minutes."
 */
export async function syncOutlookForAllBusinesses(): Promise<{ businesses: number; synced: number; newLeads: number; failed: number }> {
  const integrations = await prisma.integration.findMany({
    where: { provider: "outlook", status: "connected" },
    select: { user: { select: { businessId: true, business: { select: { subscriptionStatus: true } } } } },
  });

  const businessIds = new Set<string>();
  for (const i of integrations) {
    const businessId = i.user.businessId;
    if (!businessId || !hasActiveAccess(i.user.business?.subscriptionStatus)) continue;
    businessIds.add(businessId);
  }

  let synced = 0;
  let newLeads = 0;
  let failed = 0;
  await mapWithConcurrency([...businessIds], 3, async (businessId) => {
    try {
      const result = await syncOutlookForBusiness(businessId);
      synced += 1;
      newLeads += result.count;
    } catch (err) {
      failed += 1;
      console.error(`Automatic Outlook sync failed for business ${businessId}:`, err);
      const message = err instanceof Error ? err.message : String(err);
      await prisma.integration
        .updateMany({
          where: { provider: "outlook", status: "connected", user: { businessId } },
          data: { lastSyncError: `${new Date().toISOString()} ${message}`.slice(0, 1000) },
        })
        .catch((e) => console.error(`Failed to record sync error for business ${businessId}:`, e));
    }
  });

  return { businesses: businessIds.size, synced, newLeads, failed };
}
