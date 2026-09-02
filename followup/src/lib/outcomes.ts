/**
 * Outcome tracking — the piece that turns "we sent a follow-up" into "we
 * sent a follow-up and here's what happened." Every send already logs a
 * FollowUp row (see sending.ts); this is what closes the loop by checking,
 * after each Gmail sync pulls in new messages, whether the lead actually
 * replied to one.
 *
 * Deliberately narrow for now: "got a reply" (and how fast) is the one
 * outcome we can detect honestly from data we actually have. Whether that
 * reply was positive, led to a meeting, or closed the deal needs either
 * sentiment analysis on the reply or a human marking the outcome — real
 * next steps once this baseline is live, not guessed at here.
 */

import { prisma } from "@/lib/db";

/**
 * For every "sent" FollowUp on this business's leads that hasn't been
 * matched to a reply yet, checks whether the lead's conversation has an
 * inbound message after it was sent — and if so, records when.
 *
 * Call this after a Gmail sync, since that's the only place new inbound
 * messages actually enter the DB; running it any other time would just
 * re-check against data that hasn't changed.
 */
export async function detectReplies(businessId: string): Promise<number> {
  const pending = await prisma.followUp.findMany({
    where: {
      status: "sent",
      repliedAt: null,
      sentAt: { not: null },
      lead: { businessId },
    },
    select: {
      id: true,
      sentAt: true,
      lead: {
        select: {
          conversations: {
            select: {
              messages: {
                where: { direction: "inbound" },
                orderBy: { sentAt: "asc" },
                select: { sentAt: true },
              },
            },
          },
        },
      },
    },
  });

  let matched = 0;

  for (const followUp of pending) {
    const sentAt = followUp.sentAt!;
    const firstReply = followUp.lead.conversations
      .flatMap((c) => c.messages)
      .filter((m) => m.sentAt > sentAt)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())[0];

    if (firstReply) {
      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { repliedAt: firstReply.sentAt },
      });
      matched++;
    }
  }

  return matched;
}
