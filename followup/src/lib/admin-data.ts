/**
 * Data layer for the platform admin dashboard (src/app/admin/**) —
 * founder-only, cross-tenant. This is the one place in the codebase that
 * deliberately queries across every business with no businessId filter;
 * every other data-layer file (leads-data.ts, analytics-data.ts, ...)
 * scopes to `getSessionContext().businessId` on purpose, and must keep
 * doing so — don't reuse these query shapes there.
 *
 * Gated twice, independently: src/app/admin/layout.tsx calls
 * requirePlatformAdmin() before this ever renders, and getPlatformAdminData()
 * below calls it again itself — the same "don't trust that only a gated
 * caller ever calls me" belt-and-suspenders pattern as getAnalytics() in
 * analytics-data.ts.
 *
 * Query shape: aggregate (`count`/`groupBy`) wherever the row count scales
 * with leads (unbounded — could be tens of thousands), and only pulls full
 * rows where the row count scales with BUSINESSES (bounded — signups are
 * inherently rare relative to leads) or is capped to a small `take`.
 */

import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { TIER_MONTHLY_PRICE_USD, TIER_INFO } from "@/lib/pricing";

export interface WeekBucket {
  week: string;
  count: number;
}

export interface ChannelCount {
  source: string;
  count: number;
}

export interface TierCount {
  tier: string;
  label: string;
  count: number;
}

export interface RecentSignup {
  id: string;
  name: string;
  createdAt: Date;
  tier: string;
  leadCount: number;
  connectedChannels: string[];
}

export interface PlatformAdminData {
  totalBusinesses: number;
  signupsPerWeek: WeekBucket[];
  totalLeadsPlatformWide: number;
  channelBreakdown: ChannelCount[];
  tierBreakdown: TierCount[];
  // Rough MRR: paid-tier businesses whose mirrored Stripe subscription is
  // actually active/trialing right now, times that tier's list price — NOT
  // a raw count-by-tier × price. Business.tier is sticky/grandfathered even
  // after a subscription lapses (see hasActiveAccess()'s own comment in
  // src/lib/billing.ts), so a plain tier count would overstate revenue by
  // including canceled/past_due businesses that still carry a stale paid
  // tier value. "Rough" because it ignores proration, the Voice add-on,
  // and anything mid-trial that later doesn't convert.
  estimatedMonthlyRevenueUsd: number;
  activeBusinessCount: number;
  dormantBusinessCount: number;
  recentSignups: RecentSignup[];
}

const SIGNUP_WEEKS = 12;
const RECENT_SIGNUPS_LIMIT = 10;
const PAID_SUBSCRIPTION_STATUSES = ["active", "trialing"];

function bucketByWeek(dates: Date[], weeks: number): WeekBucket[] {
  const now = new Date();
  const starts: Date[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay() - i * 7);
    start.setHours(0, 0, 0, 0);
    starts.push(start);
  }

  const counts = new Array(weeks).fill(0);
  for (const d of dates) {
    for (let i = starts.length - 1; i >= 0; i--) {
      if (d >= starts[i]) {
        counts[i]++;
        break;
      }
    }
  }

  return starts.map((start, i) => ({
    week: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count: counts[i],
  }));
}

