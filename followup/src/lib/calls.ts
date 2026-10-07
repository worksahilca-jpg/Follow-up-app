import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { canSendOn } from "@/lib/sendChannels";
import { heldSince } from "@/lib/pendingApprovals";
import { NO_ANSWER_REASON } from "@/lib/holdReasons";
import {
  NEW_CUSTOMER_WINDOW_MS,
  NO_ANSWER_EMAIL,
  NO_ANSWER_TEXT,
  behindThisWeek,
  isCallablePhone,
  isNoAnswerDraft,
  nextCallAfter,
  noAnswerEmail,
  noAnswerText,
  startOfLocalWeek,
} from "@/lib/callPlan";

/**
 * The realtor team pilot (design brain A-103, founder 2026-10-07): the
 * database side of "No answer", "Already spoke" as a call, the calls to
 * make on Today, and "This week" on the Team page. The rules themselves
 * are in src/lib/callPlan.ts.
 *
 * Everything here is behind Business.teamCalls. With it off, nothing is
 * recorded and nothing shows, so a business that never asked for calls
 * sees no change.
 */

export const TEAM_CALLS_OFF = "Turn on “Your team calls customers” on the Team page first.";

export async function teamCallsOn(businessId: string): Promise<boolean> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: { teamCalls: true } });
  return b?.teamCalls ?? false;
}

/**
 * Where a run of unanswered calls starts: the customer's newest message,
 * the newest "spoke" call, or the owner's "Already spoke", whichever is
 * latest. A customer who wrote back or was reached starts a fresh run, so
 * they can get one new text the next time nobody picks up.
 */
async function runStart(leadId: string, talkedAt: Date | null): Promise<Date> {
  const [inbound, spoke] = await Promise.all([
    prisma.message.findFirst({ where: { direction: "inbound", conversation: { leadId } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
    prisma.callAttempt.findFirst({ where: { leadId, outcome: "spoke" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const times = [inbound?.sentAt, spoke?.createdAt, talkedAt].filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return new Date(times.length ? Math.max(...times) : 0);
}

export type NoAnswerResult =
  | { success: true; attempt: number; nextCallAt: string | null; drafted: "text" | "email" | null; note: string }
  | { success: false; message: string };

/**
 * "No answer": records the call, plans the next one, and on the first
 * unanswered call of a run writes one short message asking for a good time.
 * The message is HELD (an "ai.hold"), so it waits on Today for a person to
 * send it, like every reply during the trial. It is never sent from here.
 */
export async function recordNoAnswer(leadId: string, businessId: string, userId: string | null, now = new Date()): Promise<NoAnswerResult> {
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { teamCalls: true, name: true } });
  if (!business?.teamCalls) return { success: false, message: TEAM_CALLS_OFF };
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId },
    select: { id: true, name: true, phone: true, email: true, optedOutAt: true, talkedAt: true, suggestedDraftKind: true },
  });
  if (!lead) return { success: false, message: "Lead not found." };

  await prisma.callAttempt.create({ data: { businessId, leadId, userId, outcome: "no_answer", createdAt: now } });
  const since = await runStart(leadId, lead.talkedAt);
  const unanswered = await prisma.callAttempt.count({ where: { leadId, outcome: "no_answer", createdAt: { gt: since } } });
  const nextCallAt = nextCallAfter(now, unanswered);
  await prisma.lead.update({ where: { id: leadId }, data: { nextCallAt } });

  const first = lead.name.split(" ")[0] ?? "";
  let drafted: "text" | "email" | null = null;
  let note = nextCallAt ? "Next call tomorrow." : `That's ${unanswered} calls with no answer. FollowUp stops planning calls to ${first}.`;

  if (unanswered === 1) {
    // A reply that is already waiting for an OK is the next message to this
    // customer; a second one beside it would be two messages at once.
    const otherHeld = !isNoAnswerDraft(lead.suggestedDraftKind) && (await heldSince(businessId, leadId, new Date(0)).catch(() => true));
    if (otherHeld) {
      note = `A reply to ${first} is already waiting for your OK, so FollowUp didn't write another.`;
    } else {
      const caller = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
      const callerFirst = caller?.name?.trim().split(" ")[0] || null;
      const businessName = business.name?.trim() || null;
      const canText = isCallablePhone(lead.phone) && !lead.optedOutAt && (await canSendOn(businessId, "text"));
      const canEmail = !canText && !!lead.email && (await canSendOn(businessId, "email"));
      if (canText || canEmail) {
        const email = noAnswerEmail(first, callerFirst, businessName);
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            suggestedMessage: canText ? noAnswerText(first, callerFirst, businessName) : email.body,
            suggestedSubject: canText ? null : email.subject,
            suggestedQuickReplies: undefined,
            suggestedDraftKind: canText ? NO_ANSWER_TEXT : NO_ANSWER_EMAIL,
            suggestedDraftedFor: now,
            suggestedRiskLevel: null,
            suggestedRiskReason: null,
            suggestedRiskTopic: null,
          },
        });
        const held = await recordAudit({ businessId, userId }, "ai.hold", {
          targetType: "lead",
          targetId: leadId,
          meta: { riskLevel: "owner", reason: NO_ANSWER_REASON, trigger: "no_answer" },
        });
        if (held !== false) {
          drafted = canText ? "text" : "email";
          note = canText ? `A text asking ${first} for a good time is waiting for your OK.` : `An email asking ${first} for a good time is waiting for your OK.`;
        }
      } else {
        note = `FollowUp can't text ${first}: no text number is connected${lead.email ? " and no inbox either" : ""}.`;
      }
    }
  }

  await recordAudit({ businessId, userId }, "lead.call_no_answer", { targetType: "lead", targetId: leadId, meta: { attempt: unanswered, drafted } });
  return { success: true, attempt: unanswered, nextCallAt: nextCallAt?.toISOString() ?? null, drafted, note };
}

