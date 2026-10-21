/**
 * "Your last 90 days" (A-306, founder 2026-10-21: "yes build it"): once, after FollowUp first reads the inbox, Today
 * says how many people wrote, how many didn't get a reply, and how many emails it set aside. It is the "send me the
 * people who never booked" offer, built in: a busy owner sees what FollowUp is worth in the first minute.
 *
 * Every number is from the owner's own records, and the words never claim more than they show: "didn't get a reply"
 * means their last message has nothing after it here, not that nobody ever called them.
 */

const DAY = 86_400_000;

/** How far back the card looks; the same window the first inbox read covers (gmail.ts, newer_than:90d). */
export const INBOX_SUMMARY_DAYS = 90;

/** How long after connecting the inbox the card may still appear: it belongs to the first days. */
export const INBOX_SUMMARY_SHOW_DAYS = 14;

/** Someone on Today's waiting list (dashboard approvalItems), reduced to who they are and when they last wrote. */
export type WaitingPerson = { leadId: string; lastWroteAt: Date | string | null };

export type InboxSummary = {
  /** People who wrote to the owner in the window. */
  wrote: number;
  /**
   * Of them, who is on Today's waiting list: their last message has no reply after it, and a reply is ready for the
   * owner's tap. Counted from that same list, so the card and Today never disagree, and "Each one has a reply ready
   * below" is true by construction. A customer marked won, put off till later, or still being checked isn't counted.
   */
  missed: number;
  /** Whole days the longest-waiting one has waited. */
  oldestDays: number;
  /** Emails FollowUp read in the window and set aside as not customers. */
  setAside: number;
};

export function summarizeInbox(
  wroteIds: readonly string[],
  waiting: readonly WaitingPerson[],
  setAside: number,
  now: Date
): InboxSummary {
  const wrote = new Set(wroteIds);
  let missed = 0;
  let oldestDays = 0;
  for (const w of waiting) {
    if (!wrote.has(w.leadId)) continue;
    missed++;
    const at = w.lastWroteAt ? new Date(w.lastWroteAt).getTime() : NaN;
    if (Number.isFinite(at)) oldestDays = Math.max(oldestDays, Math.floor((now.getTime() - at) / DAY));
  }
  return { wrote: wrote.size, missed, oldestDays, setAside };
}

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** The card's words: the heading, one line under it, and the set-aside line (null when there's nothing to say). */
export function inboxSummaryWords(s: InboxSummary): { heading: string; line: string; setAside: string | null } {
  const wrote = s.wrote === 1 ? "1 person wrote to you." : `${s.wrote} people wrote to you.`;
  let heading: string;
  let line: string;
  if (s.missed === 0) {
    heading = `${wrote} Nobody is waiting for a reply.`;
    line = "From now on, FollowUp writes the reply the moment they write.";
  } else {
    const one = s.missed === 1;
    heading = `${wrote} ${one && s.wrote === 1 ? "They didn't" : `${s.missed} didn't`} get a reply.`;
    const replies = one ? "Their reply is ready below." : "Each one has a reply ready below.";
    const waited = s.oldestDays >= 1 ? ` ${one ? "They have" : "The oldest has"} waited ${plural(s.oldestDays, "day", "days")}.` : "";
    line = `${replies}${waited}`;
  }
  const setAside =
    s.setAside <= 0
      ? null
      : s.setAside === 1
        ? "1 email that wasn't from a customer was set aside."
        : `${s.setAside} newsletters, receipts and other emails were set aside.`;
  return { heading, line, setAside };
}
