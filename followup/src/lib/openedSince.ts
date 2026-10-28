import type { Message } from "@/lib/types";

/**
 * Has the owner opened this customer since their newest message? A list row
 * reads bold, like an unread chat, only until then (founder, 2026-10-28).
 * A customer with no messages counts as read once opened at all.
 */
export function openedSince(lead: { openedAt?: string | null; conversation: readonly Message[] }): boolean {
  if (!lead.openedAt) return false;
  const lastIn = [...lead.conversation].reverse().find((m) => m.direction === "inbound");
  return !lastIn || new Date(lastIn.date).getTime() <= new Date(lead.openedAt).getTime();
}
