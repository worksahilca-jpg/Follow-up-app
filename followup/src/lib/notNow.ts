/**
 * "Not now" (A-329, approved 2026-10-26). A customer whose message might be a no (A-326) and reads as timing, not a
 * refusal: "not right now, maybe next spring", "holding off for now", "abhi nahi". Realtors treat that as timing and
 * check back; the founder decided FollowUp keeps stopping by default and each owner chooses, once:
 *
 * - "stop" (the default, and what an owner who hasn't answered gets): FollowUp stops and the owner checks. The reply
 *   that waits for them is a short, warm thanks with no question.
 * - "ask": the reply asks once, lightly, when would be a good time to check back (or confirms the time they gave),
 *   and on that day FollowUp brings them up on Today with one short note ("Their moment", A-262). Nothing else goes:
 *   no plan step, workflow or win-back while they are on this path (Lead.notNowAt).
 *
 * Customers first (the founder: "we should respect the customer"): a clear no, an agent, STOP and the six-month
 * consent window always win, and every message on this path waits for the owner's OK.
 *
 * Pure: scoring, the automation and the screens share it.
 */
import type { NoHow } from "@/lib/declinePhrases";
import { checkBackDate, timeInWords } from "@/lib/followUpPlans";
import { MAX_QUOTE, MOMENT_WINDOW_DAYS } from "@/lib/theirMoment";

export type NotNowPlan = "stop" | "ask";

/** Business.notNowPlan as stored: null until the owner answers (FollowUp then stops, the default). */
export function readNotNowPlan(v: string | null | undefined): NotNowPlan | null {
  return v === "stop" || v === "ask" ? v : null;
}

