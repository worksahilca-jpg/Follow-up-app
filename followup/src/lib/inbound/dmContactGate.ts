/**
 * "Is this DM a customer, or someone chatting?" for Instagram and Messenger.
 *
 * Founder, 2026-10-11: "We'll be picking up only those who are actually
 * customers or leads, or who are planning to buy, or who have a query about
 * the business." Asked of a friend's "hey bro what's up": should new DMs get
 * the same "is this a customer?" check emails get? "Yes, same check."
 *
 * So this is WhatsApp's live check (judgeUnknownContact in
 * src/lib/inbound/whatsappCloud.ts) for the Meta inboxes, with the same
 * judge (judgeHistoryThread), the same bar ("make sure no leads slip
 * over": a chat is set aside only when two reads agree), the same fail-open
 * direction, and the same place to see and undo it (FilteredEmail, listed
 * under "Filtered out" with a one-tap restore).
 *
 * Only asked when nobody in the conversation is a customer yet. Someone who
 * already is one is never second-guessed. Two things are let through
 * without asking, because each is the start of a real enquiry often enough
 * that guessing would lose customers:
 *  - a bare greeting ("Hi", "Hello there"): people say hi and wait;
 *  - a photo, video, voice note or file with no words: it can be the
 *    question itself. (A shared Reel or sticker never gets this far; see
 *    src/lib/sharedContent.ts.)
 */
import { prisma } from "@/lib/db";
import type { Message } from "@/lib/types";
import type { ClassifierBusinessContext } from "@/lib/integrations/openai";
import { judgeHistoryThread, parseStoredThread } from "@/lib/inbound/whatsappHistoryFilter";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { hasActiveAccess, isChannelAvailableOnFreeTier } from "@/lib/billing";
import { instagramLeadId, messengerLeadId } from "@/lib/instagramId";

export type DmChannel = "instagram" | "messenger";

/** Same as WhatsApp's: enough of a set-aside chat for Restore and the next look. */
export const DM_SET_ASIDE_MAX_MESSAGES = 50;
/** Same as WhatsApp's: how often one set-aside chat may be judged again in an hour. */
export const DM_REJUDGE_MAX_PER_HOUR = 6;
/**
 * First looks at new senders per business per hour. Past it, someone new is
 * let through rather than judged (fail open), and scoring's own daily cap
 * still bounds the spend. Keeps a burst of spam DMs from becoming a burst
 * of classifier calls.
 */
export const DM_FIRST_LOOKS_PER_HOUR = 60;
/**
 * Looks of either kind per business per day. Anyone can DM a business, so
 * this is the per-day ceiling CONTRIBUTING.md asks of anything a stranger
 * can reach. Past it, someone new is let through and a set-aside chat
 * stays aside, as with the hourly limits.
 */
export const DM_LOOKS_PER_DAY = 300;

function pastDailyLooks(businessId: string, channel: DmChannel): Promise<boolean> {
  return tooManyRecentActions(businessId, `${channel}_looks_day`, { windowMinutes: 24 * 60, max: DM_LOOKS_PER_DAY });
}

export type DmGateResult = { admit: true; prior: Message[] } | { admit: false };

/** The business, as the check needs it: who they are, and whether AI may run for them. */
export type DmJudgeContext = { classifier: ClassifierBusinessContext | undefined; aiAllowed: boolean };

export function dmLeadKey(channel: DmChannel, contactId: string): string {
  return channel === "instagram" ? instagramLeadId(contactId) : messengerLeadId(contactId);
}

function dmThreadId(channel: DmChannel, contactId: string): string {
  return `${channel}:${contactId}`;
}

function lockKey(channel: DmChannel, businessId: string, contactId: string): string {
  return `${channel}_set_aside:${businessId}:${contactId}`;
}

