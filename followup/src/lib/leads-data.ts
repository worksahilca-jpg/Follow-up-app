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
import { PIPELINE_STAGES } from "@/lib/demo-data";
import { getSessionContext } from "@/lib/session";
import { Lead, Message, ScoreFactor } from "@/lib/types";
import type { Prisma } from "@prisma/client";

type DbLead = Prisma.LeadGetPayload<{
  include: { conversations: { include: { messages: true } }; assignedTo: true };
}>;

function mapDbLeadToUiLead(dbLead: DbLead): Lead {
  const conversation: Message[] = dbLead.conversations
    .flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction as Message["direction"],
        channel: c.channel as Message["channel"],
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
      }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    id: dbLead.id,
    name: dbLead.name,
    company: dbLead.company ?? "",
    email: dbLead.email ?? "",
    phone: dbLead.phone ?? undefined,
    source: dbLead.source ?? "Unknown",
    stage: dbLead.stage.toLowerCase() as Lead["stage"],
    dealValue: dbLead.dealValue,
    score: dbLead.score,
    scoreReason: dbLead.scoreReason ?? "Not scored yet — click \"Sync now\" in Settings once OpenAI is connected.",
    scoreFactors: (dbLead.scoreFactors as unknown as ScoreFactor[] | null) ?? [],
    priority: dbLead.priority.toLowerCase() as Lead["priority"],
    lastContacted: (dbLead.lastContacted ?? dbLead.createdAt).toISOString(),
    nextFollowUp: dbLead.nextFollowUp ? dbLead.nextFollowUp.toISOString() : null,
    assignedTo: dbLead.assignedTo?.name ?? dbLead.assignedTo?.email ?? "Unassigned",
    notes: dbLead.notes ?? "",
    conversation,
    suggestedMessage: dbLead.suggestedMessage ?? "",
    automationEnabled: dbLead.automationOn,
  };
}

const leadInclude = {
  conversations: { include: { messages: true } },
  assignedTo: true,
} satisfies Prisma.LeadInclude;

export async function getLeads(): Promise<Lead[]> {
  const ctx = await getSessionContext();
  if (!ctx) return [];
  const dbLeads = await prisma.lead.findMany({
    where: { businessId: ctx.businessId },
    include: leadInclude,
    orderBy: { score: "desc" },
  });
  return dbLeads.map(mapDbLeadToUiLead);
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const ctx = await getSessionContext();
  if (!ctx) return undefined;
  const dbLead = await prisma.lead.findUnique({ where: { id }, include: leadInclude });
  if (!dbLead || dbLead.businessId !== ctx.businessId) return undefined;
  return mapDbLeadToUiLead(dbLead);
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
    hotLeads: hot.length,
    followUpsToday: getTodaysFollowUps(leads).length,
    potentialRevenue,
  };
}

export function getPipelineData(leads: Lead[]) {
  return PIPELINE_STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.id);
    return {
      ...stage,
      leads: stageLeads,
      value: stageLeads.reduce((sum, l) => sum + l.dealValue, 0),
    };
  });
}

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
