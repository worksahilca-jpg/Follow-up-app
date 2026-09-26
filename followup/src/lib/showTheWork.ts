/**
 * Server-side data for "show the work, not the robot" (design brain
 * A-043, the Intercom study): the "Based on" line on each waiting reply,
 * and the "sent as written" proof on Today.
 */
import { prisma } from "@/lib/db";
import { describeBasis } from "@/lib/basedOn";

/** Adds `basis` to each waiting reply, from that customer's own messages. */
export async function withBasis<T extends { leadId: string; leadName: string; draftMessage: string }>(
  items: T[],
  timeZone?: string
): Promise<(T & { basis: string | null })[]> {
  if (items.length === 0) return [];
  const rows = await prisma.message.findMany({
    where: { conversation: { leadId: { in: items.map((i) => i.leadId) } } },
    orderBy: { sentAt: "desc" },
    take: Math.min(60 * items.length, 2000),
    select: { direction: true, body: true, sentAt: true, source: true, conversation: { select: { leadId: true, channel: true } } },
  });
  const byLead = new Map<string, typeof rows>();
  for (const r of rows) {
    const id = r.conversation.leadId;
    const list = byLead.get(id) ?? [];
    list.push(r);
    byLead.set(id, list);
  }
  return items.map((item) => ({
    ...item,
    basis: describeBasis({
      draft: item.draftMessage,
      leadFirstName: item.leadName.split(" ")[0] ?? "",
      messages: (byLead.get(item.leadId) ?? []).map((m) => ({
        direction: m.direction === "inbound" ? "inbound" : "outbound",
        body: m.body,
        sentAt: m.sentAt,
        source: m.source,
        channel: m.conversation.channel,
      })),
      timeZone,
    }),
  }));
}

/**
 * Of the replies a person sent since `since` that started as a FollowUp
 * draft, how many went out exactly as written (FollowUp.draftEdited,
 * recorded for every account at send time). Automated sends and replies
 * typed from scratch have no draft to compare with, so they don't count.
 */
export async function sentAsWritten(businessId: string, since: Date): Promise<{ asWritten: number; total: number }> {
  const rows = await prisma.followUp.groupBy({
    by: ["draftEdited"],
    where: { automated: false, status: "sent", sentAt: { gte: since }, draftEdited: { not: null }, lead: { businessId } },
    _count: { _all: true },
  });
  let asWritten = 0;
  let total = 0;
  for (const r of rows) {
    total += r._count._all;
    if (r.draftEdited === false) asWritten += r._count._all;
  }
  return { asWritten, total };
}
