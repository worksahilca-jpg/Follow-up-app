import { prisma } from "@/lib/db";
import { readQualification } from "@/lib/qualification";
import {
  beforeAndSince,
  countAppointments,
  countCalls,
  countReplies,
  readOwnerBaseline,
  type Answering,
  type Appointments,
  type Calls,
  type OwnerBaseline,
  type Replies,
} from "@/lib/pilotNumbers";

/**
 * The pilot's numbers for /admin → Testers (founder, 2026-10-22: "do 2"), read per business over the last 30 days.
 * Founder only (the admin layout checks). Counts only: no customer's name or words leave this file.
 */
export const PILOT_WINDOW_DAYS = 30;

const DAY = 86_400_000;
/** The practice customer (POST /api/leads/test-lead) is never counted. */
const PRACTICE_SOURCE = "Test lead";
export const REAL_CUSTOMER = { OR: [{ source: null }, { source: { not: PRACTICE_SOURCE } }] };
/** Enough for a small business's 90 days before FollowUp plus the window; a bigger inbox is counted from its newest. */
const MAX_MESSAGES = 20_000;
const MAX_BUSINESSES = 40;

export type PilotBusiness = {
  id: string;
  name: string;
  industry: string | null;
  /** When FollowUp first started reading this business's messages. Null: nothing connected. */
  connectedAt: Date | null;
  calls: Calls;
  replies: Replies;
  appointments: Appointments;
  /** The inbox's 90 days before FollowUp, and the window since. Null: nothing connected. */
  answering: { before: Answering; since: Answering } | null;
  baseline: OwnerBaseline | null;
};

export type PilotReport = { windowDays: number; businesses: PilotBusiness[] };

/** The businesses in the pilot: anyone with something connected, or a real customer in the window. */
export async function getPilotNumbers(now: Date = new Date()): Promise<PilotReport> {
  const since = new Date(now.getTime() - PILOT_WINDOW_DAYS * DAY);
  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { users: { some: { integrations: { some: { status: "connected" } } } } },
        { leads: { some: { createdAt: { gte: since }, ...REAL_CUSTOMER } } },
      ],
    },
    select: { id: true, name: true, industry: true, pilotBaseline: true },
    orderBy: { createdAt: "asc" },
    take: MAX_BUSINESSES,
  });

  const out: PilotBusiness[] = [];
  // One business at a time: a handful of queries each, and the admin page is the only reader.
  for (const b of businesses) {
    try {
      out.push(await pilotFor(b, since, now));
    } catch (err) {
      console.error(`Could not count the pilot numbers for business ${b.id}:`, err);
    }
  }
  return { windowDays: PILOT_WINDOW_DAYS, businesses: out };
}

async function pilotFor(
  b: { id: string; name: string; industry: string | null; pilotBaseline: unknown },
  since: Date,
  now: Date
): Promise<PilotBusiness> {
  const businessId = b.id;
  const [sent, customers, corrections, keptOut, bookings, firstConnected] = await Promise.all([
    prisma.followUp.findMany({
      where: { status: "sent", sentAt: { gte: since }, lead: { businessId, ...REAL_CUSTOMER } },
      select: { automated: true, draftEdited: true, trigger: true, repliedAt: true },
      take: MAX_MESSAGES,
    }),
    prisma.lead.findMany({
      where: { businessId, createdAt: { gte: since }, ...REAL_CUSTOMER },
      select: { qualification: true, stage: true, followUpPlan: true, bookings: { where: { status: "confirmed" }, select: { id: true }, take: 1 } },
      take: MAX_MESSAGES,
    }),
    prisma.auditEvent.groupBy({
      by: ["action"],
      where: { businessId, action: { in: ["lead.not_customer", "lead.classification_overridden"] }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.filteredEmail.count({ where: { businessId, createdAt: { gte: since } } }),
    prisma.booking.findMany({
      where: { businessId, status: "confirmed", createdAt: { gte: since }, lead: REAL_CUSTOMER },
      select: { scheduledAt: true, outcome: true },
      take: MAX_MESSAGES,
    }),
    // The calendar is not a place customers write from.
    prisma.integration.findFirst({
      where: { status: "connected", connectedAt: { not: null }, provider: { not: "google_calendar" }, user: { businessId } },
      orderBy: { connectedAt: "asc" },
      select: { connectedAt: true },
    }),
  ]);

  const corrected = (action: string) => corrections.find((c) => c.action === action)?._count._all ?? 0;
  const connectedAt = firstConnected?.connectedAt ?? null;

  let answering: PilotBusiness["answering"] = null;
  if (connectedAt) {
    const from = new Date(Math.min(connectedAt.getTime() - 90 * DAY, since.getTime()));
    const messages = await prisma.message.findMany({
      where: { sentAt: { gte: from }, conversation: { lead: { businessId, ...REAL_CUSTOMER } } },
      select: { direction: true, sentAt: true, conversation: { select: { leadId: true } } },
      orderBy: { sentAt: "desc" },
      take: MAX_MESSAGES,
    });
    answering = beforeAndSince(
      messages.map((m) => ({ leadId: m.conversation.leadId, direction: m.direction, at: m.sentAt })),
      connectedAt,
      now,
      PILOT_WINDOW_DAYS
    );
  }

  return {
    id: b.id,
    name: b.name,
    industry: b.industry,
    connectedAt,
    calls: countCalls(
      customers.map((c) => ({
        tier: readQualification(c.qualification)?.tier ?? null,
        won: c.stage === "WON",
        booked: c.bookings.length > 0,
        planPicked: c.followUpPlan !== null,
      })),
      { setAside: corrected("lead.not_customer"), keptOut, broughtBack: corrected("lead.classification_overridden") }
    ),
    replies: countReplies(
      sent.map((f) => ({ automated: f.automated, draftEdited: f.draftEdited, trigger: f.trigger, replied: f.repliedAt !== null }))
    ),
    appointments: countAppointments(bookings, now),
    answering,
    baseline: readOwnerBaseline(b.pilotBaseline),
  };
}
