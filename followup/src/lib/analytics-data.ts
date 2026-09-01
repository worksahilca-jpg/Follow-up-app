/**
 * Data layer for the Analytics page. Separate from leads-data.ts because
 * this needs aggregate queries (counts, sums, time buckets) rather than
 * full Lead rows with conversations — pulling every message just to count
 * leads per week would be wasteful.
 *
 * Multi-tenant: scoped to the caller's businessId via getSessionContext(),
 * same pattern as leads-data.ts.
 */

import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PIPELINE_STAGES } from "@/lib/demo-data";

export interface WeekBucket {
  week: string; // short label, e.g. "Aug 25"
  count: number;
}

export interface AnalyticsData {
  totalLeads: number;
  activeCount: number;
  wonCount: number;
  lostCount: number;
  conversionRate: number; // 0-100, won / (won + lost)
  totalRevenue: number; // sum of dealValue across won leads
  avgDealValue: number; // average dealValue across won leads
  stageCounts: { stage: string; label: string; count: number }[];
  sourceCounts: { source: string; count: number }[];
  leadsPerWeek: WeekBucket[];
  followUpsPerWeek: WeekBucket[];
}

const WEEKS = 8;

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

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const [leads, followUps] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: ctx.businessId },
      select: { stage: true, source: true, dealValue: true, createdAt: true },
    }),
    prisma.followUp.findMany({
      where: { status: "sent", sentAt: { not: null }, lead: { businessId: ctx.businessId } },
      select: { sentAt: true },
    }),
  ]);

  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.stage === "WON");
  const lostLeads = leads.filter((l) => l.stage === "LOST");
  const wonCount = wonLeads.length;
  const lostCount = lostLeads.length;
  const closedCount = wonCount + lostCount;
  const totalRevenue = wonLeads.reduce((sum, l) => sum + l.dealValue, 0);

  const stageCounts = PIPELINE_STAGES.map((s) => ({
    stage: s.id,
    label: s.label,
    count: leads.filter((l) => l.stage.toLowerCase() === s.id).length,
  }));

  const sourceMap = new Map<string, number>();
  for (const l of leads) {
    const src = l.source?.trim() || "Unknown";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }
  const sourceCounts = [...sourceMap.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    totalLeads,
    activeCount: totalLeads - closedCount,
    wonCount,
    lostCount,
    conversionRate: closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0,
    totalRevenue,
    avgDealValue: wonCount > 0 ? Math.round(totalRevenue / wonCount) : 0,
    stageCounts,
    sourceCounts,
    leadsPerWeek: bucketByWeek(leads.map((l) => l.createdAt), WEEKS),
    followUpsPerWeek: bucketByWeek(followUps.map((f) => f.sentAt as Date), WEEKS),
  };
}
