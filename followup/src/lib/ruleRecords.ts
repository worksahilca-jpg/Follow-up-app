import { prisma } from "@/lib/db";
import { DEAD_LEAD_ACTION } from "@/lib/automation";
import { getPendingApprovals } from "@/lib/pendingApprovals";

/**
 * "This week: wrote 12 · sent 9 · 3 waiting" under each rule in Settings
 * (design brain A-044, the Zapier study: every rule has a record).
 *
 * Counted from what already exists, nothing new is stored:
 * - a draft a rule held is its "ai.hold" audit event, whose meta names the
 *   rule (`trigger`);
 * - a message a rule sent by itself is a FollowUp row with that trigger;
 * - a held draft counts as sent once anything went to that customer after
 *   it (the owner's Approve & send goes out as a "manual" send, so the
 *   rule is read off the hold, not off the send).
 * "Waiting" is the approvals queue right now, the same list Today shows.
 */
export const RULE_KEYS = ["instant_ack", "unanswered", "silence", DEAD_LEAD_ACTION] as const;
export type RuleKey = (typeof RULE_KEYS)[number];
export type RuleRecord = { wrote: number; sent: number; waiting: number };

const SCAN_LIMIT = 2000;

function isRuleKey(v: unknown): v is RuleKey {
  return typeof v === "string" && (RULE_KEYS as readonly string[]).includes(v);
}

export async function getRuleRecords(businessId: string, now: Date = new Date()): Promise<Record<RuleKey, RuleRecord>> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const out = Object.fromEntries(RULE_KEYS.map((k) => [k, { wrote: 0, sent: 0, waiting: 0 }])) as Record<RuleKey, RuleRecord>;

  const [holds, autoSent, pending] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { businessId, action: "ai.hold", targetType: "lead", targetId: { not: null }, createdAt: { gte: since } },
      select: { targetId: true, createdAt: true, meta: true },
      orderBy: { createdAt: "asc" },
      take: SCAN_LIMIT,
    }),
    prisma.followUp.findMany({
      where: { automated: true, status: "sent", sentAt: { gte: since }, trigger: { in: [...RULE_KEYS] }, lead: { businessId } },
      select: { id: true, leadId: true, trigger: true, sentAt: true },
      take: SCAN_LIMIT,
    }),
    getPendingApprovals(businessId),
  ]);

  const ruleHolds = holds
    .map((h) => ({ leadId: h.targetId as string, at: h.createdAt, rule: ((h.meta ?? {}) as Record<string, unknown>).trigger }))
    .filter((h): h is { leadId: string; at: Date; rule: RuleKey } => isRuleKey(h.rule));

  // Every send to a held customer after the earliest hold, whatever sent it.
  const heldLeadIds = [...new Set(ruleHolds.map((h) => h.leadId))];
  const laterSends = heldLeadIds.length
    ? await prisma.followUp.findMany({
        where: { leadId: { in: heldLeadIds }, status: "sent", sentAt: { gte: ruleHolds[0].at } },
        select: { id: true, leadId: true, sentAt: true },
        orderBy: { sentAt: "asc" },
        take: SCAN_LIMIT,
      })
    : [];
  const sendsByLead = new Map<string, { id: string; sentAt: Date }[]>();
  for (const s of laterSends) {
    if (!s.sentAt) continue;
    const list = sendsByLead.get(s.leadId) ?? [];
    list.push({ id: s.id, sentAt: s.sentAt });
    sendsByLead.set(s.leadId, list);
  }
  const holdsByLead = new Map<string, Date[]>();
  for (const h of ruleHolds) holdsByLead.set(h.leadId, [...(holdsByLead.get(h.leadId) ?? []), h.at]);

  // A send that resolved a hold is counted once, through the hold.
  const usedSends = new Set<string>();
  for (const h of ruleHolds) {
    out[h.rule].wrote += 1;
    const nextHold = (holdsByLead.get(h.leadId) ?? []).find((t) => t > h.at);
    const resolved = (sendsByLead.get(h.leadId) ?? []).find((s) => s.sentAt > h.at && (!nextHold || s.sentAt <= nextHold));
    if (resolved) {
      out[h.rule].sent += 1;
      usedSends.add(resolved.id);
    }
  }
  for (const f of autoSent) {
    if (usedSends.has(f.id) || !isRuleKey(f.trigger)) continue;
    out[f.trigger].wrote += 1;
    out[f.trigger].sent += 1;
  }
  for (const p of pending) if (isRuleKey(p.trigger)) out[p.trigger].waiting += 1;
  return out;
}
