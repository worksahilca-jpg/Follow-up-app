/**
 * Real data layer for leads — reads from the database instead of
 * src/lib/demo-data.ts. Mirrors that file's function shapes (getStats,
 * getTodaysFollowUps, getColdLeads, getPipelineData, etc.) so pages didn't
 * need much rework, but these operate on real Lead[] fetched from Prisma
 * instead of a closed-over static array.
 *
 * Multi-tenant: getLeads()/getLeadById() resolve the caller's businessId
 * from the current session and scope every query to it — this is always
 * called from Server Components under the (app) layout, which already
 * requires a session, so resolving it here (instead of threading
 * businessId through every page) is safe and keeps page code unchanged.
 * getLeadById() double-checks the fetched lead actually belongs to that
 * business (not just "does this id exist anywhere") — that ownership
 * check is the whole point; without it any signed-in user could view any
 * other business's lead just by guessing its id.
 */

import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { Lead, Message, ScoreFactor } from "@/lib/types";
import type { Prisma } from "@prisma/client";
import { getAtRiskLeads } from "@/lib/rescue";
import { computeAutomationStatus, getBusinessAutomationRules, type BusinessAutomationRules } from "@/lib/automationStatus";

type DbLead = Prisma.LeadGetPayload<{
  include: {
    conversations: { include: { messages: true } };
    assignedTo: true;
    sequence: { select: { name: true; active: true } };
    followUps: { select: { trigger: true } };
  };
}>;

function mapDbLeadToUiLead(dbLead: DbLead, rules: BusinessAutomationRules): Lead {
  const conversation: Message[] = dbLead.conversations
    .flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction as Message["direction"],
        channel: c.channel as Message["channel"],
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
        source: m.source ?? undefined,
      }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const stage = dbLead.stage.toLowerCase() as Lead["stage"];
  const automationTier = dbLead.automationTier.toLowerCase() as Lead["automationTier"];
  const lastContacted = (dbLead.lastContacted ?? dbLead.createdAt).toISOString();

  return {
    id: dbLead.id,
    name: dbLead.name,
    company: dbLead.company ?? "",
    email: dbLead.email ?? "",
    phone: dbLead.phone ?? undefined,
    source: dbLead.source ?? "Unknown",
    stage,
    dealValue: dbLead.dealValue,
    score: dbLead.score,
    scoreReason: dbLead.scoreReason ?? "Not scored yet — click \"Sync now\" in Settings once OpenAI is connected.",
    scoreFactors: (dbLead.scoreFactors as unknown as ScoreFactor[] | null) ?? [],
    priority: dbLead.priority.toLowerCase() as Lead["priority"],
    lastContacted,
    nextFollowUp: dbLead.nextFollowUp ? dbLead.nextFollowUp.toISOString() : null,
    assignedTo: dbLead.assignedTo?.name ?? dbLead.assignedTo?.email ?? "Unassigned",
    assignedToId: dbLead.assignedToId,
    notes: dbLead.notes ?? "",
    conversation,
    suggestedMessage: dbLead.suggestedMessage ?? "",
    suggestedSubject: dbLead.suggestedSubject ?? "",
    automationTier,
    optedOutAt: dbLead.optedOutAt ? dbLead.optedOutAt.toISOString() : null,
    automationStatus: computeAutomationStatus(
      {
        stage,
        automationTier,
        lastContacted,
        conversation,
        // null covers a manual send predating the trigger column — still
        // a real, substantive reply, so it must count the same as "manual"
        // does, not get treated as if nothing had gone out at all.
        followUpTriggers: dbLead.followUps.map((f) => f.trigger ?? "manual"),
        sequence: dbLead.sequence ? { name: dbLead.sequence.name, active: dbLead.sequence.active, dueAt: dbLead.sequenceStepDueAt?.toISOString() ?? null } : null,
      },
      rules
    ),
  };
}

const leadInclude = {
  conversations: { include: { messages: true } },
  assignedTo: true,
  sequence: { select: { name: true, active: true } },
  // Only the trigger is needed — see computeAutomationStatus's
  // hasSubstantiveFollowUp check, mirroring findUnansweredLeads() in
  // automation.ts.
  followUps: { select: { trigger: true } },
} satisfies Prisma.LeadInclude;

export async function getLeads(): Promise<Lead[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const [dbLeads, rules] = await Promise.all([
    prisma.lead.findMany({
      where: { businessId: ctx.businessId },
      include: leadInclude,
      orderBy: { score: "desc" },
    }),
    getBusinessAutomationRules(ctx.businessId),
  ]);
  return dbLeads.map((l) => mapDbLeadToUiLead(l, rules));
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const ctx = await getSessionContext();
  if (!ctx) return undefined;
  const dbLead = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!dbLead || dbLead.businessId !== ctx.businessId) return undefined;
  const rules = await getBusinessAutomationRules(ctx.businessId);
  return mapDbLeadToUiLead(dbLead, rules);
}

export interface LeadAuditEntry {
  id: string;
  action: string;
  createdAt: string; // ISO date
  meta: Record<string, unknown> | null;
}

export interface LeadAuditTrail {
  events: LeadAuditEntry[];
  /** Total AuditEvent rows for this lead, independent of the `take` cap below —
   *  lets the UI say "showing the 25 most recent of N" instead of silently
   *  implying the panel is the complete record when it isn't (task #85). */
  totalCount: number;
}

