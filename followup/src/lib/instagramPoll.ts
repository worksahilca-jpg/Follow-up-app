import { prisma } from "@/lib/db";
import { GRAPH_API } from "@/lib/instagram";
import { processMetaEnvelope } from "@/lib/inbound/meta";

/**
 * Asking Instagram for new DMs, instead of waiting to be told.
 *
 * 2026-09-19, the first real account: connected as a Business account,
 * listed under the account's own `subscribed_apps` with the `messages`
 * field, app published, both accounts holding app roles, the owner's
 * "Allow access to messages" toggle on — and a real DM produced no
 * webhook at all, in either direction, while Meta's own test payload for
 * that same field arrived and processed fine. The message was sitting in
 * the account's conversations the whole time, readable with the token we
 * already hold.
 *
 * A push we cannot make arrive is not a capture mechanism. So this is the
 * second path, the one Gmail has always had: every few minutes, read the
 * connected account's conversations and feed anything new through the
 * ordinary inbound pipeline. The webhook stays exactly as it is — when it
 * works it is faster, and whichever arrives second is dropped on the
 * message-id uniqueness that already absorbs Meta's redeliveries.
 *
 * The reuse is deliberate and total: a polled message is rebuilt into the
 * SAME envelope shape Meta posts to the webhook and handed to
 * processMetaEnvelope. Opt-out keywords, reply-button taps, the
 * acknowledgement grace period, echo capture of the owner's own replies,
 * scoring, rapid-engagement — all of it applies without a second
 * implementation to keep in step.
 */

/** Conversations to read per business per tick, and messages per conversation. */
const CONVERSATION_LIMIT = 25;
const MESSAGE_LIMIT = 25;

/**
 * A never-polled account reads only this far back. Connecting an account
 * must not drag its whole message history into the app and acknowledge
 * conversations that ended weeks ago — the 2026-09-19 "97 wasted holds"
 * case is what unbounded automatic work on old leads actually looks like.
 * Wide enough to catch a DM sent while the owner was still on the connect
 * screen, narrow enough that nothing historical is touched.
 */
const FIRST_RUN_LOOKBACK_MS = 15 * 60 * 1000;

/**
 * However long the poller has been down, it never reaches back further
 * than this. A gap longer than a day is not something to fix by
 * automatically answering day-old messages.
 */
const MAX_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Re-read a little before the cursor. Meta's `updated_time` and our clock
 * are not the same clock, and a message landing exactly on the boundary
 * must not fall between two ticks. Anything re-read is already stored and
 * is dropped by the message-id uniqueness.
 */
const OVERLAP_MS = 2 * 60 * 1000;