// Timing, said as timing. English first, then the languages the 50 test conversations use (Hinglish, French,
// Spanish). Bounded on purpose: a "for now" in "that's all for now" only counts because the AI readings already
// thought the message might be a no (notNowStep asks for "unsure").
const NOT_NOW =
  /\b(?:not (?:right |just )?now|not (?:just )?yet|not at (?:the|this) (?:moment|time|point)|for now|for the time being|hold(?:ing)? off|on hold|tak(?:e|ing) a (?:break|pause|step back)|maybe (?:later|next|in|after|someday|down the road)|later (?:this|next|in the) \w+|down the road|not ready(?: yet)?|after the (?:holidays|new year|summer|winter)|next (?:year|spring|summer|fall|autumn|winter)|in a (?:few|couple(?: of)?) (?:weeks|months)|abhi nahi|baad (?:mein|me)|plus tard|pas (?:maintenant|pour (?:le moment|l'instant))|ahora no|m[aá]s tarde)\b/i;

// They said they will come back themselves ("I'll reach out when I'm ready", "we'll let you know"): asking them when
// would be pushing, so it is not a "not now" FollowUp asks about. Stop stays.
const THEY_LEAD =
  /\b(?:i'?ll|we'?ll|i will|we will|i'?m going to|we'?re going to)\s+(?:let you know|reach out|get back to you|be in touch|contact you|call you|text you|email you|message you|ping you|come back to you)\b|\bwhen (?:i'?m|we'?re|i am|we are) ready\b/i;

// They want something now: a question, a yes, a request. Then it isn't "not now", whatever else it says
// ("Not now, I'm at work. Call me after 6?").
const STILL_HERE = /[?？]|\b(?:yes|yeah|oui|s[ií]|haan|still interested|call me|text me|send me|can we|could we|keep me posted)\b/i;

/** Their message says "not now" as timing, and doesn't leave the next move with them or ask for something now. */
export function notNowIn(text: string): boolean {
  const t = text.slice(0, 2000);
  return NOT_NOW.test(t) && !THEY_LEAD.test(t) && !STILL_HERE.test(t);
}

const DAY = 86_400_000;

/**
 * The time they gave to hear back, from their own words ("try me in March", "maybe next spring", "after the
 * holidays"), counted from when they wrote. Only ahead, and only inside the consent window (MOMENT_WINDOW_DAYS),
 * so FollowUp never checks back on someone it may no longer write to.
 */
export function checkBackDay(text: string, sentAtMs: number): number | null {
  const at = checkBackDate(text, sentAtMs) ?? timeInWords(text, sentAtMs)?.at ?? null;
  if (at === null || at <= sentAtMs + DAY || at > sentAtMs + MOMENT_WINDOW_DAYS * DAY) return null;
  return at;
}

/** Their words, as kept for the check-back note (Lead.momentQuote). */
export function notNowQuote(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > MAX_QUOTE ? `${s.slice(0, MAX_QUOTE - 1).trimEnd()}…` : s;
}

/** What this reply should do, for the reply writer ("What this particular follow-up should focus on: …"). */
export const NOT_NOW_HINT = {
  close:
    "Their last message says now isn't the right time. Write only a short, warm reply: thank them and say there's " +
    "no rush. Ask nothing and offer nothing; the owner decides whether to write again.",
  ask:
    "Their last message says now isn't the right time. Thank them, say there's no rush, and ask once, lightly, when " +
    "would be a good time to check back. That is the only question; offer nothing else and don't try to change their mind.",
  confirm:
    "They have told you when would be a better time. Thank them and confirm plainly that you'll check in then. Ask " +
    "nothing and offer nothing else.",
} as const;

export type NotNowStep = {
  /** For the reply writer; null leaves the reply as it would have been. */
  hint: string | null;
  /** Lead.notNowAt: a time sets it, null clears it, undefined leaves it as it is. */
  notNowAt: Date | null | undefined;
  /** The one check-back, ms, when a time was given; null when none. */
  day: number | null;
};

/**
 * What a new message from the customer means for the "not now" path. Called only when the customer is the one who
 * just wrote. `onPath` is Lead.notNowAt before this message; `noHow` is how this message was read (A-326).
 */
export function notNowStep(input: { plan: NotNowPlan | null; noHow: NoHow | null; text: string; sentAt: Date; onPath: Date | null }): NotNowStep {
  const { plan, noHow, text, sentAt, onPath } = input;
  const leave: NotNowStep = { hint: null, notNowAt: undefined, day: null };
  // A clear no, or an agent: the path ends and the no stands.
  if (noHow === "clear" || noHow === "agent") return { hint: null, notNowAt: onPath ? null : undefined, day: null };
  const notNow = notNowIn(text);
  // Asked already: an earlier message started the path and FollowUp has had its one question.
  const asked = Boolean(onPath && onPath.getTime() < sentAt.getTime());
  if (noHow === "unsure") {
    if (!notNow) return onPath ? { hint: null, notNowAt: null, day: null } : leave;
    if (plan !== "ask") return { hint: NOT_NOW_HINT.close, notNowAt: onPath ? null : undefined, day: null };
    const day = checkBackDay(text, sentAt.getTime());
    if (day !== null) return { hint: NOT_NOW_HINT.confirm, notNowAt: asked ? onPath : sentAt, day };
    return { hint: asked ? NOT_NOW_HINT.close : NOT_NOW_HINT.ask, notNowAt: asked ? onPath : sentAt, day: null };
  }
  if (!onPath) return leave;
  // On the path, and this isn't a no: their answer.
  const day = checkBackDay(text, sentAt.getTime());
  if (day !== null) return { hint: NOT_NOW_HINT.confirm, notNowAt: onPath, day };
  if (notNow) return { hint: NOT_NOW_HINT.close, notNowAt: onPath, day: null };
  // Anything else: they're back in a normal conversation.
  return { hint: null, notNowAt: null, day: null };
}

/** The words on Today and in Settings › Sending replies, as drawn and approved (2026-10-26). One place, so both match. */
export const NOT_NOW_WORDS = {
  question: "When a customer says “not now”, what should FollowUp do?",
  label: "When a customer says “not now”",
  stop: "Stop. I'll check myself",
  stopOnToday: "What FollowUp just did. Nothing more is sent.",
  stopInSettings: "The default. Nothing more is sent.",
  ask: "Ask when, then check back once",
  askSub: "One short question. If they give a time, one message then. Nothing else.",
  once: "FollowUp asks you this once. Change it any time in Settings.",
  always: "A clear no or STOP always ends it, whatever you pick.",
} as const;
