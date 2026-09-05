/**
 * Timing-aware handoff — see the "Why FollowUp Exists" problem list:
 * salespeople lose deals by reaching out at the wrong *time* as often as
 * with the wrong words, so this watches engagement pace, not content, to
 * recognize when a lead is actually present and worth a human's attention
 * right now — a different, and often faster, signal than the lead's score.
 *
 * The one pattern this detects, deliberately narrow rather than a general
 * "engagement score": within the last 15 minutes, a lead has sent at
 * least two inbound messages with at least one outbound reply (AI or
 * human) somewhere in between them. That's genuine back-and-forth — the
 * lead is on the other end right now, not just sending a burst of
 * messages nobody's responded to yet.
 */

import { prisma } from "@/lib/db";

const RAPID_WINDOW_MS = 15 * 60 * 1000;

/**
 * Call this right after any inbound message is created for a lead — see
 * the Twilio SMS, Instagram DM, and Gmail sync call sites. Cheap to call
 * even when nothing fires: one indexed query for recent messages, one for
 * the lead, and (only if the pattern matches) one dedup check before
 * writing a Notification.
 *
 * Deduped per "burst" rather than per message: if the pattern already
 * fired once in the last 15 minutes for this lead, it stays quiet for the
 * rest of that conversation instead of notifying on every single message
 * while the lead keeps typing.
 */
export async function checkRapidEngagement(leadId: string): Promise<void> {
  const since = new Date(Date.now() - RAPID_WINDOW_MS);

  const recent = await prisma.message.findMany({
    where: { conversation: { leadId }, sentAt: { gte: since } },
    select: { direction: true },
  });

  const inboundCount = recent.filter((m) => m.direction === "inbound").length;
  const hasOutboundBetween = recent.some((m) => m.direction === "outbound");
  if (inboundCount < 2 || !hasOutboundBetween) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, assignedToId: true },
  });
  // Nobody assigned means nobody to hand this off to — nothing to do.
  if (!lead?.assignedToId) return;

  // Atomic check-and-mark: a single conditional UPDATE, not a separate
  // findFirst-then-create Notification check. Two concurrent inbound
  // messages both racing to notify for the same lead serialize on this
  // row — whichever commits first "wins" the window, and the second's
  // WHERE clause is re-evaluated against the now-updated row and matches
  // zero rows, so only one Notification ever gets created per burst.
  const claim = await prisma.lead.updateMany({
    where: {
      id: leadId,
      OR: [{ lastRapidEngagementNotifiedAt: null }, { lastRapidEngagementNotifiedAt: { lt: since } }],
    },
    data: { lastRapidEngagementNotifiedAt: new Date() },
  });
  if (claim.count === 0) return; // already notified within this window

  await prisma.notification.create({
    data: {
      userId: lead.assignedToId,
      leadId,
      message: `${lead.name} is actively replying right now — a good moment to jump in.`,
    },
  });
}
