/**
 * The "what did FollowUp actually do on my behalf" feed — Settings has the
 * safety guarantee in prose ("automation stops the instant a lead
 * replies"); this is proof, not a promise. Every business owner asking
 * "wait, did it actually send that?" or "did the stop-on-reply thing
 * really work?" should be able to just look here instead of taking it on
 * faith.
 *
 * Deliberately built on data that already exists rather than a new
 * event-log table: an automated FollowUp row IS the record of "automation
 * sent this," and the Notification rows already created for the
 * stop-on-reply pause and the rapid-engagement handoff (see
 * src/lib/sequences.ts / src/lib/engagement.ts) are already exactly the
 * "automation did something noteworthy" signal this feed needs — this
 * just gives them one unified, chronological home instead of leaving them
 * scattered across the bell dropdown and nowhere else.
 */

import { prisma } from "@/lib/db";
import { HOLD_SUMMARY_MARKER } from "@/lib/holdNotices";

/**
 * "notice": something only the bell used to say, now that Activity has its
 * place (A-256): a reply that couldn't go, an inbox FollowUp lost, a
 * customer who is back. Each one is for the owner to act on.
 */
export type ActivityType = "automated_send" | "sequence_paused" | "rapid_engagement" | "sequence_completed" | "held" | "notice";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  leadId: string | null;
  leadName: string | null;
  message: string;
  detail: string | null; // the sent message (automated_send), or why a reply was held (held)
  occurredAt: string; // ISO
}

const LIMIT = 60;

/**
 * `viewerId`: notifications are addressed to one person (the customer's
 * owner, or the admins), so each person sees their own; what FollowUp sent,
 * held or finished is the business's and everyone in it sees that.
 */
export async function getActivityFeed(businessId: string, viewerId: string): Promise<ActivityItem[]> {
  const [automatedSends, notifications, completedSequences, holds] = await Promise.all([
    prisma.followUp.findMany({
      where: { automated: true, status: "sent", sentAt: { not: null }, lead: { businessId } },
      select: { id: true, leadId: true, message: true, sentAt: true, lead: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: LIMIT,
    }),
    // Notification has no businessId column (it's per-user): the viewer's
    // own, and only while they belong to this business.
    // "… waiting for your approval" lines are left out: every one of them is a
    // reply Today already shows (A-256, R-116: 95 of the bell's 108 lines).
    prisma.notification.findMany({
      where: { userId: viewerId, user: { businessId }, NOT: { message: { contains: HOLD_SUMMARY_MARKER } } },
      select: { id: true, leadId: true, message: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.lead.findMany({
      where: { businessId, sequenceCompletedAt: { not: null } },
      select: { id: true, name: true, sequenceCompletedAt: true },
      orderBy: { sequenceCompletedAt: "desc" },
      take: LIMIT,
    }),
    // A reply FollowUp wrote but held for the owner's OK. The same row
    // pendingApprovals.ts builds the queue from; its reason is the one the
    // Inbox shows ("Held because …").
    prisma.auditEvent.findMany({
      where: { businessId, action: "ai.hold", targetType: "lead", targetId: { not: null } },
      select: { id: true, targetId: true, meta: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
  ]);

  // Names for the rows that only carry an id (holds and notifications),
  // looked up within this business only.
  const namedIds = [
    ...new Set([...holds.map((h) => h.targetId as string), ...notifications.map((n) => n.leadId).filter((id): id is string => !!id)]),
  ];
  const namedLeads = namedIds.length
    ? await prisma.lead.findMany({ where: { businessId, id: { in: namedIds } }, select: { id: true, name: true } })
    : [];
  const leadNames = new Map(namedLeads.map((l) => [l.id, l.name]));

  const items: ActivityItem[] = [];

  for (const f of automatedSends) {
    items.push({
      id: `followup-${f.id}`,
      type: "automated_send",
      leadId: f.leadId,
      leadName: f.lead.name,
      message: `Automation sent ${f.lead.name} a follow-up`,
      detail: f.message,
      occurredAt: (f.sentAt as Date).toISOString(),
    });
  }

  for (const n of notifications) {
    items.push({
      id: `notif-${n.id}`,
      type: noticeType(n.message),
      leadId: n.leadId,
      leadName: n.leadId ? (leadNames.get(n.leadId) ?? null) : null,
      message: n.message,
      detail: null,
      occurredAt: n.createdAt.toISOString(),
    });
  }

  for (const l of completedSequences) {
    items.push({
      id: `seqdone-${l.id}`,
      type: "sequence_completed",
      leadId: l.id,
      leadName: l.name,
      message: `${l.name}'s workflow finished`,
      detail: null,
      occurredAt: (l.sequenceCompletedAt as Date).toISOString(),
    });
  }

  for (const h of holds) {
    const name = leadNames.get(h.targetId as string);
    // A lead deleted since keeps no name here, and is left out.
    if (!name) continue;
    const meta = (h.meta ?? {}) as Record<string, unknown>;
    const reason = typeof meta.reason === "string" ? meta.reason.trim().replace(/\.\s*$/, "") : "";
    items.push({
      id: `hold-${h.id}`,
      type: "held",
      leadId: h.targetId,
      leadName: name,
      message: `Held a reply for you: ${name}`,
      detail: reason ? `Because ${reason}.` : null,
      occurredAt: h.createdAt.toISOString(),
    });
  }

  items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return items.slice(0, LIMIT);
}

/**
 * No type column on Notification (see the model comment): two kinds have
 * distinct, stable message shapes (src/lib/sequences.ts,
 * src/lib/engagement.ts); everything else is a notice for the owner. The
 * message itself is written to stand alone, so a misread kind only changes
 * the label beside it.
 */
export function noticeType(message: string): ActivityType {
  if (message.includes("replied mid-sequence")) return "sequence_paused";
  if (message.includes("actively replying right now")) return "rapid_engagement";
  return "notice";
}
