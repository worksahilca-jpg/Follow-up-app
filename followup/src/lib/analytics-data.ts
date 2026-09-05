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

export interface TeamBreakdownRow {
  userId: string;
  name: string;
  activeCount: number; // leads assigned to this user, not WON/LOST
  overdueCount: number; // of those, "cold" by the same 7-day-silence definition as getColdLeads()
  activeRevenue: number; // sum of dealValue across their active (non-WON/LOST) leads
}

export interface SequenceHealth {
  enrolledCount: number; // leads currently enrolled in any active-or-not sequence (Lead.sequenceId set)
  completedLast30Days: number; // leads whose Lead.sequenceCompletedAt falls in the last 30 days
  // "Paused because the lead replied mid-sequence" (see the stop-on-reply
  // branch in runSequencesForBusiness(), src/lib/sequences.ts) is NOT
  // exposed here: pausing-for-reply, a manual unenroll, and a deleted
  // sequence all clear Lead.sequenceId/sequenceStepIndex/sequenceStepDueAt
  // identically, with no stored signal distinguishing why a lead left —
  // so "how many were paused for a reply" isn't honestly computable from
  // today's data without adding that tracking, which this pass
  // deliberately doesn't do speculatively for a single metric.
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
  followUpsSentTotal: number;
  repliedCount: number;
  replyRate: number; // 0-100, replied / sent — the outcome-tracking metric

  // Median hours between a FollowUp's sentAt and its repliedAt, across
  // every FollowUp that has actually received a reply (both timestamps
  // set) — the core "how fast do we get leads to respond" number behind
  // the product's whole pitch. null when there's no replied FollowUp yet
  // for this business — never a fabricated placeholder.
  medianReplyHours: number | null;

  // Automated vs. manual send performance — does automation actually
  // convert as well as a human follow-up? Both are 0-100 reply rates over
  // sent FollowUps (FollowUp.automated splits the two), null when that
  // side has sent zero (nothing to divide by, not a 0%).
  automatedReplyRate: number | null;
  manualReplyRate: number | null;

  // Per-teammate load and outcomes, for businesses with more than one
  // User — empty array for a solo business (the caller decides whether to
  // render a team section at all based on length).
  teamBreakdown: TeamBreakdownRow[];

  sequenceHealth: SequenceHealth;
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

/** Standard median: sorted-middle element, or the average of the two middle elements for an even-length array. Empty input has no median. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Same "gone quiet" cutoff as getColdLeads() in leads-data.ts — kept in
// sync deliberately so "overdue" means the same thing everywhere in the app.
const COLD_CUTOFF_DAYS = 7;
const SEQUENCE_COMPLETION_WINDOW_DAYS = 30;

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const sequenceCompletionCutoff = new Date(Date.now() - SEQUENCE_COMPLETION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [leads, followUps, users, enrolledCount, completedLast30Days] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: ctx.businessId },
      select: { stage: true, source: true, dealValue: true, createdAt: true },
    }),
    prisma.followUp.findMany({
      where: { status: "sent", sentAt: { not: null }, lead: { businessId: ctx.businessId } },
      select: { sentAt: true, repliedAt: true, automated: true },
    }),
    // Fetched unconditionally (cheap — one row per teammate) so the
    // "more than one user" check below doesn't need a separate count query.
    prisma.user.findMany({
      where: { businessId: ctx.businessId },
      select: { id: true, name: true, email: true },
    }),
    prisma.lead.count({ where: { businessId: ctx.businessId, sequenceId: { not: null } } }),
    prisma.lead.count({
      where: { businessId: ctx.businessId, sequenceCompletedAt: { gte: sequenceCompletionCutoff } },
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

  const followUpsSentTotal = followUps.length;
  const repliedCount = followUps.filter((f) => f.repliedAt).length;

  // Response-time performance: only FollowUps that actually got a real
  // reply logged (both sentAt and repliedAt set — see src/lib/outcomes.ts)
  // count towards this; a sent-but-not-yet-replied-to FollowUp isn't a "0
  // hour" reply, it's simply not data yet.
  const replyHours = followUps
    .filter((f) => f.repliedAt)
    .map((f) => ((f.repliedAt as Date).getTime() - (f.sentAt as Date).getTime()) / (1000 * 60 * 60));
  const medianHours = median(replyHours);
  const medianReplyHours = medianHours !== null ? Math.round(medianHours * 10) / 10 : null;

  // Automation impact: split the same sent FollowUps by FollowUp.automated
  // (persisted at send time — see sendFollowUpToLead() in src/lib/sending.ts)
  // and compare reply rate per side.
  const automatedSent = followUps.filter((f) => f.automated);
  const manualSent = followUps.filter((f) => !f.automated);
  const automatedReplyRate =
    automatedSent.length > 0
      ? Math.round((automatedSent.filter((f) => f.repliedAt).length / automatedSent.length) * 100)
      : null;
  const manualReplyRate =
    manualSent.length > 0
      ? Math.round((manualSent.filter((f) => f.repliedAt).length / manualSent.length) * 100)
      : null;

  // Team breakdown: only meaningful once there's more than one person to
  // compare — a solo business gets an empty array and the frontend skips
  // rendering the section entirely.
  let teamBreakdown: TeamBreakdownRow[] = [];
  if (users.length > 1) {
    const userIds = users.map((u) => u.id);
    const assignedLeads = await prisma.lead.findMany({
      where: { businessId: ctx.businessId, assignedToId: { in: userIds } },
      select: { assignedToId: true, stage: true, dealValue: true, lastContacted: true, createdAt: true },
    });
    const coldCutoffMs = COLD_CUTOFF_DAYS * 24 * 60 * 60 * 1000;
    teamBreakdown = users.map((u) => {
      const mine = assignedLeads.filter((l) => l.assignedToId === u.id);
      const active = mine.filter((l) => l.stage !== "WON" && l.stage !== "LOST");
      const overdue = active.filter((l) => {
        const lastActivity = l.lastContacted ?? l.createdAt;
        return Date.now() - lastActivity.getTime() >= coldCutoffMs;
      });
      return {
        userId: u.id,
        name: u.name ?? u.email,
        activeCount: active.length,
        overdueCount: overdue.length,
        activeRevenue: active.reduce((sum, l) => sum + l.dealValue, 0),
      };
    });
  }

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
    followUpsSentTotal,
    repliedCount,
    replyRate: followUpsSentTotal > 0 ? Math.round((repliedCount / followUpsSentTotal) * 100) : 0,
    medianReplyHours,
    automatedReplyRate,
    manualReplyRate,
    teamBreakdown,
    sequenceHealth: { enrolledCount, completedLast30Days },
  };
}