/** Undo of "No answer": the newest one on this customer, from the last two hours, and the text it wrote if nobody has sent it. */
export async function undoNoAnswer(leadId: string, businessId: string, userId: string | null, now = new Date()): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, talkedAt: true, suggestedDraftKind: true, suggestedDraftedFor: true } });
  if (!lead) return { success: false, message: "Lead not found." };
  const attempt = await prisma.callAttempt.findFirst({
    where: { leadId, businessId, outcome: "no_answer", createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) return { success: false, message: "There's no recent “No answer” to undo." };
  await prisma.callAttempt.delete({ where: { id: attempt.id } });

  // The text it wrote, unless it has gone: a sent message is a real message.
  if (isNoAnswerDraft(lead.suggestedDraftKind) && lead.suggestedDraftedFor && lead.suggestedDraftedFor >= attempt.createdAt && (await heldSince(businessId, leadId, attempt.createdAt).catch(() => false))) {
    await prisma.lead.update({ where: { id: leadId }, data: { suggestedMessage: null, suggestedSubject: null, suggestedDraftKind: null, suggestedRiskLevel: null } });
  }

  const since = await runStart(leadId, lead.talkedAt);
  const remaining = await prisma.callAttempt.findMany({ where: { leadId, outcome: "no_answer", createdAt: { gt: since } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  const nextCallAt = remaining.length ? nextCallAfter(remaining[0].createdAt, remaining.length) : null;
  await prisma.lead.update({ where: { id: leadId }, data: { nextCallAt } });
  await recordAudit({ businessId, userId }, "lead.call_no_answer_undone", { targetType: "lead", targetId: leadId });
  return { success: true };
}

/**
 * "Already spoke", as a call (markTalked.ts calls this). Counted on the
 * Team page as someone reached, and no further call is planned. Only while
 * the business has calls on.
 */
export async function recordSpoke(leadId: string, businessId: string, userId: string | null, undo: boolean): Promise<void> {
  if (!(await teamCallsOn(businessId))) return;
  if (undo) {
    const last = await prisma.callAttempt.findFirst({ where: { leadId, businessId, outcome: "spoke" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    if (last) await prisma.callAttempt.delete({ where: { id: last.id } });
    return;
  }
  await prisma.callAttempt.create({ data: { businessId, leadId, userId, outcome: "spoke" } });
  await prisma.lead.update({ where: { id: leadId }, data: { nextCallAt: null } });
}

export type CallToMake = {
  leadId: string;
  name: string;
  phone: string;
  source: string | null;
  /** 1 for a customer nobody has called yet. */
  callNumber: number;
  /** When the last unanswered call was, ISO; null for a first call. */
  lastTriedAt: string | null;
  /** When they arrived (first call) or when the call came due, ISO. */
  dueSince: string;
  /** A text asking for a good time went out after the last call. */
  texted: boolean;
};

const DONE_STAGES = ["WON", "LOST"] as const;

/**
 * The calls to make now, for one person (their own customers and anyone
 * not yet given to someone), or for everyone when `userId` is null.
 *
 * Two kinds: a call that came due after "No answer" (Lead.nextCallAt), and
 * a new customer with a phone number that nobody has called, written to or
 * spoken with yet. Anyone who wrote back since the last call, said no, or
 * was reached is left off: the reply is on Today already.
 */
export async function getCallsToMake(businessId: string, userId: string | null, now = new Date()): Promise<CallToMake[]> {
  if (!(await teamCallsOn(businessId))) return [];
  const mine = userId ? { OR: [{ assignedToId: userId }, { assignedToId: null }] } : {};
  const common = { businessId, saidNoAt: null, stage: { notIn: [...DONE_STAGES] }, ...mine };
  const select = {
    id: true,
    name: true,
    phone: true,
    source: true,
    createdAt: true,
    nextCallAt: true,
    talkedAt: true,
    callAttempts: { orderBy: { createdAt: "desc" as const }, take: 5, select: { outcome: true, createdAt: true } },
    conversations: { select: { messages: { orderBy: { sentAt: "desc" as const }, take: 1, select: { direction: true, sentAt: true } } } },
  };
  const [due, fresh] = await Promise.all([
    prisma.lead.findMany({ where: { ...common, nextCallAt: { lte: now } }, select, orderBy: { nextCallAt: "asc" }, take: 200 }),
    prisma.lead.findMany({
      where: {
        ...common,
        nextCallAt: null,
        talkedAt: null,
        phone: { not: null },
        createdAt: { gte: new Date(now.getTime() - NEW_CUSTOMER_WINDOW_MS) },
        callAttempts: { none: {} },
        conversations: { none: { messages: { some: { direction: "outbound" } } } },
      },
      select,
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  const out: CallToMake[] = [];
  for (const l of [...due, ...fresh]) {
    if (!isCallablePhone(l.phone)) continue;
    const lastCall = l.callAttempts[0] ?? null;
    const newest = l.conversations.flatMap((c) => c.messages).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
    const lastInbound = newest.find((m) => m.direction === "inbound");
    // They answered after the last call, or someone reached them: no call owed.
    if (lastCall && lastInbound && lastInbound.sentAt > lastCall.createdAt) continue;
    if (lastCall?.outcome === "spoke") continue;
    if (lastCall && l.talkedAt && l.talkedAt > lastCall.createdAt) continue;
    const unanswered = (() => {
      let n = 0;
      for (const c of l.callAttempts) {
        if (c.outcome !== "no_answer") break;
        n++;
      }
      return n;
    })();
    const lastOutbound = newest.find((m) => m.direction === "outbound");
    out.push({
      leadId: l.id,
      name: l.name,
      phone: l.phone as string,
      source: l.source,
      callNumber: unanswered + 1,
      lastTriedAt: lastCall?.createdAt.toISOString() ?? null,
      dueSince: (l.nextCallAt ?? l.createdAt).toISOString(),
      texted: !!(lastCall && lastOutbound && lastOutbound.sentAt > lastCall.createdAt),
    });
  }
  return out;
}

export type TeamWeekRow = { userId: string; name: string; calls: number; spoke: number; meetings: number; lateCalls: number; behind: boolean };
export type TeamWeek = {
  weekStart: string;
  calls: number;
  spoke: number;
  meetings: number;
  /** Meetings booked by the same point last week. */
  meetingsLastWeek: number;
  people: TeamWeekRow[];
};

/**
 * "This week" on the Team page, for admins: each person's calls (every
 * No answer and Already spoke they tapped), how many of those reached
 * someone, and the meetings booked on their customers through the booking
 * link. Null when the business has calls off.
 */
export async function getTeamWeek(businessId: string, timezone: string, now = new Date()): Promise<TeamWeek | null> {
  if (!(await teamCallsOn(businessId))) return null;
  const weekStart = startOfLocalWeek(now, timezone);
  const lastWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekNow = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [users, attempts, bookings, lastWeekBookings, open] = await Promise.all([
    prisma.user.findMany({ where: { businessId }, select: { id: true, name: true, email: true }, orderBy: { createdAt: "asc" } }),
    prisma.callAttempt.findMany({ where: { businessId, createdAt: { gte: weekStart, lte: now } }, select: { userId: true, outcome: true } }),
    prisma.booking.findMany({ where: { businessId, status: "confirmed", createdAt: { gte: weekStart, lte: now } }, select: { lead: { select: { assignedToId: true } } } }),
    prisma.booking.count({ where: { businessId, status: "confirmed", createdAt: { gte: lastWeekStart, lte: lastWeekNow } } }),
    getCallsToMake(businessId, null, now),
  ]);
  const late = new Map<string, number>();
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  const ownerOf = new Map(
    (await prisma.lead.findMany({ where: { id: { in: open.map((c) => c.leadId) } }, select: { id: true, assignedToId: true } })).map((l) => [l.id, l.assignedToId])
  );
  for (const c of open) {
    const who = ownerOf.get(c.leadId);
    if (who && new Date(c.dueSince).getTime() < dayAgo) late.set(who, (late.get(who) ?? 0) + 1);
  }
  const people: TeamWeekRow[] = users.map((u) => {
    const mine = attempts.filter((a) => a.userId === u.id);
    const meetings = bookings.filter((b) => b.lead.assignedToId === u.id).length;
    const lateCalls = late.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.name?.trim() || u.email.split("@")[0],
      calls: mine.length,
      spoke: mine.filter((a) => a.outcome === "spoke").length,
      meetings,
      lateCalls,
      // Only someone who is calling is judged: an owner who doesn't make calls is never flagged for it.
      behind: (mine.length > 0 || lateCalls > 0) && behindThisWeek({ meetings, lateCalls }, weekStart, now),
    };
  });
  return {
    weekStart: weekStart.toISOString(),
    calls: attempts.length,
    spoke: attempts.filter((a) => a.outcome === "spoke").length,
    meetings: bookings.length,
    meetingsLastWeek: lastWeekBookings,
    people,
  };
}

/** "Later" on a call card: back on Today in this long. */
export const CALL_LATER_MS = 3 * 60 * 60 * 1000;

/**
 * "Later" on a call (A-103): the call comes back to Today in three hours.
 * Undo puts back what was there before, read from the audit row that
 * recorded it, so a new customer who was never planned goes back to that.
 */
export async function callLater(leadId: string, businessId: string, userId: string | null, undo: boolean, now = new Date()): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true, nextCallAt: true } });
  if (!lead) return { success: false, message: "Lead not found." };
  if (undo) {
    const last = await prisma.auditEvent.findFirst({
      where: { businessId, action: "lead.call_later", targetType: "lead", targetId: leadId, createdAt: { gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      select: { meta: true },
    });
    if (!last) return { success: false, message: "There's nothing to undo." };
    const prev = (last.meta as { prev?: string | null } | null)?.prev ?? null;
    await prisma.lead.update({ where: { id: leadId }, data: { nextCallAt: prev ? new Date(prev) : null } });
    await recordAudit({ businessId, userId }, "lead.call_later_undone", { targetType: "lead", targetId: leadId });
    return { success: true };
  }
  await prisma.lead.update({ where: { id: leadId }, data: { nextCallAt: new Date(now.getTime() + CALL_LATER_MS) } });
  await recordAudit({ businessId, userId }, "lead.call_later", { targetType: "lead", targetId: leadId, meta: { prev: lead.nextCallAt?.toISOString() ?? null } });
  return { success: true };
}
