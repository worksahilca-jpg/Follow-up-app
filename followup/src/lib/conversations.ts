import { prisma } from "@/lib/db";
import type { Conversation } from "@prisma/client";

/**
 * Finds a lead's Conversation for a channel, creating one if it doesn't
 * exist yet — every inbound/outbound channel route needs exactly this,
 * and until this helper existed each one carried its own copy of the
 * same "find one, create it if it's not there" logic.
 *
 * That copy-pasted logic was a real race: nothing stopped two
 * near-simultaneous requests (a redelivered webhook, two messages landing
 * seconds apart) from both finding nothing and both creating their own
 * row, silently splitting one lead's message history across two threads.
 * Fixed at the database level by a partial unique index on
 * (leadId, channel) WHERE channel <> 'email' (see the
 * 20260911060000_conversation_leadid_channel_unique migration) — the
 * loser's create() below now fails with P2002 instead of quietly
 * succeeding, and is caught here by re-fetching the winner's row instead
 * of ending up with two.
 *
 * "email" is deliberately not covered by that constraint (see the
 * migration's own comment) — a lead can legitimately have several email
 * Conversations over time, one per Gmail/Outlook thread, already kept
 * apart by Conversation.externalId's own unique constraint. Calling this
 * helper for "email" still works (it's the same "most recent, or create
 * one" behavior sending.ts already relied on), it just isn't race-proof
 * the way every other channel now is — which matches this app's existing
 * inbound Gmail/Outlook sync paths (gmail.ts/outlook.ts), which never use
 * this helper at all and instead key off externalId directly.
 */
export async function findOrCreateConversation(
  leadId: string,
  channel: string,
  extra: { emailProvider?: string } = {}
): Promise<Conversation> {
  const existing = await prisma.conversation.findFirst({
    where: { leadId, channel },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  try {
    return await prisma.conversation.create({ data: { leadId, channel, ...extra } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.conversation.findFirst({
        where: { leadId, channel },
        orderBy: { createdAt: "desc" },
      });
      if (winner) return winner;
    }
    throw err;
  }
}