export async function getPlatformAdminData(): Promise<PlatformAdminData> {
  await requirePlatformAdmin();

  const [
    totalBusinesses,
    businessCreatedAts,
    totalLeadsPlatformWide,
    sourceGroups,
    tierGroups,
    payingPlusCount,
    payingProCount,
    leadBusinessGroups,
    integratedUserRows,
    metaConnectedBusinesses,
    recentBusinesses,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.findMany({ select: { createdAt: true } }),
    prisma.lead.count(),
    prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.business.groupBy({ by: ["tier"], _count: { _all: true } }),
    prisma.business.count({ where: { tier: "plus", subscriptionStatus: { in: PAID_SUBSCRIPTION_STATUSES } } }),
    prisma.business.count({ where: { tier: "pro", subscriptionStatus: { in: PAID_SUBSCRIPTION_STATUSES } } }),
    // One row per business that has captured >=1 lead — bounded by business
    // count, not lead count (GROUP BY, not a row-per-lead fetch).
    prisma.lead.groupBy({ by: ["businessId"] }),
    // Gmail/Outlook connections live on Integration, keyed by userId, not
    // businessId directly — distinct businessId of any user with a
    // connected one. Also bounded by business count.
    prisma.user.findMany({
      where: { businessId: { not: null }, integrations: { some: { status: "connected" } } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
    // Instagram/Facebook connections live directly on Business (not the
    // Integration table) — see schema.prisma's Business model.
    prisma.business.findMany({
      where: { OR: [{ instagramUserId: { not: null } }, { facebookPageId: { not: null } }] },
      select: { id: true },
    }),
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: RECENT_SIGNUPS_LIMIT,
      select: { id: true, name: true, createdAt: true, tier: true },
    }),
  ]);

  const recentIds = recentBusinesses.map((b) => b.id);
  const [recentLeadCounts, recentIntegratedUsers, recentMetaBusinesses] = await Promise.all([
    prisma.lead.groupBy({ by: ["businessId"], where: { businessId: { in: recentIds } }, _count: { _all: true } }),
    prisma.user.findMany({
      where: { businessId: { in: recentIds }, integrations: { some: { status: "connected" } } },
      select: { businessId: true, integrations: { where: { status: "connected" }, select: { provider: true } } },
    }),
    prisma.business.findMany({
      where: { id: { in: recentIds } },
      select: { id: true, instagramUserId: true, facebookPageId: true },
    }),
  ]);

  // --- Active vs. dormant ---
  const activeBusinessIds = new Set<string>();
  for (const row of leadBusinessGroups) activeBusinessIds.add(row.businessId);
  for (const row of integratedUserRows) if (row.businessId) activeBusinessIds.add(row.businessId);
  for (const b of metaConnectedBusinesses) activeBusinessIds.add(b.id);
  const activeBusinessCount = activeBusinessIds.size;
  const dormantBusinessCount = Math.max(0, totalBusinesses - activeBusinessCount);

  // --- Tier breakdown + rough revenue ---
  const tierCountMap = new Map(tierGroups.map((g) => [g.tier, g._count._all]));
  const tierBreakdown: TierCount[] = (Object.keys(TIER_INFO) as (keyof typeof TIER_INFO)[]).map((tier) => ({
    tier,
    label: TIER_INFO[tier].label,
    count: tierCountMap.get(tier) ?? 0,
  }));
  const estimatedMonthlyRevenueUsd =
    payingPlusCount * TIER_MONTHLY_PRICE_USD.plus + payingProCount * TIER_MONTHLY_PRICE_USD.pro;

  // --- Channel breakdown ---
  const channelBreakdown: ChannelCount[] = sourceGroups
    .map((g) => ({ source: g.source?.trim() || "Unknown", count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // --- Recent signups, with per-business channels + lead count ---
  const leadCountByBusiness = new Map(recentLeadCounts.map((g) => [g.businessId, g._count._all]));
  const channelsByBusiness = new Map<string, Set<string>>();
  for (const u of recentIntegratedUsers) {
    if (!u.businessId) continue;
    const set = channelsByBusiness.get(u.businessId) ?? new Set<string>();
    for (const i of u.integrations) set.add(i.provider);
    channelsByBusiness.set(u.businessId, set);
  }
  for (const b of recentMetaBusinesses) {
    const set = channelsByBusiness.get(b.id) ?? new Set<string>();
    if (b.instagramUserId) set.add("instagram");
    if (b.facebookPageId) set.add("facebook");
    channelsByBusiness.set(b.id, set);
  }

  const recentSignups: RecentSignup[] = recentBusinesses.map((b) => ({
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    tier: b.tier,
    leadCount: leadCountByBusiness.get(b.id) ?? 0,
    connectedChannels: [...(channelsByBusiness.get(b.id) ?? [])].sort(),
  }));

  return {
    totalBusinesses,
    signupsPerWeek: bucketByWeek(
      businessCreatedAts.map((b) => b.createdAt),
      SIGNUP_WEEKS
    ),
    totalLeadsPlatformWide,
    channelBreakdown,
    tierBreakdown,
    estimatedMonthlyRevenueUsd,
    activeBusinessCount,
    dormantBusinessCount,
    recentSignups,
  };
}
