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

export type ActivityType = "automated_send" | "sequence_paused" | "rapid_engagement" | "sequence_completed";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  leadId: string | null;
  leadName: string | null;
  message: string;
  detail: string | null; // the actual sent message, for automated_send only
  occurredAt: string; // ISO
}

const LIMIT = 60;

export async function getActivityFeed(businessId: string): Promise<ActivityItem[]> {
  const [automatedSends, notifications, completedSequences] = await Promise.all([
    prisma.followUp.findMany({
      where: { automated: true, status: "sent", sentAt: { not: null }, lead: { businessId } },
      select: { id: true, leadId: true, message: true, sentAt: true, lead: { select: { name: true } } },
      orderBy: { sentAt: "desc" },
      take: LIMIT,
    }),
    // Notification has no businessId column (it's per-user) — reached via
    // the assigned user's own businessId instead.
    prisma.notification.findMany({
      where: { user: { businessId } },
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
  ]);

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
    // No type column on Notification (see the model comment) — the two
    // kinds this feed cares about have distinct, stable message shapes,
    // so a substring check is enough to pick an icon/label. The message
    // text itself (already written for the bell dropdown) reads fine
    // standalone either way, even if this ever misclassifies one.
    items.push({
      id: `notif-${n.id}`,
      type: n.message.includes("replied mid-sequence") ? "sequence_paused" : "rapid_engagement",
      leadId: n.leadId,
      leadName: null,
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

  items.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return items.slice(0, LIMIT);
}
