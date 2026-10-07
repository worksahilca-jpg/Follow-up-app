/**
 * The rules of the realtor team pilot (design brain A-103, founder
 * 2026-10-07), with nothing imported, so the customer page, Today and the
 * tests all read the same rules. The database side is src/lib/calls.ts.
 *
 * What a sales team told us: they call every ad lead, half never pick up,
 * and those wait about two months for the next call. "No answer" is the one
 * tap that stops that: it records the call, writes one short text asking for
 * a good time (which always waits for an OK during the trial), and puts the
 * next call on the caller's Today.
 */

export type CallOutcome = "no_answer" | "spoke";

/** After this many unanswered calls in a row, FollowUp stops planning calls. Check-ins carry on as usual. */
export const MAX_UNANSWERED_CALLS = 3;

/** The next call is planned a day after the last one, at the same time of day. */
export const NEXT_CALL_AFTER_MS = 24 * 60 * 60 * 1000;

/** A new customer stays on "Calls to make" this long without a first call; after that they're an old lead, not a new one. */
export const NEW_CUSTOMER_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** The draft kinds a "No answer" writes (Lead.suggestedDraftKind). */
export const NO_ANSWER_TEXT = "no_answer_text";
export const NO_ANSWER_EMAIL = "no_answer_email";

export function isNoAnswerDraft(kind: string | null | undefined): boolean {
  return kind === NO_ANSWER_TEXT || kind === NO_ANSWER_EMAIL;
}

/**
 * A number someone can actually dial. Instagram and Messenger customers
 * keep a platform id in the phone column ("ig:…", "fb:…"), and a hidden
 * caller has none.
 */
export function isCallablePhone(phone: string | null | undefined): phone is string {
  if (!phone || /^(ig|fb):/.test(phone)) return false;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** What goes in a tel: link: the digits, with a leading + kept. */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/^whatsapp:/, "").trim();
  return `tel:${cleaned.startsWith("+") ? "+" : ""}${cleaned.replace(/\D/g, "")}`;
}

/**
 * When to call again after an unanswered call, or null to stop planning
 * calls. `unanswered` counts this one too.
 */
export function nextCallAfter(calledAt: Date, unanswered: number): Date | null {
  if (unanswered >= MAX_UNANSWERED_CALLS) return null;
  return new Date(calledAt.getTime() + NEXT_CALL_AFTER_MS);
}

/**
 * The text a "No answer" writes. Plain, short, nothing FollowUp can't know:
 * who called, from where, and a question the customer can answer in a word.
 * No price, no listing, no time is promised. `caller` and `business` may be
 * missing; the sentence still reads.
 */
export function noAnswerText(customerFirst: string, caller: string | null, business: string | null): string {
  const who = caller && business ? `it's ${caller} from ${business}` : caller ? `it's ${caller}` : business ? `it's ${business}` : null;
  const hi = customerFirst ? `Hi ${customerFirst}` : "Hi";
  return `${hi}${who ? `, ${who}` : ""}. I just tried to call you. When's a good time to talk?`;
}

/** The same words as an email: a subject, then the frame every FollowUp email has. */
export function noAnswerEmail(customerFirst: string, caller: string | null, business: string | null): { subject: string; body: string } {
  const who = caller && business ? `It's ${caller} from ${business}. ` : caller ? `It's ${caller}. ` : business ? `It's ${business}. ` : "";
  return {
    subject: "I tried to call you",
    body: `Hi${customerFirst ? ` ${customerFirst}` : ""},\n\n${who}I just tried to call you. When's a good time to talk?\n\n${caller ?? business ?? ""}`.trimEnd(),
  };
}

/**
 * "1st call", "2nd call"… for the card. Only small numbers ever show:
 * planning stops after MAX_UNANSWERED_CALLS.
 */
export function ordinalCall(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${s} call`;
}

/**
 * Monday 00:00 of this week in the business's own time zone, as an instant
 * ("This week" on the Team page starts there, like a sales team's week).
 */
export function startOfLocalWeek(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const daysSinceMonday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday"));
  const intoDay = (Number(get("hour")) * 3600 + Number(get("minute")) * 60 + Number(get("second"))) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - intoDay - Math.max(0, daysSinceMonday) * 24 * 60 * 60 * 1000);
}

/** Someone with no meetings this week is flagged from Wednesday on, or sooner if their calls are more than a day late. */
export function behindThisWeek(p: { meetings: number; lateCalls: number }, weekStart: Date, now: Date): boolean {
  if (p.meetings > 0) return false;
  if (p.lateCalls > 0) return true;
  return now.getTime() - weekStart.getTime() >= 2 * 24 * 60 * 60 * 1000;
}
