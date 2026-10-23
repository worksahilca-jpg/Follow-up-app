import { prisma } from "@/lib/db";
import { ownerActionOf, outcomeOf, type Outcome, type OutcomeSummary, type OwnerAction } from "@/lib/decisionOutcome";
import { dmSuppressionKey, normaliseAddress } from "@/lib/suppression";

/**
 * For every reply FollowUp wrote since a date: the AI call that wrote it (the decision log), what the owner did with it
 * and what the customer did next (src/lib/decisionOutcome.ts). Step 2 of research/product/2026-10-23-self-improving-loop.md;
 * the founder's weekly review (step 7) reads it. Ids, labels and times only: no one's words.
 */
export interface DraftOutcome {
  responseId: string;
  leadId: string;
  /** When it went out, or when the owner turned it down. */
  at: Date;
  purpose: string | null;
  model: string | null;
  lessonsHash: string | null;
  ownerAction: OwnerAction;
  editSize: number | null;
  outcome: Outcome;
}

const firstAfter = (dates: readonly Date[] | undefined, at: Date): Date | null =>
  (dates ?? []).filter((d) => d.getTime() >= at.getTime()).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

export async function loadDraftOutcomes(since: Date, now: Date = new Date()): Promise<DraftOutcome[]> {
  const [sends, dismissals] = await Promise.all([
    prisma.followUp.findMany({
      where: { status: "sent", sentAt: { gte: since }, responseId: { not: null } },
      select: { responseId: true, leadId: true, sentAt: true, automated: true, editSize: true },
    }),
    prisma.auditEvent.findMany({
      where: { action: "ai.hold_dismissed", targetType: "lead", createdAt: { gte: since } },
      select: { targetId: true, createdAt: true, meta: true },
    }),
  ]);
  const items = [
    ...sends.map((s) => ({ responseId: s.responseId!, leadId: s.leadId, at: s.sentAt!, ownerAction: ownerActionOf({ automated: s.automated, editSize: s.editSize }), editSize: s.editSize })),
    ...dismissals.flatMap((d) => {
      const responseId = (d.meta as { responseId?: unknown } | null)?.responseId;
      return typeof responseId === "string" && d.targetId
        ? [{ responseId, leadId: d.targetId, at: d.createdAt, ownerAction: ownerActionOf({ dismissed: true }), editSize: null }]
        : [];
    }),
  ];
  if (items.length === 0) return [];

  const leadIds = [...new Set(items.map((i) => i.leadId))];
  const [decisions, leads, bookings, replies] = await Promise.all([
    prisma.aiDecision.findMany({
      where: { responseId: { in: items.map((i) => i.responseId) } },
      select: { responseId: true, purpose: true, modelUsed: true, lessonsHash: true },
    }),
    prisma.lead.findMany({ where: { id: { in: leadIds } }, select: { id: true, businessId: true, email: true, phone: true, saidNoAt: true } }),
    prisma.booking.findMany({ where: { leadId: { in: leadIds }, createdAt: { gte: since } }, select: { leadId: true, createdAt: true } }),
    prisma.message.findMany({
      where: { direction: "inbound", sentAt: { gte: since }, conversation: { leadId: { in: leadIds } } },
      select: { sentAt: true, conversation: { select: { leadId: true } } },
    }),
  ]);

  // Who asked not to be contacted: an unsubscribe or STOP is kept by address (src/lib/suppression.ts).
  const keyOf = (businessId: string, channel: string, address: string) => `${businessId}|${channel}|${address}`;
  const leadKeys = new Map<string, string[]>();
  for (const l of leads) {
    const keys: string[] = [];
    if (l.email) keys.push(keyOf(l.businessId, "email", normaliseAddress(l.email)));
    const dm = dmSuppressionKey(l.phone);
    if (dm) keys.push(keyOf(l.businessId, dm.channel, normaliseAddress(dm.address)));
    leadKeys.set(l.id, keys);
  }
  const addresses = [...new Set([...leadKeys.values()].flat().map((k) => k.split("|")[2]))];
  const stops = addresses.length
    ? await prisma.suppression.findMany({
        where: { businessId: { in: [...new Set(leads.map((l) => l.businessId))] }, address: { in: addresses } },
        select: { businessId: true, channel: true, address: true, createdAt: true },
      })
    : [];
  const stoppedAt = new Map(stops.map((s) => [keyOf(s.businessId, s.channel, s.address), s.createdAt]));

  const byResponse = new Map(decisions.map((d) => [d.responseId, d]));
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const group = <T extends { leadId: string }>(rows: T[], date: (r: T) => Date) => {
    const map = new Map<string, Date[]>();
    for (const r of rows) map.set(r.leadId, [...(map.get(r.leadId) ?? []), date(r)]);
    return map;
  };
  const bookedBy = group(bookings, (b) => b.createdAt);
  const repliedBy = group(
    replies.map((m) => ({ leadId: m.conversation.leadId, sentAt: m.sentAt })),
    (m) => m.sentAt
  );

  return items.map((i) => {
    const decision = byResponse.get(i.responseId);
    const lead = leadById.get(i.leadId);
    const stops = (leadKeys.get(i.leadId) ?? []).map((k) => stoppedAt.get(k)).filter((d): d is Date => !!d);
    return {
      responseId: i.responseId,
      leadId: i.leadId,
      at: i.at,
      purpose: decision?.purpose ?? null,
      model: decision?.modelUsed ?? null,
      lessonsHash: decision?.lessonsHash ?? null,
      ownerAction: i.ownerAction,
      editSize: i.editSize,
      outcome: outcomeOf({
        sentAt: i.at,
        repliedAt: firstAfter(repliedBy.get(i.leadId), new Date(i.at.getTime() + 1)),
        bookedAt: firstAfter(bookedBy.get(i.leadId), i.at),
        saidNoAt: lead?.saidNoAt ?? null,
        stoppedAt: firstAfter(stops, i.at),
        now,
      }),
    };
  });
}

/** The counts the founder reads: what owners did with FollowUp's drafts, and what customers did next. */
export function summarizeDraftOutcomes(rows: readonly DraftOutcome[]): {
  total: number;
  byAction: Record<OwnerAction, number>;
  byOutcome: Record<OutcomeSummary, number>;
} {
  const byAction: Record<OwnerAction, number> = { sent_by_itself: 0, sent_as_written: 0, edited: 0, rewritten: 0, not_sent: 0 };
  const byOutcome: Record<OutcomeSummary, number> = { stopped: 0, said_no: 0, booked: 0, replied: 0, quiet: 0, waiting: 0 };
  for (const r of rows) {
    byAction[r.ownerAction] += 1;
    byOutcome[r.outcome.summary] += 1;
  }
  return { total: rows.length, byAction, byOutcome };
}