/** Meta returns "+0000" where Date wants "+00:00"; everything else parses as-is. */
export function parseGraphTime(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

type GraphMessage = {
  id?: unknown;
  created_time?: unknown;
  from?: { id?: unknown; username?: unknown } | null;
  to?: { data?: unknown } | null;
  message?: unknown;
  attachments?: { data?: unknown } | null;
};

async function graphJson(path: string, accessToken: string): Promise<unknown | null> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${GRAPH_API}/${path}${sep}access_token=${encodeURIComponent(accessToken)}`);
  if (res.ok) return res.json().catch(() => null);
  // Meta's sentence, never the token. A failure here is ordinary — an
  // expired 60-day token, a rate limit, an account disconnected on Meta's
  // side — and must not stop the other businesses in this tick.
  const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
  const reason = typeof body?.error?.message === "string" ? body.error.message : "";
  console.error(`Instagram poll ${path.split("?")[0]} failed: HTTP ${res.status}${reason ? ` — ${reason}` : ""}`);
  return null;
}

/**
 * One polled message as the webhook would have delivered it.
 *
 * A message the connected account SENT (from.id is the account itself) is
 * marked `is_echo`, which is how the webhook path already reports the
 * owner answering from the Instagram app — processMetaEnvelope stores it
 * as an outbound message on the lead rather than treating the business as
 * a lead. The recipient of an echo is the person being talked to, so the
 * lead lookup stays symmetric.
 */
function toMessagingEvent(message: GraphMessage, igUserId: string): Record<string, unknown> | null {
  const mid = typeof message.id === "string" ? message.id : null;
  const fromId = typeof message.from?.id === "string" ? message.from.id : null;
  const sentAt = parseGraphTime(message.created_time);
  if (!mid || !fromId || !sentAt) return null;

  const text = typeof message.message === "string" ? message.message : "";
  // The REST shape nests attachments under `data` and describes each one
  // differently from the webhook's `[{type, payload}]`. Only the count
  // matters downstream (messageContent turns them into a readable
  // placeholder so an attachment-only DM is still a real message), so they
  // are normalized to that shape rather than mapped field by field.
  const attachmentData = Array.isArray(message.attachments?.data) ? message.attachments.data : [];
  const attachments = attachmentData.map(() => ({ type: "attachment" }));

  const isEcho = fromId === igUserId;
  if (isEcho) {
    const to = Array.isArray(message.to?.data) ? (message.to.data as { id?: unknown }[]) : [];
    const recipientId = to.map((t) => t?.id).find((id): id is string => typeof id === "string" && id !== igUserId);
    if (!recipientId) return null;
    return {
      sender: { id: igUserId },
      recipient: { id: recipientId },
      timestamp: sentAt.getTime(),
      message: { mid, text, attachments, is_echo: true },
    };
  }

  return {
    sender: { id: fromId },
    recipient: { id: igUserId },
    timestamp: sentAt.getTime(),
    message: { mid, text, attachments },
  };
}

/**
 * Reads one business's conversations and returns the events newer than
 * `since`, oldest first so a thread replays in the order it happened.
 *
 * `ok` is false when Meta refused the conversation list itself. That
 * distinction is what stops a rate-limited or expired-token tick from
 * looking like "nothing new" and quietly carrying the cursor past a
 * window nobody ever read.
 */
export async function fetchNewInstagramEvents(
  igUserId: string,
  accessToken: string,
  since: Date
): Promise<{ ok: boolean; events: Record<string, unknown>[] }> {
  const listed = (await graphJson(
    `${encodeURIComponent(igUserId)}/conversations?platform=instagram&fields=id,updated_time&limit=${CONVERSATION_LIMIT}`,
    accessToken
  )) as { data?: { id?: unknown; updated_time?: unknown }[] } | null;
  if (!listed) return { ok: false, events: [] };
  const conversations = Array.isArray(listed.data) ? listed.data : [];

  const events: { at: number; event: Record<string, unknown> }[] = [];
  for (const conversation of conversations) {
    const conversationId = typeof conversation?.id === "string" ? conversation.id : null;
    if (!conversationId) continue;
    // A thread untouched since the last tick has nothing new in it, and
    // skipping it here is what keeps a tick to one Graph call for a quiet
    // account rather than one per conversation.
    const updated = parseGraphTime(conversation.updated_time);
    if (updated && updated.getTime() <= since.getTime()) continue;

    const detail = (await graphJson(
      `${encodeURIComponent(conversationId)}?fields=messages.limit(${MESSAGE_LIMIT}){id,created_time,from,to,message,attachments}`,
      accessToken
    )) as { messages?: { data?: GraphMessage[] } } | null;
    const messages = Array.isArray(detail?.messages?.data) ? detail.messages.data : [];

    for (const message of messages) {
      const sentAt = parseGraphTime(message?.created_time);
      if (!sentAt || sentAt.getTime() <= since.getTime()) continue;
      const event = toMessagingEvent(message, igUserId);
      if (event) events.push({ at: sentAt.getTime(), event });
    }
  }

  return { ok: true, events: events.sort((a, b) => a.at - b.at).map((e) => e.event) };
}

/**
 * One business: read what's new, hand it to the ordinary inbound pipeline,
 * and only then move the cursor. A failed tick leaves the cursor where it
 * was, so the next one covers the same ground rather than skipping it.
 */
export async function pollInstagramForBusiness(business: {
  id: string;
  instagramUserId: string;
  instagramAccessToken: string;
  instagramSyncedAt: Date | null;
}): Promise<{ events: number }> {
  const now = Date.now();
  const floor = now - MAX_LOOKBACK_MS;
  const cursor = business.instagramSyncedAt ? business.instagramSyncedAt.getTime() - OVERLAP_MS : now - FIRST_RUN_LOOKBACK_MS;
  const since = new Date(Math.max(cursor, floor));

  const { ok, events } = await fetchNewInstagramEvents(business.instagramUserId, business.instagramAccessToken, since);
  if (events.length > 0) {
    await processMetaEnvelope({
      object: "instagram",
      entry: [{ id: business.instagramUserId, messaging: events }],
    });
  }
  // Only on a read Meta actually answered. A refused tick leaves the
  // cursor where it was so the next one covers the same window again.
  if (ok) await prisma.business.update({ where: { id: business.id }, data: { instagramSyncedAt: new Date(now) } });
  return { events: events.length };
}

/**
 * Every business with a connected Instagram account. One business's
 * failure — an expired token, a rate limit — is logged and skipped rather
 * than ending the tick for everyone else.
 */
export async function pollInstagramForAllBusinesses(): Promise<{ businesses: number; events: number }> {
  const businesses = await prisma.business.findMany({
    where: { instagramUserId: { not: null }, instagramAccessToken: { not: null } },
    select: { id: true, instagramUserId: true, instagramAccessToken: true, instagramSyncedAt: true },
  });

  let events = 0;
  for (const business of businesses) {
    try {
      const result = await pollInstagramForBusiness({
        id: business.id,
        instagramUserId: business.instagramUserId!,
        instagramAccessToken: business.instagramAccessToken!,
        instagramSyncedAt: business.instagramSyncedAt,
      });
      events += result.events;
    } catch (err) {
      console.error(`Instagram poll failed for business ${business.id}:`, err);
    }
  }
  return { businesses: businesses.length, events };
}