const GREETING_RE =
  /^(?:hi+|hii+|hello+|hey+|heya|hiya|hola|namaste|salam|salaam|assalamu alaikum|sat sri akal|good (?:morning|afternoon|evening))(?:\s+(?:there|team|sir|ma'?am|all|everyone))?[\s!.?,~]*$/iu;

/** "Hi", "Hello there!", "Good morning": a greeting and nothing else. Emoji are ignored. */
export function isBareGreeting(text: string): boolean {
  const words = text.replace(/\p{Extended_Pictographic}|‍|️/gu, "").trim();
  return words.length > 0 && GREETING_RE.test(words);
}

/** The business's name, trade and AI eligibility, fetched once per delivery and only if someone new wrote. */
export function dmContextLoader(businessId: string, channel: DmChannel): () => Promise<DmJudgeContext> {
  let loaded: Promise<DmJudgeContext> | null = null;
  return () => {
    loaded ??= prisma.business
      .findUnique({ where: { id: businessId }, select: { name: true, industry: true, subscriptionStatus: true, tier: true } })
      .then((b) => ({
        classifier: b ? { name: b.name, industry: b.industry } : undefined,
        // The same two tests checkAiEligibility applies to every lead.
        aiAllowed:
          !!b &&
          hasActiveAccess(b.subscriptionStatus, b.tier) &&
          (b.tier !== "free" || isChannelAvailableOnFreeTier(channel === "instagram" ? "Instagram" : "Facebook Messenger")),
      }));
    return loaded;
  };
}

/** Whether this DM sender is already one of the business's customers. */
export async function isDmLead(businessId: string, channel: DmChannel, contactId: string): Promise<boolean> {
  return !!(await prisma.lead.findFirst({ where: { businessId, phone: dmLeadKey(channel, contactId) }, select: { id: true } }));
}

function storedMessages(value: unknown, channel: DmChannel): { name: string | null; messages: Message[] } | null {
  const stored = parseStoredThread(value);
  return stored ? { name: stored.name, messages: stored.messages.map((m) => ({ ...m, channel })) } : null;
}

/**
 * A message from, or to, someone who is not a customer yet: let it through,
 * or set the chat aside? Called only when no lead has this contact.
 */
export async function judgeNewDmContact(args: {
  businessId: string;
  channel: DmChannel;
  contactId: string;
  /** "@handle" when known. */
  name: string | undefined;
  message: Message;
  hasOwnWords: boolean;
  context: () => Promise<DmJudgeContext>;
}): Promise<DmGateResult> {
  const { businessId, channel, contactId, message, hasOwnWords } = args;
  const threadId = dmThreadId(channel, contactId);
  const row = await prisma.filteredEmail.findUnique({
    where: { businessId_threadId: { businessId, threadId } },
    select: { id: true, threadPayload: true },
  });
  const stored = row ? storedMessages(row.threadPayload, channel) : null;
  const prior = stored?.messages ?? [];

  // Delivered again (the webhook and the 3-minute check both bring it):
  // judged already.
  if (message.id && prior.some((m) => m.id === message.id)) return { admit: false };

  if (!row) {
    // Someone new: the two openings that are too often a real customer to guess about.
    if (message.direction === "inbound" && (!hasOwnWords || isBareGreeting(message.body))) return { admit: true, prior: [] };
  }

  const context = await args.context();
  // No AI for this business: capture as before this check existed (fail open).
  // A chat already set aside stays set aside, with this message kept.
  if (!context.aiAllowed && !row) return { admit: true, prior: [] };
  if (
    !row &&
    ((await tooManyRecentActions(businessId, `${channel}_first_look`, { windowMinutes: 60, max: DM_FIRST_LOOKS_PER_HOUR })) ||
      (await pastDailyLooks(businessId, channel)))
  ) {
    return { admit: true, prior: [] };
  }

  const thread = [...prior, message]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-DM_SET_ASIDE_MAX_MESSAGES);
  const displayName = args.name ?? stored?.name ?? undefined;

  // A photo in a chat already set aside adds nothing to read; kept, judged again when there are words.
  const skipLook =
    !!row &&
    (!hasOwnWords ||
      !context.aiAllowed ||
      (await tooManyRecentActions(businessId, `${channel}_rejudge:${contactId}`, { windowMinutes: 60, max: DM_REJUDGE_MAX_PER_HOUR })) ||
      (await pastDailyLooks(businessId, channel)));
  const verdict = skipLook
    ? null
    : await judgeHistoryThread(
        thread,
        { name: displayName ?? (channel === "instagram" ? "Instagram user" : "Messenger user"), phone: dmLeadKey(channel, contactId) },
        context.classifier,
        { knownOnAnotherChannel: false },
        { alreadySetAside: !!row }
      );

  if (verdict?.import) return { admit: true, prior };
  return keepDmSetAside(businessId, channel, contactId, args.name, message, verdict?.reason);
}

/**
 * Keeps one message in a set-aside chat, merged under a lock into what the
 * row holds now (the race WhatsApp's keepSetAside closes, security pass
 * 2026-09-25 F4). If the contact became a customer meanwhile, lets it through.
 */
async function keepDmSetAside(
  businessId: string,
  channel: DmChannel,
  contactId: string,
  name: string | undefined,
  message: Message,
  reason: string | undefined
): Promise<DmGateResult> {
  const threadId = dmThreadId(channel, contactId);
  const phone = dmLeadKey(channel, contactId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(channel, businessId, contactId)}))`;
    if (await tx.lead.findFirst({ where: { businessId, phone }, select: { id: true } })) return { admit: true, prior: [] };

    const row = await tx.filteredEmail.findUnique({
      where: { businessId_threadId: { businessId, threadId } },
      select: { threadPayload: true },
    });
    const stored = row ? storedMessages(row.threadPayload, channel) : null;
    const kept = stored?.messages ?? [];
    const thread = (message.id && kept.some((m) => m.id === message.id) ? kept : [...kept, message])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-DM_SET_ASIDE_MAX_MESSAGES);
    const displayName = name ?? stored?.name ?? undefined;
    const payload = {
      phone,
      name: displayName ?? null,
      messages: thread.map((m) => ({ id: m.id, direction: m.direction, body: m.body, date: m.date })),
    };
    const lastMessageAt = new Date(thread[thread.length - 1].date);

    await tx.filteredEmail.upsert({
      where: { businessId_threadId: { businessId, threadId } },
      update: { ...(reason ? { reason } : {}), ...(name ? { senderName: name } : {}), threadPayload: payload, lastMessageAt },
      create: {
        businessId,
        threadId,
        provider: channel,
        senderName: displayName ?? (channel === "instagram" ? "Instagram user" : "Messenger user"),
        senderPhone: phone,
        reason: reason ?? "Not customer business so far.",
        threadPayload: payload,
        lastMessageAt,
      },
    });
    return { admit: false };
  });
}

/**
 * Writes a set-aside chat into the conversation of the customer it became.
 * Idempotent on the message id, like every other Meta write.
 */
export async function writeDmThread(
  conversationId: string,
  channel: DmChannel,
  messages: Message[],
  db: Pick<typeof prisma, "message"> = prisma
): Promise<void> {
  for (const m of messages) {
    if (!m.id) continue;
    await db.message.upsert({
      where: { externalId: m.id },
      update: {},
      create: {
        conversationId,
        direction: m.direction,
        body: m.body,
        externalId: m.id,
        sentAt: new Date(m.date),
        ...(m.direction === "inbound" ? {} : { source: `${channel}_direct` }),
      },
    });
  }
}

/**
 * Moves anything set aside since the judge looked into the new customer's
 * conversation, then deletes the row, under the same lock as keepDmSetAside.
 * The message being processed is left to the caller.
 */
export async function takeDmSetAside(
  businessId: string,
  channel: DmChannel,
  contactId: string,
  conversationId: string,
  written: Message[],
  currentId: string | undefined
): Promise<void> {
  const threadId = dmThreadId(channel, contactId);
  const done = new Set(written.map((m) => m.id));
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(channel, businessId, contactId)}))`;
    const row = await tx.filteredEmail.findUnique({
      where: { businessId_threadId: { businessId, threadId } },
      select: { id: true, threadPayload: true },
    });
    if (!row) return;
    const added = (storedMessages(row.threadPayload, channel)?.messages ?? []).filter((m) => !done.has(m.id) && m.id !== currentId);
    await writeDmThread(conversationId, channel, added, tx);
    await tx.filteredEmail.deleteMany({ where: { id: row.id, businessId } });
  });
}

/** The contact id inside a set-aside row's threadId ("instagram:123" → "123"). */
export function dmContactIdOf(threadId: string): string | null {
  const i = threadId.indexOf(":");
  return i > 0 ? threadId.slice(i + 1) || null : null;
}
