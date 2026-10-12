import { prisma } from "@/lib/db";
import type { Message } from "@/lib/types";
import { isNotAnAnswer } from "@/lib/notAnAnswer";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { judgeHistoryThread } from "@/lib/inbound/whatsappHistoryFilter";
import {
  DM_REJUDGE_MAX_PER_HOUR,
  DM_SET_ASIDE_MAX_MESSAGES,
  dmContextLoader,
  moveDmLeadAside,
  pastDailyLooks,
  type DmChannel,
  type DmJudgeContext,
} from "@/lib/inbound/dmContactGate";
import { isBareGreeting } from "@/lib/inbound/greeting";
import { instagramRecipientId, isInstagramLeadId, isMessengerLeadId, messengerRecipientId } from "@/lib/instagramId";

/**
 * "Customer or not?", asked again (founder, 2026-10-12, A-239: "There are
 * other leads too that it captured wrong, you gotta make it accurate").
 *
 * The first check (src/lib/inbound/dmContactGate.ts, A-234) judges a new
 * Instagram or Messenger chat once, on its first message. An emoji, a "hi"
 * or a photo says too little: the chat is let in, and before this nothing
 * after it was ever looked at. A friend's "😍" then "Isme bee bhi dal"
 * reached Today with a viewing drafted for it.
 *
 * So until the customer is settled, every new message with words is
 * judged again on the whole chat, with the same judge and the same bar:
 * two reads must agree it isn't a customer, and an error or a limit lets
 * it stay. If it isn't, the chat moves to Filtered out, one tap from coming
 * back (moveDmLeadAside).
 *
 * Settled means a person decided, or FollowUp has really answered:
 *  - FollowUp sent a real reply (the owner's Send, or sent by itself). The
 *    instant "got your message" and the holding note don't count;
 *  - a reply typed in the Instagram app itself does NOT count: people
 *    answer friends there too;
 *  - the owner brought them back from Filtered out (dmConfirmedAt), said
 *    "Already spoke", moved them along, put them in a workflow, booked them,
 *    or FollowUp found them ready;
 *  - they're known on another channel (an email on file, an email thread).
 */

type LeadForCheck = {
  stage: string;
  email: string | null;
  talkedAt: Date | null;
  qualifiedAt: Date | null;
  dmConfirmedAt: Date | null;
  sequenceId: string | null;
};

type MessageForCheck = { direction: string; source: string | null; trigger: string | null };

/** Whether this DM customer is past checking: see the list above. */
export function dmCustomerSettled(lead: LeadForCheck, messages: readonly MessageForCheck[], other: { hasBooking: boolean; otherChannel: boolean }): boolean {
  if (lead.dmConfirmedAt || lead.talkedAt || lead.qualifiedAt || lead.sequenceId || lead.email) return true;
  if (lead.stage !== "NEW" || other.hasBooking || other.otherChannel) return true;
  return messages.some((m) => m.direction === "outbound" && !(m.source ?? "").endsWith("_direct") && !isNotAnAnswer(m.trigger));
}

/** Words worth judging: not a placeholder for a photo or Reel, not only emoji, not only "hi". */
export function hasWordsToJudge(body: string): boolean {
  if (body.startsWith("[Sent ")) return false;
  if (!/\p{L}/u.test(body)) return false;
  return !isBareGreeting(body);
}

export type RecheckOutcome = "kept" | "set_aside" | "settled" | "skipped";

/**
 * Judges one Instagram or Messenger customer again, if they still need it.
 * "skipped": nothing new to read, no AI for this business, or a limit was
 * reached (left for a later message or the hourly pass to try again).
 */
export async function recheckDmLead(
  businessId: string,
  leadId: string,
  options: { context?: () => Promise<DmJudgeContext> } = {}
): Promise<RecheckOutcome> {
  // Fails open, like every look: an error keeps the customer and the
  // message goes on to be answered as before.
  try {
    return await recheck(businessId, leadId, options);
  } catch (err) {
    console.error(`DM re-check failed for lead ${leadId}:`, err instanceof Error ? err.message : "unknown error");
    return "skipped";
  }
}

