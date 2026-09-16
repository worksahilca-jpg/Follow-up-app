/**
 * One lead's channels, flattened into one chronological transcript.
 *
 * Leaf module on purpose: no Prisma, no OpenAI, no imports at all. Every
 * caller that pays an AI to judge a lead reads the same transcript in the
 * same order, and none of them can drift from the others.
 *
 * The ordering has to be TOTAL, not merely chronological. A lead is keyed
 * (businessId, email), so one contact routinely holds several threads, and
 * neither Prisma query that loads them asks Postgres to order the
 * conversations themselves — only the messages inside each one. Flattening
 * in the order rows happen to come back means "the first three messages"
 * is whichever thread the planner touched first, which can differ between
 * two runs over identical data. Two messages can also share an exact
 * sentAt (an inbound text and the outbound acknowledgement written in the
 * same millisecond, or a batch import stamping several rows from one API
 * response), so the timestamp alone is not a total order either.
 *
 * Ties break toward the lead's own message being last: outbound sorts
 * before inbound, and `id` settles anything still tied, so the result is
 * deterministic for a given set of rows. See classifyQuietLeads in
 * src/lib/reactivation.ts, where "who spoke last" is what splits COLD from
 * COLD_UNANSWERED, and POST /api/leads/cleanup, where the first three
 * messages are the whole basis of a delete-or-keep verdict.
 */

import type { Message } from "@/lib/types";

/**
 * The shape both callers' Prisma includes satisfy — deliberately narrower
 * than the generated model types so this file needs no Prisma import.
 */
export type TranscriptConversation = {
  channel: string;
  messages: { id: string; direction: string; body: string; sentAt: Date; opened: boolean }[];
};

/**
 * Tie-break rank for two messages sent in the same millisecond: outbound
 * sorts before inbound, so a tie leaves the LEAD's message last.
 */
const TIE_RANK: Record<string, number> = { outbound: 0, inbound: 1 };

export function toTranscript(conversations: TranscriptConversation[]): Message[] {
  return conversations
    .flatMap((c) =>
      c.messages.map((m) => ({
        id: m.id,
        direction: m.direction as Message["direction"],
        channel: c.channel as Message["channel"],
        body: m.body,
        date: m.sentAt.toISOString(),
        opened: m.opened,
      }))
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (TIE_RANK[a.direction] ?? 0) - (TIE_RANK[b.direction] ?? 0) ||
        a.id.localeCompare(b.id)
    );
}
