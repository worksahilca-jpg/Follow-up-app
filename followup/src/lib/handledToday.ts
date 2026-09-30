import { prisma } from "@/lib/db";

/**
 * "1 of 5 handled today" (A-031, built with A-046): how many people the
 * owner dealt with since their own midnight.
 *
 * A person counts once, however they were handled: sent (lead.send),
 * declined (ai.hold_dismissed), or settled by "We talked" (lead.talked)
 * or its lead-site form, "I replied" (lead.replied_on_site, markTalked.ts).
 * "Send all routine" writes one business-level row carrying how many went,
 * so that number is added on top.
 */
const HANDLED = ["lead.send", "ai.hold_dismissed", "lead.talked", "lead.replied_on_site"];

export async function countHandledToday(businessId: string, since: Date): Promise<number> {
  const [perLead, bulk] = await Promise.all([
    prisma.auditEvent.findMany({
      where: { businessId, action: { in: HANDLED }, targetType: "lead", targetId: { not: null }, createdAt: { gte: since } },
      select: { targetId: true },
      distinct: ["targetId"],
    }),
    prisma.auditEvent.findMany({
      where: { businessId, action: "approvals.send_safe", createdAt: { gte: since } },
      select: { meta: true },
    }),
  ]);
  const bulkSent = bulk.reduce((n, e) => {
    const sent = ((e.meta ?? {}) as Record<string, unknown>).sent;
    return n + (typeof sent === "number" && sent > 0 ? sent : 0);
  }, 0);
  return perLead.length + bulkSent;
}
