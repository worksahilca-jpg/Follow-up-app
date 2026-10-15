/**
 * "Stay in touch" (A-260, approved 2026-10-15), from Ryan Serhant's "follow
 * back": after the plan's close-the-loop question ("keep going, or close
 * your file?"), a customer who says yes hears from the business now and
 * then, only when the owner has something new that fits what they want.
 *
 *  - Their yes is kept with the date and the message that said it
 *    (Lead.stayInTouchAt, Lead.stayInTouchMessageId). Their plan is over:
 *    no plan message and no welcome back while it holds (followUpState's
 *    "staying").
 *  - Today asks the owner what's new (the "One quick question" card, A-101).
 *    FollowUp writes one note per customer it fits, from the owner's words
 *    only, and each note waits on Today for the owner's OK.
 *  - At most one note per Business.stayInTouchDays (14 or 30) per customer.
 *  - Every note says how to stop; "stop", or any no, ends it at once.
 *
 * Pure: the screens and the server share these. The parts that read and
 * write the database are in src/lib/stayInTouchData.ts.
 */

/** What a note is held as on Today (the "ai.hold" meta trigger). */
export const STAY_IN_TOUCH_TRIGGER = "stay_in_touch";

/** The choices for "How often" (Settings › Follow-up plans). */
export const STAY_IN_TOUCH_DAYS = [14, 30] as const;
export const DEFAULT_STAY_IN_TOUCH_DAYS = 30;

/** The most customers one piece of news is written for at a time. */
export const MAX_NOTES_PER_NEWS = 20;

/** The owner's news, as typed on Today. */
export const MIN_NEWS = 8;
export const MAX_NEWS = 500;

const DAY = 86_400_000;

/** 14 or 30; anything else is the default. */
export function cleanStayDays(v: unknown): 14 | 30 {
  return v === 14 ? 14 : DEFAULT_STAY_IN_TOUCH_DAYS;
}

/** "once a month" / "every 2 weeks", for sentences. */
export function stayEvery(days: number): string {
  return cleanStayDays(days) === 14 ? "every 2 weeks" : "once a month";
}

/** May this customer get a note now: never had one, or the last was at least `days` ago. */
export function noteDue(lastNoteAt: Date | null, days: number, now: Date = new Date()): boolean {
  if (!lastNoteAt) return true;
  // A little slack, so a note written at 9:05 isn't kept waiting by one written at 9:10 the time before.
  return now.getTime() - lastNoteAt.getTime() >= cleanStayDays(days) * DAY - 6 * 3_600_000;
}

/**
 * Today asks the owner "Anything new?" at most twice per period: it asks
 * again half a period after an answer or a "Not now".
 */
export function mayAskForNews(askedAt: Date | null, days: number, now: Date = new Date()): boolean {
  if (!askedAt) return true;
  return now.getTime() - askedAt.getTime() >= (cleanStayDays(days) / 2) * DAY;
}

/** "Anika", "Anika and Raj", "Anika, Raj and Tom", "Anika, Raj and 3 more". */
export function namesList(firsts: readonly string[]): string {
  const n = firsts.filter(Boolean);
  if (n.length <= 1) return n[0] ?? "";
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  if (n.length === 3) return `${n[0]}, ${n[1]} and ${n[2]}`;
  return `${n[0]}, ${n[1]} and ${n.length - 2} more`;
}

/** The question on Today. */
export function newsQuestion(count: number, firsts: readonly string[]): string {
  return count === 1 ? `Anything new for ${firsts[0] ?? "the customer"}, who's staying in touch?` : `Anything new for the ${count} customers staying in touch?`;
}

/** The line under it: why it's worth answering, and the promise. */
export function newsWhy(firsts: readonly string[]): string {
  const who = namesList(firsts);
  return (
    `${who} said yes to hearing from you. FollowUp writes to them only when you have something real to share, ` +
    "and never makes up a home or a price."
  );
}

const NEWS_EXAMPLES: Record<string, string> = {
  "real estate": "e.g. A 3-bed in Erin Mills just listed at $879k. Open house Saturday 2 to 4.",
  "mortgage brokerage": "e.g. Five-year fixed rates dropped this week. Happy to rerun the numbers.",
  "home services (contractor, cleaning, etc.)": "e.g. We have two openings in November for kitchen work.",
};

export function newsExample(trade: string | null | undefined): string {
  const key = (trade ?? "").trim().toLowerCase().replace(/_/g, " ");
  return NEWS_EXAMPLES[key] ?? "e.g. We have openings next week, and a new service you asked about.";
}

/**
 * The note must say how to stop. The writer is told to end with it; when a
 * note in English comes back without one, this line is added, so the
 * promise on the plans page holds whatever the model did.
 */
export const STOP_LINE = "If you'd rather I stop these notes, just say so.";

export function withStopLine(note: string, language: string | null | undefined): string {
  const text = note.trim();
  const english = !language || /^en\b/i.test(language) || /^english$/i.test(language);
  if (!english) return text;
  if (/\bstop\b/i.test(text) || /\bno more\b/i.test(text) || /\bunsubscribe\b/i.test(text)) return text;
  return `${text}${/[.!?]$/.test(text) ? "" : "."} ${STOP_LINE}`;
}

/** What Today says after the owner shares news. */
export function newsResultLines(result: {
  fit: readonly string[];
  notFit: readonly { first: string; why: string }[];
  notDue: number;
  waiting: number;
  unreachable?: number;
  failed?: number;
}): string[] {
  const lines: string[] = [];
  const n = result.fit.length;
  if (n === 0 && (result.failed ?? 0) > 0 && result.notFit.length === 0) lines.push("Saved.");
  else if (n === 0) lines.push("Saved. It doesn't fit anyone staying in touch right now, so FollowUp wrote nothing.");
  else if (n === 1) lines.push(`Saved. It fits ${result.fit[0]}, so FollowUp wrote a note for them. It's on Today, waiting for your OK.`);
  else lines.push(`Saved. It fits ${namesList(result.fit)}, so each gets a note written for them. ${n === 2 ? "Both are" : "They're"} on Today, waiting for your OK.`);
  for (const x of result.notFit.slice(0, 3)) {
    const why = x.why.trim().replace(/[.\s]+$/, "");
    lines.push(why ? `Nothing for ${x.first} this time: ${why}.` : `Nothing for ${x.first} this time.`);
  }
  if (result.notFit.length > 3) lines.push(`And ${result.notFit.length - 3} more it doesn't fit.`);
  if (result.waiting > 0) {
    lines.push(
      result.waiting === 1
        ? "One customer already has a message waiting for your OK, so FollowUp didn't write another."
        : `${result.waiting} customers already have a message waiting for your OK, so FollowUp didn't write more.`
    );
  }
  const failed = result.failed ?? 0;
  if (failed > 0) {
    lines.push(
      failed === 1
        ? "FollowUp couldn't write one of the notes just now. Share the news again in a while and it will try again."
        : `FollowUp couldn't write ${failed} of the notes just now. Share the news again in a while and it will try again.`
    );
  }
  const unreachable = result.unreachable ?? 0;
  if (unreachable > 0) {
    lines.push(
      unreachable === 1
        ? "One customer wrote on Instagram or Messenger, which only lets you write within a day of their last message, so FollowUp left them."
        : `${unreachable} customers wrote on Instagram or Messenger, which only let you write within a day of their last message, so FollowUp left them.`
    );
  }
  if (result.notDue > 0) {
    lines.push(result.notDue === 1 ? "One customer had a note recently, so they're left for now." : `${result.notDue} customers had a note recently, so they're left for now.`);
  }
  return lines;
}
