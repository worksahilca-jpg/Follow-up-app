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
import { agentIdentifiers, deidentifyText, leadIdentifiers } from "@/lib/deidentify";

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

export interface AccessRequestRow {
  id: string;
  name: string;
  email: string;
  business: string | null;
  channels: string[];
  note: string | null;
  status: string; // new | approved | declined
  createdAt: Date;
  // Where this tester actually is, so the founder sees who is stuck
  // rather than who was invited: signed in at all, inbox connected
  // (Gmail or Outlook), leads on the board.
  signedIn: boolean;
  inboxConnected: boolean;
  leadCount: number;
}

/**
 * The beta goal as a funnel: ten testers, each of whom has to get through
 * three doors before they are testing anything. Counts are of approved
 * testers only; a removed one drops out of every step.
 */
export interface TesterFunnel {
  goal: number;
  added: number;
  signedIn: number;
  inboxConnected: number;
  firstLead: number;
}

/**
 * One edited draft from the last week: what FollowUp wrote against what
 * the owner really sent, de-identified through src/lib/deidentify.ts
 * before it leaves the data layer. Only from businesses that turned on
 * "Help improve FollowUp" — the draft is never even stored otherwise
 * (FollowUp.draftText, src/lib/sending.ts).
 */
export interface DraftChange {
  id: string;
  businessName: string;
  channel: string;
  sentAt: Date;
  draft: string;
  sent: string;
}

export const TESTER_GOAL = 10;
const DRAFT_CHANGES_DAYS = 7;
const DRAFT_CHANGES_LIMIT = 30;

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
  // The beta list: every email the founder added, active first, newest first.
  accessRequests: AccessRequestRow[];
  testerFunnel: TesterFunnel;
  draftChanges: DraftChange[];
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

  const accessRequestRows = await prisma.accessRequest.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  // --- Where each tester is: signed in → inbox → first lead ---
  // Keyed by the tester's email → their user's business. Bounded by the
  // tester list (≤100), never by leads.
  const testerEmails = accessRequestRows.map((r) => r.email);
  const testerUsers = testerEmails.length
    ? await prisma.user.findMany({ where: { email: { in: testerEmails } }, select: { email: true, businessId: true } })
    : [];
  const businessByEmail = new Map<string, string>();
  for (const u of testerUsers) if (u.email && u.businessId) businessByEmail.set(u.email, u.businessId);
  const testerBusinessIds = [...new Set(businessByEmail.values())];
  const [testerInboxUsers, testerLeadCounts] = testerBusinessIds.length
    ? await Promise.all([
        prisma.user.findMany({
          where: {
            businessId: { in: testerBusinessIds },
            integrations: { some: { status: "connected", provider: { in: ["gmail", "outlook"] } } },
          },
          select: { businessId: true },
        }),
        prisma.lead.groupBy({ by: ["businessId"], where: { businessId: { in: testerBusinessIds } }, _count: { _all: true } }),
      ])
    : [[], []];
  const inboxBusinessIds = new Set(testerInboxUsers.map((u) => u.businessId).filter((id): id is string => !!id));
  const testerLeadCountByBusiness = new Map(testerLeadCounts.map((g) => [g.businessId, g._count._all]));

  const order = { new: 0, approved: 1, declined: 2 } as Record<string, number>;
  const accessRequests: AccessRequestRow[] = accessRequestRows
    .map((r) => {
      const businessId = businessByEmail.get(r.email);
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        business: r.business,
        channels: r.channels ? r.channels.split(",").filter(Boolean) : [],
        note: r.note,
        status: r.status,
        createdAt: r.createdAt,
        signedIn: !!businessId,
        inboxConnected: !!businessId && inboxBusinessIds.has(businessId),
        leadCount: businessId ? (testerLeadCountByBusiness.get(businessId) ?? 0) : 0,
      };
    })
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime());

  const approvedTesters = accessRequests.filter((r) => r.status === "approved");
  const testerFunnel: TesterFunnel = {
    goal: TESTER_GOAL,
    added: approvedTesters.length,
    signedIn: approvedTesters.filter((r) => r.signedIn).length,
    inboxConnected: approvedTesters.filter((r) => r.inboxConnected).length,
    firstLead: approvedTesters.filter((r) => r.leadCount > 0).length,
  };

  // --- What testers changed this week ---
  // Only rows with a stored draft exist for opted-in businesses, so the
  // consent check is the column itself; the de-identification boundary is
  // applied here, before any of this leaves the data layer.
  const since = new Date(Date.now() - DRAFT_CHANGES_DAYS * 24 * 60 * 60_000);
  const editedRows = await prisma.followUp.findMany({
    where: { draftEdited: true, draftText: { not: null }, sentAt: { gte: since } },
    orderBy: { sentAt: "desc" },
    take: DRAFT_CHANGES_LIMIT,
    select: {
      id: true,
      channel: true,
      sentAt: true,
      message: true,
      draftText: true,
      lead: {
        select: {
          name: true,
          email: true,
          phone: true,
          company: true,
          assignedTo: { select: { name: true, email: true } },
          business: { select: { name: true } },
        },
      },
    },
  });
  const draftChanges: DraftChange[] = editedRows
    .filter((r) => r.draftText && r.message && r.sentAt)
    .map((r) => {
      const identifiers = [...leadIdentifiers(r.lead), ...agentIdentifiers(r.lead.assignedTo)];
      return {
        id: r.id,
        businessName: r.lead.business.name,
        channel: r.channel,
        sentAt: r.sentAt!,
        draft: deidentifyText(r.draftText!, identifiers),
        sent: deidentifyText(r.message!, identifiers),
      };
    });

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
    accessRequests,
    testerFunnel,
    draftChanges,
  };
}