/**
 * The per-lead slice of the AI audit trail (task #67 / synthesis rec #2)
 * — every recordAudit() call written with targetType "lead" and this
 * lead's id: a manual send (lib/audit.ts action "lead.send"), an
 * automated one (sending.ts "ai.send"), or the risk gate holding a draft
 * instead of sending it (automation.ts "ai.hold"). Scoped by businessId
 * the same way getLeadById() is — the AuditEvent row would never match a
 * lead in a different business anyway, but filtering on it here keeps
 * this query as tenant-scoped as every other lead read, not an
 * accidental exception.
 */
export async function getLeadAuditTrail(leadId: string): Promise<LeadAuditTrail> {
  const ctx = await getSessionContext();
  if (!ctx) return { events: [], totalCount: 0 };
  const where = { businessId: ctx.businessId, targetType: "lead", targetId: leadId };
  const [events, totalCount] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.auditEvent.count({ where }),
  ]);
  return {
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      createdAt: e.createdAt.toISOString(),
      meta: (e.meta as Record<string, unknown> | null) ?? null,
    })),
    totalCount,
  };
}

export function isDueToday(lead: Lead): boolean {
  if (!lead.nextFollowUp) return false;
  const today = new Date();
  const due = new Date(lead.nextFollowUp);
  return due.toDateString() === today.toDateString();
}

export function getTodaysFollowUps(leads: Lead[]): Lead[] {
  return leads
    .filter((l) => isDueToday(l) && l.stage !== "won" && l.stage !== "lost")
    .sort((a, b) => b.score - a.score);
}

export function getColdLeads(leads: Lead[]): Lead[] {
  const cutoff = 7;
  return leads.filter((l) => {
    if (l.stage === "won" || l.stage === "lost") return false;
    const days = Math.floor((Date.now() - new Date(l.lastContacted).getTime()) / 86400000);
    return days >= cutoff;
  });
}

export function getStats(leads: Lead[]) {
  const active = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const hot = active.filter((l) => l.priority === "high");
  const potentialRevenue = active.reduce((sum, l) => sum + l.dealValue, 0);
  return {
    totalLeads: leads.length,
    atRisk: getAtRiskLeads(leads).length,
    hotLeads: hot.length,
    followUpsToday: getTodaysFollowUps(leads).length,
    potentialRevenue,
  };
}

// Moved to src/lib/pipeline.ts — it's a pure function of an already-fetched
// Lead[] with no Prisma dependency of its own, but PipelinePageClient
// ("use client") importing it from *this* file pulled this file's own
// `import { prisma } from "@/lib/db"` into the browser bundle, which throws
// at runtime ("PrismaClient is unable to run in this browser environment").
// Re-exported here so every other (server-side) caller of getPipelineData
// from "@/lib/leads-data" keeps working unchanged.
export { getPipelineData } from "@/lib/pipeline";

/**
 * Only counts things we can actually verify happened for real right now.
 * followUpsSent counts real FollowUp rows from the last 7 days.
 * repliesReceived counts FollowUps whose repliedAt (see src/lib/outcomes.ts
 * — set by detectReplies() after a Gmail sync) falls in the same window —
 * a real outcome, not a guess, though it only reflects what the last sync
 * has caught up on.
 */
export async function getWeeklyReport(leads: Lead[]) {
  const closed = leads.filter((l) => l.stage === "won");
  const revenueGenerated = closed.reduce((sum, l) => sum + l.dealValue, 0);
  const hot = leads.filter((l) => l.priority === "high" && l.stage !== "won" && l.stage !== "lost");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [followUpsSent, repliesReceived] = leads.length
    ? await Promise.all([
        prisma.followUp.count({
          where: { status: "sent", sentAt: { gte: sevenDaysAgo }, leadId: { in: leads.map((l) => l.id) } },
        }),
        prisma.followUp.count({
          where: { status: "sent", repliedAt: { gte: sevenDaysAgo }, leadId: { in: leads.map((l) => l.id) } },
        }),
      ])
    : [0, 0];

  return {
    conversationsAnalyzed: leads.length,
    followUpsSent,
    repliesReceived,
    dealsClosed: closed.length,
    revenueGenerated,
    insight:
      hot.length > 0
        ? `You have ${hot.length} high-priority lead${hot.length === 1 ? "" : "s"} that ${
            hot.length === 1 ? "hasn't" : "haven't"
          } closed yet — following up within 48 hours tends to convert best.`
        : leads.length === 0
        ? "No leads yet — connect Gmail in Settings and sync your inbox to get started."
        : "No high-priority leads right now — nice and caught up.",
  };
}

export interface UpcomingBooking {
  id: string;
  leadId: string;
  leadName: string;
  scheduledAt: string; // ISO date
  durationMinutes: number;
}

/** Calls leads have booked themselves through their booking link (see src/lib/booking.ts), soonest first. */
export async function getUpcomingBookings(): Promise<UpcomingBooking[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];

  const bookings = await prisma.booking.findMany({
    where: { businessId: ctx.businessId, status: "confirmed", scheduledAt: { gte: new Date() } },
    include: { lead: { select: { name: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  return bookings.map((b) => ({
    id: b.id,
    leadId: b.leadId,
    leadName: b.lead.name,
    scheduledAt: b.scheduledAt.toISOString(),
    durationMinutes: b.durationMinutes,
  }));
}
