import { prisma } from "@/lib/db";
import { hasActiveAccess } from "@/lib/billing";
import { ensureGmailWatch, fetchSalesConversations } from "@/lib/integrations/gmail";
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

// Per-run work caps — each keeps one invocation comfortably inside the
// serverless time limit so a pass FINISHES (and stamps itself) instead of
// restarting from zero on the next tick. Whatever's left over is picked
// up next tick: unclassified threads by the next pass, unscored leads by
// the sweep below.
const MAX_CLASSIFICATIONS_PER_RUN = 25;
const MAX_SCORES_PER_RUN = 15;

export type GmailSyncResult = { count: number; scored: number; repliesDetected: number; truncated: boolean; leads: Lead[] };

/**
 * Self-healing scoring: any lead that exists with messages but was never
 * scored (no scoreReason) gets scored now, oldest first. A lead can end
 * up in that state whenever a pass is cut short — and until it's scored
 * it shows as "not reviewed yet" and no automated follow-up considers it.
 * Runs at the start of every sync, so a stuck lead never waits more than
 * one tick.
 */
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

  // Leftovers first: anything a previous cut-short run left unscored.
  let scored = await scoreUnscoredLeads(businessId, MAX_SCORES_PER_RUN);

  let truncated = false;
  const leads = await fetchSalesConversations(businessId, {
    since: options.since,
    maxClassifications: MAX_CLASSIFICATIONS_PER_RUN,
    onResult: (info) => {
      truncated = info.truncated;
    },
  });

  // Only what this run actually changed gets (re)scored — a deep pass
  // returns every known lead too, and re-scoring all of them on every
  // pass was both the cost and the time sink.
  const toScore = leads.filter((l) => l.touched).slice(0, Math.max(0, MAX_SCORES_PER_RUN - scored));
  const scoredFlags = await mapWithConcurrency(toScore, 5, async (lead) => {
    try {
      return await scoreAndDraftForLead(lead.id);
    } catch (err) {
      // One lead failing to score shouldn't fail the whole sync.
      console.error(`Failed to score lead ${lead.id}:`, err);
      return false;
    }
  });
  scored += scoredFlags.filter(Boolean).length;

  let repliesDetected = 0;
  try {
    repliesDetected = await detectReplies(businessId);
  } catch (err) {
    // Outcome tracking failing shouldn't fail the sync that just
    // succeeded — leads are still saved and scored either way.
    console.error(`Failed to detect replies for business ${businessId}:`, err);
  }

  // A deep pass only counts as done when nothing was left past the
  // budget; a truncated one runs again next tick and picks up where the
  // known-thread skipping leaves off.
  await prisma.integration.updateMany({
    where: { provider: "gmail", status: "connected", user: { businessId } },
    data: {
      lastSyncedAt: startedAt,
      lastSyncError: null,
      ...(isDeep && !truncated ? { deepSyncedAt: startedAt } : {}),
    },
  });

  return { count: leads.length, scored, repliesDetected, truncated, leads };
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
      user: { select: { businessId: true, business: { select: { subscriptionStatus: true, tier: true } } } },
    },
  });

  // One entry per business (a business could have more than one connected
  // user); the earliest timestamps win so nothing is skipped.
  const byBusiness = new Map<string, { lastSyncedAt: Date | null; deepSyncedAt: Date | null }>();
  for (const i of integrations) {
    const businessId = i.user.businessId;
    // Gmail is one of Free tier's allowed channels (@/lib/billing's
    // FREE_TIER_ALLOWED_SOURCES) — pass tier through so a Free-tier
    // business's inbox still gets synced, not just Plus/Pro's. Without
    // this, Free tier's promised Gmail detection never runs at all.
    if (!businessId || !hasActiveAccess(i.user.business?.subscriptionStatus, i.user.business?.tier)) continue;
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
      // Keep the push watch alive (7-day max) — the poll above is the
      // fallback; push is what makes "seen in seconds" true.
      await ensureGmailWatch(businessId).catch((e) => console.error(`Gmail watch renewal failed for ${businessId}:`, e));
    } catch (err) {
      failed += 1;
      console.error(`Automatic Gmail sync failed for business ${businessId}:`, err);
      // A failing sync must be visible somewhere other than a log nobody
      // reads — record what went wrong on the connection itself.
      const message = err instanceof Error ? err.message : String(err);
      await prisma.integration
        .updateMany({
          where: { provider: "gmail", status: "connected", user: { businessId } },
          data: { lastSyncError: `${new Date().toISOString()} ${message}`.slice(0, 1000) },
        })
        .catch((e) => console.error(`Failed to record sync error for business ${businessId}:`, e));
    }
  });

  return { businesses: byBusiness.size, synced, newLeads, failed };
}

// How long a push-triggered sync may hold the per-business lock before
// another notification is allowed to start one. Bursts are normal
// (Google fires on every mailbox change, including our own sends) — the
// first notification does the work, the rest are acknowledged and dropped;
// the 15-minute overlap on `since` means nothing is missed.
const PUSH_LOCK_MS = 3 * 60_000;

/**
 * The push path: Google told us this inbox changed, so run one
 * incremental sync now. Same body as the cron tick, minus the deep-pass
 * decision (the cron still owns that), plus a short lock so a burst of
 * notifications can't run overlapping syncs.
 */
export async function syncGmailForBusinessFromPush(businessId: string): Promise<GmailSyncResult | null> {
  const now = new Date();
  const claim = await prisma.integration.updateMany({
    where: {
      provider: "gmail",
      status: "connected",
      user: { businessId },
      OR: [{ pushSyncStartedAt: null }, { pushSyncStartedAt: { lt: new Date(now.getTime() - PUSH_LOCK_MS) } }],
    },
    data: { pushSyncStartedAt: now },
  });
  if (claim.count === 0) return null;

  try {
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { subscriptionStatus: true, tier: true } });
    if (!hasActiveAccess(business?.subscriptionStatus, business?.tier)) return null;
    const integration = await prisma.integration.findFirst({
      where: { provider: "gmail", status: "connected", user: { businessId } },
      select: { lastSyncedAt: true },
    });
    const since = new Date((integration?.lastSyncedAt ?? now).getTime() - SYNC_OVERLAP_MS);
    return await syncGmailForBusiness(businessId, { since });
  } finally {
    await prisma.integration.updateMany({
      where: { provider: "gmail", status: "connected", user: { businessId } },
      data: { pushSyncStartedAt: null },
    });
  }
}