async function recheck(businessId: string, leadId: string, options: { context?: () => Promise<DmJudgeContext> }): Promise<RecheckOutcome> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      stage: true,
      email: true,
      talkedAt: true,
      qualifiedAt: true,
      dmConfirmedAt: true,
      dmCheckedAt: true,
      sequenceId: true,
      _count: { select: { bookings: true } },
      conversations: {
        select: {
          channel: true,
          messages: { select: { externalId: true, id: true, direction: true, body: true, sentAt: true, source: true, trigger: true } },
        },
      },
    },
  });
  if (!lead?.phone) return "skipped";
  const channel: DmChannel | null = isInstagramLeadId(lead.phone) ? "instagram" : isMessengerLeadId(lead.phone) ? "messenger" : null;
  if (!channel) return "skipped";

  const messages = lead.conversations.flatMap((c) => c.messages).sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const otherChannel = lead.conversations.some((c) => c.channel !== channel);
  if (dmCustomerSettled(lead, messages, { hasBooking: lead._count.bookings > 0, otherChannel })) return "settled";

  // Something new with words since the last look, or there's nothing to judge.
  const stamp = () => prisma.lead.updateMany({ where: { id: lead.id, businessId }, data: { dmCheckedAt: new Date() } });
  const newWords = messages.some((m) => m.direction === "inbound" && (!lead.dmCheckedAt || m.sentAt > lead.dmCheckedAt) && hasWordsToJudge(m.body));
  if (!newWords) {
    await stamp();
    return "skipped";
  }

  const context = await (options.context ?? dmContextLoader(businessId, channel))();
  if (!context.aiAllowed) return "skipped";
  const contactId = channel === "instagram" ? instagramRecipientId(lead.phone) : messengerRecipientId(lead.phone);
  if (
    (await tooManyRecentActions(businessId, `${channel}_rejudge:${contactId}`, { windowMinutes: 60, max: DM_REJUDGE_MAX_PER_HOUR })) ||
    (await pastDailyLooks(businessId, channel))
  ) {
    return "skipped";
  }

  const thread: Message[] = messages.slice(-DM_SET_ASIDE_MAX_MESSAGES).map((m) => ({
    id: m.externalId ?? m.id,
    direction: m.direction === "inbound" ? "inbound" : "outbound",
    channel,
    body: m.body,
    date: m.sentAt.toISOString(),
    opened: false,
  }));
  const verdict = await judgeHistoryThread(thread, { name: lead.name, phone: lead.phone }, context.classifier, { knownOnAnotherChannel: false });
  if (verdict.import) {
    await stamp();
    return "kept";
  }
  const moved = await moveDmLeadAside(businessId, channel, contactId, lead.id, verdict.reason || "Not customer business so far.");
  return moved ? "set_aside" : "skipped";
}

/** How many unsettled DM customers one business has re-checked per hourly pass. */
export const DM_RECHECK_PER_BUSINESS_PER_RUN = 10;

/**
 * The hourly pass: Instagram and Messenger customers never looked at
 * again since they came in (all of them, the day this shipped) are checked
 * once, oldest first. After that, each new message checks them
 * (src/lib/inbound/meta.ts). Errors stay with the customer they hit.
 */
export async function recheckDmLeadsForAllBusinesses(): Promise<{ checked: number; setAside: number }> {
  const candidates = await prisma.lead.findMany({
    where: {
      OR: [{ phone: { startsWith: "ig:" } }, { phone: { startsWith: "fb:" } }],
      stage: "NEW",
      email: null,
      talkedAt: null,
      qualifiedAt: null,
      dmConfirmedAt: null,
      dmCheckedAt: null,
      sequenceId: null,
    },
    select: { id: true, businessId: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const perBusiness = new Map<string, number>();
  let checked = 0;
  let setAside = 0;
  for (const l of candidates) {
    const n = perBusiness.get(l.businessId) ?? 0;
    if (n >= DM_RECHECK_PER_BUSINESS_PER_RUN) continue;
    perBusiness.set(l.businessId, n + 1);
    try {
      const outcome = await recheckDmLead(l.businessId, l.id);
      checked += 1;
      if (outcome === "set_aside") setAside += 1;
      // Settled, or a limit hit: marked as looked at, so the pass moves on. Their next message checks them again.
      if (outcome === "settled" || outcome === "skipped") await prisma.lead.updateMany({ where: { id: l.id, businessId: l.businessId }, data: { dmCheckedAt: new Date() } });
    } catch (err) {
      console.error(`DM re-check failed for lead ${l.id}:`, err instanceof Error ? err.message : "unknown error");
    }
  }
  return { checked, setAside };
}
