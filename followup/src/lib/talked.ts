/**
 * "We talked" (design brain A-039; Close's "Mark as Responded",
 * research/product/2026-09-26-close-follow-up-workflow.md #1).
 *
 * FollowUp cannot see a phone call or a conversation at the counter. Until
 * this existed, a customer the owner had just spoken to kept getting
 * check-ins on day 3, 7, 14 and 30, and a reply drafted to a question the
 * owner had already answered in person sat in Needs you. One tap tells
 * FollowUp the customer has been answered.
 *
 * It does not switch the lead off. It settles the conversation as it
 * stands: every automatic path treats the customer as answered and the
 * check-ins as finished, UNTIL THEY WRITE AGAIN. A message from them newer
 * than `talkedAt` is a new conversation, and everything resumes on its own,
 * with no setting for the owner to remember to turn back on.
 *
 * No imports on purpose: the lead page, the at-risk list and the status
 * badge read this too, and nothing here may pull the database client into
 * a browser bundle. The owner's tap itself is in markTalked.ts.
 */

/**
 * True when the owner's "We talked" answers the customer's latest message
 * (or there has been no message from them at all). Every automatic path
 * asks this one question, so none of them can drift from the others.
 */
export function settledByTalk(talkedAt: Date | null | undefined, lastInboundAt: Date | number | null | undefined): boolean {
  if (!talkedAt) return false;
  if (lastInboundAt == null) return true;
  const inboundMs = typeof lastInboundAt === "number" ? lastInboundAt : lastInboundAt.getTime();
  return talkedAt.getTime() >= inboundMs;
}

/** The newest inbound time in a list of messages, whatever shape they come in. */
export function lastInboundTime(messages: { direction: string; sentAt?: Date; at?: number; date?: string }[]): number | null {
  let newest: number | null = null;
  for (const m of messages) {
    if (m.direction !== "inbound") continue;
    const t = m.sentAt ? m.sentAt.getTime() : m.at ?? (m.date ? new Date(m.date).getTime() : null);
    if (t != null && (newest == null || t > newest)) newest = t;
  }
  return newest;
}
