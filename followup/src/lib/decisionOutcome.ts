/**
 * What happened after FollowUp wrote a reply (step 2 of research/product/2026-10-23-self-improving-loop.md): what the
 * owner did with the draft, and what the customer did next. Pure: no database, so every rule is tested on its own.
 *
 * The windows are the founder's (2026-10-23, picked from three): a customer has 3 days to reply and 14 to book before
 * FollowUp counts the message as having gone quiet. Until a window closes the answer is "waiting", never "no": a
 * customer who hasn't answered yet hasn't said no.
 */

export const REPLY_WINDOW_DAYS = 3;
export const BOOKING_WINDOW_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

/** At or above this share of words changed, the owner wrote their own reply rather than editing FollowUp's. */
export const REWRITE_AT = 0.5;

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/**
 * How much a person changed a draft before sending it: 0 sent as written, 1 every word replaced. Word-level edit
 * distance over the longer of the two, so fixing one word in a long email is small and replacing the reply is large.
 * Punctuation, case and spacing don't count.
 */
export function editSize(draft: string, sent: string): number {
  const a = words(draft);
  const b = words(sent);
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return Math.round((row[b.length] / longest) * 100) / 100;
}

export type OwnerAction = "sent_by_itself" | "sent_as_written" | "edited" | "rewritten" | "not_sent";

/** What the owner did with a draft FollowUp wrote. */
export function ownerActionOf(send: { automated: boolean; editSize: number | null } | { dismissed: true }): OwnerAction {
  if ("dismissed" in send) return "not_sent";
  if (send.automated) return "sent_by_itself";
  if (send.editSize == null || send.editSize === 0) return "sent_as_written";
  return send.editSize >= REWRITE_AT ? "rewritten" : "edited";
}

export type Answer = "yes" | "no" | "waiting";
export type OutcomeSummary = "stopped" | "said_no" | "booked" | "replied" | "quiet" | "waiting";

export interface Outcome {
  /** Did they reply within REPLY_WINDOW_DAYS? */
  reply: Answer;
  /** Did they book within BOOKING_WINDOW_DAYS? */
  booking: Answer;
  /** Said no after this message (src/lib/automation.ts, Lead.saidNoAt). */
  saidNo: boolean;
  /** Asked not to be contacted again after this message: an unsubscribe, a STOP, a complaint (Suppression). */
  stopped: boolean;
  /** One word for the whole story, strongest signal first. */
  summary: OutcomeSummary;
}

/**
 * What the customer did after a message went out at `sentAt`. Each signal counts only when it came after the
 * message; a reply or booking after its window closed counts as "no" for this message (it may belong to a later one).
 */
export function outcomeOf(input: {
  sentAt: Date;
  repliedAt?: Date | null;
  bookedAt?: Date | null;
  saidNoAt?: Date | null;
  stoppedAt?: Date | null;
  now: Date;
}): Outcome {
  const { sentAt, now } = input;
  const after = (d: Date | null | undefined): d is Date => d != null && d.getTime() >= sentAt.getTime();
  const within = (d: Date | null | undefined, days: number): Answer => {
    if (after(d) && d.getTime() - sentAt.getTime() <= days * DAY) return "yes";
    return now.getTime() - sentAt.getTime() < days * DAY ? "waiting" : "no";
  };
  const reply = within(input.repliedAt, REPLY_WINDOW_DAYS);
  const booking = within(input.bookedAt, BOOKING_WINDOW_DAYS);
  const saidNo = after(input.saidNoAt);
  const stopped = after(input.stoppedAt);
  const summary: OutcomeSummary = stopped
    ? "stopped"
    : saidNo
      ? "said_no"
      : booking === "yes"
        ? "booked"
        : reply === "yes"
          ? "replied"
          : reply === "no"
            ? "quiet"
            : "waiting";
  return { reply, booking, saidNo, stopped, summary };
}
