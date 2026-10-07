/**
 * Server-side data for "show the work, not the robot" (design brain
 * A-043, the Intercom study): the "Based on" line on each waiting reply,
 * and the "sent as written" proof on Today.
 */
import { prisma } from "@/lib/db";
import { describeBasis } from "@/lib/basedOn";
import { wordsToCheck } from "@/lib/grounding";

/**
 * Adds `basis` to each waiting reply, from that customer's own messages, and
 * `checkWords`: the numbers, prices and days in the draft that nobody wrote
 * in the conversation or in what FollowUp knows (research round 2, #1), so
 * the card can underline them.
 */
export async function withBasis<T extends { leadId: string; leadName: string; draftMessage: string }>(
  items: T[],
  timeZone?: string,
  businessId?: string
): Promise<(T & { basis: string | null; checkWords: string[] })[]> {
  if (items.length === 0) return [];
  // The owner's own facts are theirs to have written (A-096): never a word to check.
  const factText = businessId
    ? (await prisma.businessFact.findMany({ where: { businessId }, select: { value: true } }).catch(() => [])).map((f) => f.value).join("\n")
    : "";
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
    checkWords: wordsToCheck(item.draftMessage, `${(byLead.get(item.leadId) ?? []).map((m) => m.body).join("\n")}\n${factText}`),
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

/**
 * The owner's own track record with FollowUp's drafts (research round 2, #3):
 * of the last `n` replies a person sent that started as a FollowUp draft,
 * how many went out exactly as written. Trust grows from feedback on how the
 * system actually performed (Lee & See 2004); this is that feedback, and the
 * honest basis for any later "send these without asking". Real rows only.
 */
export async function recentTrackRecord(businessId: string, n = 20): Promise<{ asWritten: number; total: number }> {
  const rows = await prisma.followUp.findMany({
    where: { automated: false, status: "sent", draftEdited: { not: null }, lead: { businessId } },
    orderBy: { sentAt: "desc" },
    take: n,
    select: { draftEdited: true },
  });
  return { asWritten: rows.filter((r) => r.draftEdited === false).length, total: rows.length };
}
