import { prisma } from "@/lib/db";
import { APP_OPEN } from "@/lib/appOpens";
import type { BookedRecord, CaughtRecord, SentRecord, WaitingOn } from "@/lib/todayWork";
import type { Lead } from "@/lib/types";

/** The practice customer (POST /api/leads/test-lead) is never "caught". */
const PRACTICE_SOURCE = "Test lead";
const TAKE = 40;

/** The owner's newest app open before today started (null on a new account). */
export async function previousOpen(userId: string, dayStart: Date): Promise<Date | null> {
  const row = await prisma.auditEvent.findFirst({
    where: { userId, action: APP_OPEN, createdAt: { lt: dayStart } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/** Everything FollowUp did for this business since `since`: sends, bookings made, customers caught. */
export async function loadWork(businessId: string, since: Date): Promise<{ sent: SentRecord[]; booked: BookedRecord[]; caught: CaughtRecord[] }> {
  const [sent, booked, caught] = await Promise.all([
    prisma.followUp.findMany({
      where: { status: "sent", sentAt: { gte: since }, lead: { businessId } },
      select: { id: true, leadId: true, message: true, sentAt: true, automated: true, trigger: true, lead: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: TAKE,
    }),
    prisma.booking.findMany({
      where: { businessId, status: "confirmed", createdAt: { gte: since } },
      select: { id: true, leadId: true, scheduledAt: true, createdAt: true, lead: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: TAKE,
    }),
    prisma.lead.findMany({
      where: { businessId, createdAt: { gte: since }, OR: [{ source: null }, { source: { not: PRACTICE_SOURCE } }] },
      select: { id: true, name: true, source: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: TAKE,
    }),
  ]);
  return {
    sent: sent
      .filter((s): s is typeof s & { sentAt: Date } => s.sentAt instanceof Date)
      .map((s) => ({ id: s.id, leadId: s.leadId, leadName: s.lead.name, message: s.message, sentAt: s.sentAt, automated: s.automated, trigger: s.trigger })),
    booked: booked.map((b) => ({ id: b.id, leadId: b.leadId, leadName: b.lead.name, scheduledAt: b.scheduledAt, createdAt: b.createdAt })),
    caught: caught.map((c) => ({ id: c.id, name: c.name, source: c.source, createdAt: c.createdAt })),
  };
}

/**
 * Who FollowUp (or the owner, through it) wrote to last and is still waiting on: the newest message in the
 * conversation is outbound and recent. Anyone already waiting for the owner's OK is left out (each person once, A-046).
 */
export function waitingOnReplies(leads: Lead[], exclude: Set<string>, now: Date, withinDays = 14): WaitingOn[] {
  const floor = now.getTime() - withinDays * 86_400_000;
  const out: WaitingOn[] = [];
  for (const lead of leads) {
    if (exclude.has(lead.id) || lead.conversation.length === 0) continue;
    const last = lead.conversation.reduce((a, b) => (Date.parse(b.date) > Date.parse(a.date) ? b : a));
    if (last.direction !== "outbound") continue;
    const at = Date.parse(last.date);
    if (!Number.isFinite(at) || at < floor || at > now.getTime()) continue;
    out.push({ leadId: lead.id, name: lead.name, sentAt: new Date(at) });
  }
  return out.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
}
