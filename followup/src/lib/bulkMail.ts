/**
 * Newsletters and mailing lists are never a customer writing in.
 *
 * Found by a tester's personal inbox, 2026-10-07: one creator's newsletter,
 * delivered to Primary rather than Promotions, was let in by the classifier,
 * and every later thread from the same address then skipped the classifier
 * as a "known customer". One wrong verdict became one lead with 25 threads.
 *
 * Every bulk sender marks its mail as bulk (List-Unsubscribe, which Gmail
 * and Yahoo require of bulk senders, or Precedence: bulk). A person typing
 * an enquiry never does. So this is decided from headers, before the
 * classifier, at no cost, and recorded where the owner can overrule it
 * like any other verdict (Settings → filtered emails).
 *
 * Deliberately narrow, because a lost lead is the worst failure there is:
 *  - A Google Group the business receives mail through (info@ as a group)
 *    stamps list headers on a real customer's enquiry. Those messages carry
 *    the group's own headers and are never read as bulk.
 *  - A website form or lead-site notice (`shared`, or a Reply-To customer)
 *    is not the customer's own mail, so its headers say nothing about them.
 *  - A thread the business wrote in is a conversation, not a broadcast.
 */

type Header = { name?: string | null; value?: string | null };

function header(headers: Header[] | undefined, name: string): string | null {
  const found = headers?.find((h) => h.name?.toLowerCase() === name);
  return found ? (found.value ?? "") : null;
}

/** The reason shown in Settings → filtered emails. */
export const NEWSLETTER_REASON = "A newsletter or mailing list: it has an unsubscribe link, so it was sent to many people at once.";

/** Does this one message say it was sent in bulk? */
export function isBulkMail(headers: Header[] | undefined): boolean {
  // Google Groups: a real person's mail, relayed through the business's own group.
  if (header(headers, "x-google-group-id") !== null || header(headers, "mailing-list") !== null) return false;
  if (header(headers, "list-unsubscribe") !== null) return true;
  const precedence = header(headers, "precedence")?.trim().toLowerCase();
  return precedence === "bulk" || precedence === "junk";
}

/**
 * Is this whole thread a broadcast from its counterpart? Only when they
 * sent at least one message themselves, every message they sent was bulk,
 * and the business never wrote in the thread.
 */
export function isNewsletterThread(
  messages: { from: { email: string }; direction: "inbound" | "outbound"; bulk: boolean }[],
  counterpart: { email: string; shared: boolean }
): boolean {
  if (counterpart.shared) return false;
  if (messages.some((m) => m.direction === "outbound")) return false;
  const who = counterpart.email.trim().toLowerCase();
  const theirs = messages.filter((m) => m.from.email.trim().toLowerCase() === who);
  return theirs.length > 0 && theirs.every((m) => m.bulk);
}
