import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";

/**
 * The approval queue — research/product/2026-09-10-ux-simplification.md
 * section 0.6's "single biggest structural gap": the risk gate holds a
 * draft (src/lib/automation.ts, the "ai.hold" AuditEvent) but nothing
 * before this showed the owner "what needs my OK right now" as a single
 * list of one-click decisions. A held draft on an unassigned/pond lead
 * used to notify nobody at all (see notifyNeglect's early return, now
 * fixed) and otherwise only surfaced buried inside that one lead's own
 * page — indistinguishable there from the "AI-suggested follow-up" box
 * every lead shows regardless of whether anything was actually held.
 *
 * A pending approval is derived, not stored separately: it's simply a
 * lead whose most recent AuditEvent is still "ai.hold". A later
 * "ai.send" (approved and sent, or a normal automated send since),
 * "lead.send" (sent manually — edited or not), or "ai.hold_dismissed"
 * (explicitly declined, see dismissHold below) all mean it's been
 * resolved and the lead drops out of the queue on its own, with no
 * separate "resolved" flag to keep in sync.
 */
const SCAN_LIMIT = 500;

// How much of the lead's own message to carry into the queue — this is a
// compact list view, not the full lead page; a reviewer needs enough to
// judge the draft against, not the whole email. Truncated, never the raw
// length, so one long inbound email can't blow out the dashboard.
const LEAD_MESSAGE_PREVIEW_LENGTH = 400;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export type PendingApproval = {
  leadId: string;
  leadName: string;
  riskLevel: string;
  reason: string;
  trigger: string;
  heldAt: Date;
  draftSubject: string | null;
  draftMessage: string;
  // What the lead actually said, most recent inbound message across every
  // channel they've used — null only when there's genuinely no inbound
  // message on record (a manually-created lead with a draft but no real
  // conversation yet). Without this, approving a draft meant judging it
  // with no visible context for what it's actually replying to.
  leadLastMessage: string | null;
  leadLastMessageChannel: string | null;
};

export async function getPendingApprovals(businessId: string): Promise<PendingApproval[]> {
  // One row per lead — the most recent AuditEvent naming that lead —
  // scoped to a bounded recent window so a business with years of audit
  // history doesn't force a full-table distinct scan on every dashboard
  // load. A held draft is meant to be resolved within days; anything
  // older than this scan window has functionally gone stale anyway, and
  // a stale hold that never got resolved is a real bug worth surfacing
  // some other way (a metrics pass), not by scanning the whole table on
  // every page load.
  const recentEvents = await prisma.auditEvent.findMany({
    where: { businessId, targetType: "lead", targetId: { not: null } },
    orderBy: { createdAt: "desc" },
    distinct: ["targetId"],
    take: SCAN_LIMIT,
  });

  const held = recentEvents.filter((e) => e.action === "ai.hold" && e.targetId);
  if (held.length === 0) return [];

  const leads = await prisma.lead.findMany({
    where: { id: { in: held.map((e) => e.targetId as string) }, businessId },
    select: {
      id: true,
      name: true,
      suggestedSubject: true,
      suggestedMessage: true,
      // One inbound message per conversation (the most recent), not the
      // whole thread — a lead can have several conversations across
      // channels (an old email thread plus a newer text, say), so the
      // actual "what did they last say" is the max sentAt across all of
      // these, reduced below, not just the first conversation's.
      conversations: {
        select: {
          channel: true,
          messages: { where: { direction: "inbound" }, orderBy: { sentAt: "desc" }, take: 1, select: { body: true, sentAt: true } },
        },
      },
    },
  });
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const approvals: PendingApproval[] = [];
  for (const event of held) {
    const lead = leadById.get(event.targetId as string);
    // No draft text to show (the hold predates suggestedMessage being
    // set, or the lead was deleted) — nothing for the owner to approve.
    if (!lead?.suggestedMessage) continue;
    const meta = (event.meta ?? {}) as Record<string, unknown>;

    let lastInbound: { body: string; channel: string; sentAt: Date } | null = null;
    for (const c of lead.conversations ?? []) {
      const m = c.messages[0];
      if (m && (!lastInbound || m.sentAt > lastInbound.sentAt)) lastInbound = { body: m.body, channel: c.channel, sentAt: m.sentAt };
    }

    approvals.push({
      leadId: lead.id,
      leadName: lead.name,
      riskLevel: typeof meta.riskLevel === "string" ? meta.riskLevel : "medium",
      reason: typeof meta.reason === "string" ? meta.reason : "",
      trigger: typeof meta.trigger === "string" ? meta.trigger : "silence",
      heldAt: event.createdAt,
      draftSubject: lead.suggestedSubject,
      draftMessage: lead.suggestedMessage,
      leadLastMessage: lastInbound ? truncate(lastInbound.body, LEAD_MESSAGE_PREVIEW_LENGTH) : null,
      leadLastMessageChannel: lastInbound?.channel ?? null,
    });
  }
  return approvals.sort((a, b) => b.heldAt.getTime() - a.heldAt.getTime());
}

/**
 * "Don't send" — explicitly declines a held draft. Never deletes the
 * original "ai.hold" event (the audit trail is append-only) and never
 * touches the lead's cached suggestedMessage; writing this newer event
 * for the same lead is what drops it out of getPendingApprovals above,
 * the same mechanism a real send already used.
 */
export async function dismissHold(
  leadId: string,
  businessId: string,
  userId: string | null
): Promise<{ success: boolean; message?: string }> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, businessId }, select: { id: true } });
  if (!lead) return { success: false, message: "Lead not found." };
  await recordAudit({ businessId, userId }, "ai.hold_dismissed", { targetType: "lead", targetId: leadId });
  return { success: true };
}
