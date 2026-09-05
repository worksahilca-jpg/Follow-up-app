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
      leadId: true,
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

  // Group by lead first — a lead with multiple outstanding FollowUps must
  // have each of its inbound messages claimed by at most one of them, so
  // this can't attribute the same real reply to two FollowUps (see the
  // audit finding this fixes: two pending FollowUps + one reply used to
  // both get stamped with that reply's timestamp).
  const byLead = new Map<string, typeof pending>();
  for (const followUp of pending) {
    const list = byLead.get(followUp.leadId);
    if (list) list.push(followUp);
    else byLead.set(followUp.leadId, [followUp]);
  }

  let matched = 0;

  for (const followUps of byLead.values()) {
    // Earliest-sent FollowUp gets first claim on the earliest available
    // inbound message — mirrors the order replies would actually resolve
    // outstanding follow-ups in.
    const sorted = [...followUps].sort((a, b) => a.sentAt!.getTime() - b.sentAt!.getTime());
    // Same inbound messages regardless of which FollowUp in this lead we
    // look from — conversations are shared across all of a lead's FollowUps.
    const available = sorted[0].lead.conversations
      .flatMap((c) => c.messages)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());

    for (const followUp of sorted) {
      const sentAt = followUp.sentAt!;
      const claimedIndex = available.findIndex((m) => m.sentAt > sentAt);
      if (claimedIndex === -1) continue;

      const reply = available[claimedIndex];
      available.splice(claimedIndex, 1); // consumed — the next FollowUp can't also claim it

      await prisma.followUp.update({
        where: { id: followUp.id },
        data: { repliedAt: reply.sentAt },
      });
      matched++;
    }
  }

  return matched;
}
