import { prisma } from "@/lib/db";
import { INBOX_SUMMARY_DAYS, INBOX_SUMMARY_SHOW_DAYS, summarizeInbox, type InboxSummary, type WaitingPerson } from "@/lib/inboxSummary";

const DAY = 86_400_000;
/** The practice customer (POST /api/leads/test-lead) is never counted as someone who wrote. */
const PRACTICE_SOURCE = "Test lead";

/**
 * "Your last 90 days" for this business (A-306, src/lib/inboxSummary.ts), or null when Today shouldn't show it: the
 * owner already pressed "Got it", no inbox has finished its first full read, the inbox was connected more than
 * INBOX_SUMMARY_SHOW_DAYS ago, or nobody wrote. `waiting` is Today's own waiting list, so the card's "didn't get a
 * reply" is the number Today shows. Never throws: Today never fails over this card.
 */
export async function inboxSummaryFor(
  businessId: string,
  waiting: readonly WaitingPerson[],
  now: Date = new Date()
): Promise<{ summary: InboxSummary; provider: "gmail" | "outlook" } | null> {
  try {
    const [business, inbox] = await Promise.all([
      prisma.business.findUnique({ where: { id: businessId }, select: { inboxSummarySeenAt: true } }),
      // The first full read is done: Gmail marks it with deepSyncedAt (gmailSync.ts, only when nothing was left
      // unread); Outlook's first pass is its first completed sync.
      prisma.integration.findFirst({
        where: {
          user: { businessId },
          status: "connected",
          connectedAt: { gte: new Date(now.getTime() - INBOX_SUMMARY_SHOW_DAYS * DAY) },
          OR: [
            { provider: "gmail", deepSyncedAt: { not: null } },
            { provider: "outlook", lastSyncedAt: { not: null } },
          ],
        },
        select: { provider: true },
      }),
    ]);
    if (!business || business.inboxSummarySeenAt || !inbox) return null;
    const since = new Date(now.getTime() - INBOX_SUMMARY_DAYS * DAY);
    const [leads, setAside] = await Promise.all([
      prisma.lead.findMany({
        where: {
          businessId,
          OR: [{ source: null }, { source: { not: PRACTICE_SOURCE } }],
          conversations: { some: { messages: { some: { direction: "inbound", sentAt: { gte: since } } } } },
        },
        select: { id: true },
        take: 2000,
      }),
      prisma.filteredEmail.count({ where: { businessId, provider: { in: ["gmail", "outlook"] }, lastMessageAt: { gte: since } } }),
    ]);
    if (leads.length === 0) return null;
    const summary = summarizeInbox(leads.map((l) => l.id), waiting, setAside, now);
    return { summary, provider: inbox.provider === "outlook" ? "outlook" : "gmail" };
  } catch (err) {
    console.error(`Could not build the inbox summary for business ${businessId}:`, err);
    return null;
  }
}
