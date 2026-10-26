/**
 * "Their moment" (A-262, approved 2026-10-15): a time the customer named
 * about a plan of theirs ("we'll talk to the bank in January", "our lease
 * ends in March", "moving next spring"). FollowUp keeps it with their words,
 * and when it comes, brings them up on Today with a note that starts from
 * what they said. The note waits for the owner's OK like every note.
 *
 * Who it is for: a customer staying in touch (A-260), always; anyone else
 * only while their enquiry is recent (MOMENT_WINDOW_DAYS: in Canada an
 * enquiry gives implied consent for six months, CASL). Research:
 * followup/research/product/2026-10-15-what-to-send-when-staying-in-touch.md
 * (a note set off by something they said is the kind most likely to get
 * an answer).
 *
 * Pure: the screens and the server share these. The parts that read and
 * write the database are in src/lib/theirMomentData.ts.
 */
import { timeInWords } from "@/lib/followUpPlans";

/** What a moment's note is held as on Today (the "ai.hold" meta trigger). */
export const THEIR_MOMENT_TRIGGER = "their_moment";

/** Without the yes to staying in touch, a moment counts only this long after their last message. */
export const MOMENT_WINDOW_DAYS = 180;

/** A moment is for the far side: the plan already covers the next two weeks. */
export const MIN_DAYS_AHEAD = 14;

export const MAX_QUOTE = 240;

const DAY = 86_400_000;

// A time they named about a step or a plan of theirs. Not a time they asked
// to be contacted (checkBackDate reads that and holds the plan), and not a
// time in the past ("the house we saw in May").
const FORWARD =
  /\b(?:will|'ll|going to|gonna|plan(?:ning|s)?|hop(?:e|ing)|think(?:ing)?|look(?:ing)? to|want(?:ing)? to|aim(?:ing)?|expect(?:ing)?|ready|mov(?:e|ing)|relocat(?:e|ing)|lease|clos(?:e|ing)|sell(?:ing)?|buy(?:ing)?|start(?:ing)?|retir(?:e|ing)|bank|pre-?approv\w*|approval|wait(?:ing)?|not until|not before|until|once|when)\b/i;
const PAST = /\b(?:saw|seen|bought|sold|moved|visited|was|were|had|did|ago)\b/i;

/** The moment in a message, with their words, or null when it names none. */
export function readMoment(text: string, sentAtMs: number): { at: number; quote: string } | null {
  const found = timeInWords(text, sentAtMs);
  if (!found) return null;
  const s = found.sentence;
  if (!FORWARD.test(s) || PAST.test(s)) return null;
  if (found.at < sentAtMs + MIN_DAYS_AHEAD * DAY) return null;
  return { at: found.at, quote: s.length > MAX_QUOTE ? `${s.slice(0, MAX_QUOTE - 1).trimEnd()}…` : s };
}

/**
 * May FollowUp write for this moment now: they said yes to staying in touch,
 * or wrote within the window; and nothing they said since says stop.
 */
export function mayWriteMoment(
  lead: { stayInTouchAt: Date | null; optedOutAt: Date | null; saidNoAt: Date | null; momentSaidAt: Date | null; notNowAt?: Date | null },
  lastInboundAt: Date | null,
  now: Date = new Date()
): boolean {
  if (lead.optedOutAt) return false;
  // A no stops it, said after the moment or in the same message (A-329: "Stop" means nothing more is sent). The one
  // exception is the "not now" path, where the owner chose to check back once at the time the customer gave.
  if (lead.saidNoAt && (!lead.momentSaidAt || lead.saidNoAt > lead.momentSaidAt || (lead.saidNoAt.getTime() === lead.momentSaidAt.getTime() && !lead.notNowAt))) return false;
  if (lead.stayInTouchAt) return true;
  return lastInboundAt != null && now.getTime() - lastInboundAt.getTime() <= MOMENT_WINDOW_DAYS * DAY;
}

/** "in the first week of January" / "around Mar 20". */
export function describeMoment(at: Date, timeZone: string): string {
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone, day: "numeric" }).format(at));
  if (day <= 7) return `in the first week of ${new Intl.DateTimeFormat("en-US", { timeZone, month: "long" }).format(at)}`;
  return `around ${new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(at)}`;
}

/** The sentence on the customer's page. */
export function momentSentence(first: string, at: Date, timeZone: string): string {
  return `FollowUp brings ${first} up on Today ${describeMoment(at, timeZone)}, with a note about it.`;
}

/** "in October", or "in October 2025" when it was another year: the head of the card on Today. */
export function saidWhen(saidAt: Date, now: Date, timeZone: string): string {
  const year = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric" }).format(d);
  const month = new Intl.DateTimeFormat("en-US", { timeZone, month: "long" }).format(saidAt);
  return year(saidAt) === year(now) ? `in ${month}` : `in ${month} ${year(saidAt)}`;
}

/** "January": the month the moment falls in, for the note writer. */
export function momentMonth(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, month: "long" }).format(at);
}
