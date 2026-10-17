import { prisma } from "@/lib/db";
import { isGhlChannel, type GhlChannel } from "./gohighlevel";

/**
 * Which FollowUp conversations live in GoHighLevel (GHL 2). Kept apart from the Gmail, Outlook and Twilio threads
 * of the same customer, so a reply always goes back the way the customer wrote: a text they sent to the owner's
 * GoHighLevel number is answered from that number, never from Twilio or by email.
 *
 * A GoHighLevel conversation holds every channel for one contact; FollowUp keeps one conversation per channel, so
 * the key carries both. Conversation.externalId is unique, which is what makes the poller's create safe to repeat.
 * An email one is also stamped emailProvider "gohighlevel", so the Gmail and Outlook reply paths never try to
 * thread a reply under a message that isn't in their mailbox (emailReplyTarget in src/lib/sending.ts).
 */
const PREFIX = "ghl:";

export function ghlConversationKey(ghlConversationId: string, channel: GhlChannel): string {
  return `${PREFIX}${ghlConversationId}:${channel}`;
}

export function isGhlConversationKey(externalId: string | null | undefined): boolean {
  return !!externalId && externalId.startsWith(PREFIX);
}

export async function findOrCreateGhlConversation(leadId: string, ghlConversationId: string, channel: GhlChannel) {
  const externalId = ghlConversationKey(ghlConversationId, channel);
  const existing = await prisma.conversation.findUnique({ where: { externalId } });
  if (existing) return existing;
  try {
    return await prisma.conversation.create({
      data: { leadId, channel, externalId, ...(channel === "email" ? { emailProvider: "gohighlevel" } : {}) },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      const winner = await prisma.conversation.findUnique({ where: { externalId } });
      if (winner) return winner;
    }
    throw err;
  }
}

/**
 * When the customer's newest message came in through GoHighLevel, the reply goes back through it: which channel,
 * and which FollowUp conversation to record it in. Null for everyone else, who is answered exactly as before.
 * Without `channel` it asks about the newest message on any channel; with one, about the newest on that channel.
 */
export async function ghlReplyRoute(leadId: string, channel?: GhlChannel): Promise<{ channel: GhlChannel; conversationId: string } | null> {
  const last = await prisma.message.findFirst({
    where: { direction: "inbound", conversation: { leadId, ...(channel ? { channel } : {}) } },
    orderBy: { sentAt: "desc" },
    select: { conversation: { select: { id: true, channel: true, externalId: true } } },
  });
  if (!last?.conversation || !isGhlConversationKey(last.conversation.externalId)) return null;
  const c = last.conversation.channel;
  if (!isGhlChannel(c)) return null;
  return { channel: c, conversationId: last.conversation.id };
}
