import { prisma } from "@/lib/db";
import { GRAPH_API } from "@/lib/instagram";
import type { Message } from "@/lib/types";

/**
 * What Instagram itself knows about someone who DMs the business, for the
 * "is this a customer?" check (founder, 2026-10-12: "For hi we need to
 * analyse the message, whether they talked earlier, since when they're
 * following, and all the situation, so that we can judge accurately").
 *
 * What Instagram gives (User Profile API, Conversations API, both on the
 * messaging permission FollowUp already has; consent exists because they
 * messaged the business):
 *  - whether they follow the business, and whether the business follows
 *    them back;
 *  - their follower count;
 *  - the chat itself, including what was said before FollowUp was
 *    connected, and so how far back it goes.
 * What it does NOT give: since when they've followed. There is no such
 * field, so FollowUp never claims to know it.
 *
 * Hints, not proof. A realtor follows clients back too, so nothing here
 * decides on its own; it goes to the judge as one plain line beside the
 * chat. Anything that fails comes back as null and the check runs as it did
 * before.
 */

export type DmBackground = {
  followsBusiness: boolean | null;
  businessFollows: boolean | null;
  followerCount: number | null;
  /** The chat as Instagram has it, oldest first, up to EARLIER_LIMIT messages. */
  messages: Message[];
};

export const EARLIER_LIMIT = 25;

/** Meta writes "+0000" where Date wants "+00:00". */
function parseGraphTime(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function graph(path: string, accessToken: string, label: string): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${GRAPH_API}/${path}${sep}access_token=${encodeURIComponent(accessToken)}`);
    if (res.ok) return ((await res.json().catch(() => null)) as Record<string, unknown> | null) ?? null;
    // Never the token or the person's id in a log.
    console.error(`Instagram ${label} lookup failed: HTTP ${res.status}`);
    return null;
  } catch {
    return null;
  }
}

/** The person's Instagram background, or null when nothing could be read. */
export async function loadInstagramBackground(businessId: string, igsid: string): Promise<DmBackground | null> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { instagramAccessToken: true, instagramUserId: true, instagramAccountId: true },
  });
  if (!business?.instagramAccessToken || !business.instagramUserId) return null;
  const token = business.instagramAccessToken;
  const id = encodeURIComponent(igsid);
  const [profile, conversations] = await Promise.all([
    graph(`${id}?fields=is_user_follow_business,is_business_follow_user,follower_count`, token, "profile"),
    graph(
      `${encodeURIComponent(business.instagramUserId)}/conversations?platform=instagram&user_id=${id}&fields=messages.limit(${EARLIER_LIMIT}){id,created_time,from,message}`,
      token,
      "conversation"
    ),
  ]);
  if (!profile && !conversations) return null;
  return {
    followsBusiness: typeof profile?.is_user_follow_business === "boolean" ? profile.is_user_follow_business : null,
    businessFollows: typeof profile?.is_business_follow_user === "boolean" ? profile.is_business_follow_user : null,
    followerCount: typeof profile?.follower_count === "number" ? profile.follower_count : null,
    messages: readChat(conversations, new Set([business.instagramUserId, business.instagramAccountId].filter((x): x is string => !!x))),
  };
}

function readChat(conversations: Record<string, unknown> | null, ownIds: ReadonlySet<string>): Message[] {
  const first = Array.isArray(conversations?.data) ? (conversations.data[0] as { messages?: { data?: unknown } } | undefined) : undefined;
  const raw = Array.isArray(first?.messages?.data) ? first.messages.data : [];
  const messages: Message[] = [];
  for (const m of raw as { id?: unknown; created_time?: unknown; from?: { id?: unknown } | null; message?: unknown }[]) {
    const sentAt = parseGraphTime(m?.created_time);
    if (typeof m?.id !== "string" || !sentAt) continue;
    const fromId = typeof m.from?.id === "string" ? m.from.id : "";
    const text = typeof m.message === "string" ? m.message.trim() : "";
    messages.push({
      id: m.id,
      direction: ownIds.has(fromId) ? "outbound" : "inbound",
      channel: "instagram",
      body: text || "[Sent attachment with no message text]",
      date: sentAt.toISOString(),
      opened: false,
    });
  }
  return messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * The chat to judge: what FollowUp holds plus anything earlier that only
 * Instagram has (from before FollowUp was connected), each message once.
 */
export function withEarlierChat(stored: readonly Message[], background: DmBackground | null, limit: number): Message[] {
  const ids = new Set(stored.map((m) => m.id).filter(Boolean));
  const earlier = (background?.messages ?? []).filter((m) => !ids.has(m.id));
  return [...earlier, ...stored].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-limit);
}

/** Whether anything before `messageId` shows them talking with the business already. */
export function talkedBefore(background: DmBackground | null, messageId: string | undefined): boolean {
  return (background?.messages ?? []).some((m) => m.id !== messageId && m.direction === "inbound" && /\p{L}/u.test(m.body) && !m.body.startsWith("[Sent "));
}

/** One plain line for the judge. Says only what Instagram said. */
export function backgroundLine(background: DmBackground | null, messageId: string | undefined): string | undefined {
  if (!background) return undefined;
  const facts: string[] = [];
  if (background.followsBusiness !== null) facts.push(background.followsBusiness ? "they follow the business" : "they don't follow the business");
  if (background.businessFollows !== null) facts.push(background.businessFollows ? "the business follows them back" : "the business doesn't follow them");
  if (background.followerCount !== null) facts.push(`they have ${background.followerCount.toLocaleString("en-US")} followers`);
  const earlier = background.messages.filter((m) => m.id !== messageId);
  if (earlier.length > 0) {
    const since = new Date(earlier[0].date).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
    facts.push(`their chat with the business goes back to ${since}`);
  } else {
    facts.push("this is the first time they've messaged the business");
  }
  return (
    `What Instagram says about this person: ${facts.join("; ")}. These are hints, not proof: the business following ` +
    "them back, or months of casual chat, often mean a friend or family member; someone who follows the business and " +
    "writes for the first time looks like most new customers. Decide from what they actually say."
  );
}
