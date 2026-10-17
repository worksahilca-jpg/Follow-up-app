/**
 * "Before your call" (design brain A-268): what to talk about on a booked call, written from the customer's own words.
 *
 * The founder's question (2026-10-16): once someone is booked and handed over, how does the owner know "what to talk
 * about, what to follow up on, and how to close the deal that was going on before?" The answer is a short note in five
 * parts: what they want, what they asked, what is still open, what is on their mind, and one next step to offer.
 *
 * A model reads the conversation and proposes the lines (src/lib/integrations/openai.ts, extractCallBrief). It never
 * decides what the owner sees: every line arrives with the exact words behind it, and checkBrief keeps a line only when
 * each of those words is found, as written, in a message from the right side. What the customer wants, asked, feels or
 * said yes to needs the customer's words; "You said you'd check the property tax" needs the owner's. A line that can't
 * show its words is dropped, never shown as fact (the same rule as the Ready card, A-246).
 *
 * No pressure (A-247): the next step is something the customer asked about or said yes to, and a line that talks
 * about pushing or closing someone is dropped.
 */
import type { Message } from "@/lib/types";
import { MAX_QUOTE, normaliseForMatch } from "@/lib/qualification";

export type BriefSection = "wants" | "asked" | "open" | "mind" | "next";
export const BRIEF_SECTIONS: readonly BriefSection[] = ["wants", "asked", "open", "mind", "next"];

/** At most this many lines in each part, so the note stays a minute's read. */
export const SECTION_LIMIT: Readonly<Record<BriefSection, number>> = { wants: 1, asked: 2, open: 3, mind: 1, next: 1 };

/** Longest line kept: one or two short sentences. */
export const MAX_LINE = 200;

/** Most quotes behind one line. */
export const MAX_QUOTES = 3;

/** The words behind a line: who wrote them, and when. */
export type BriefQuote = { quote: string; by: "them" | "you"; at: string };

export type BriefLine = { text: string; quotes: BriefQuote[] };

export type CallBrief = {
  v: 1;
  /** How many messages the conversation had when this was written. A new message makes it out of date. */
  messages: number;
  wants: BriefLine[];
  asked: BriefLine[];
  open: BriefLine[];
  mind: BriefLine[];
  next: BriefLine[];
};

/** One line as the model proposed it, before anything is checked. */
export type ProposedLine = {
  section: BriefSection;
  text: string;
  quotes: { quote: string; by: "customer" | "business" }[];
};

/**
 * Words a note about a customer never uses (A-247: no pressure). A line with any of them is dropped: the owner is
 * getting ready to help someone, not to work on them. "Closing" alone stays allowed: in real estate it is the day
 * the home changes hands, and a customer's own hurry ("we need to move fast") is a fact worth knowing.
 */
const PRESSURE =
  /\b(close (the|this) (deal|sale)|close (him|her|them)|pressure (him|her|them)|push (him|her|them)|act (now|fast)|before it'?s gone|won'?t last|limited time|hard sell|upsell)\b/i;

/** Where the words of `quote` are: the first message on that side that holds them, or null. */
export function findQuote(quote: string, by: "customer" | "business", conversation: readonly Message[]): BriefQuote | null {
  const q = normaliseForMatch(quote);
  if (q.length < 3 || q.length > MAX_QUOTE) return null;
  const side = by === "customer" ? "inbound" : "outbound";
  const hit = conversation.find((m) => m.direction === side && m.body.trim() && normaliseForMatch(m.body).includes(q));
  return hit ? { quote: quote.trim(), by: by === "customer" ? "them" : "you", at: hit.date } : null;
}

/** An empty note, for when nothing true could be said. */
export function emptyBrief(messages: number): CallBrief {
  return { v: 1, messages, wants: [], asked: [], open: [], mind: [], next: [] };
}

/**
 * The model's proposal, checked line by line against the conversation. Kept: a line in a known part, with plain
 * short text, no pressure words, one to three quotes that are all found on their side, and, except for "Still
 * open", at least one of them the customer's own. Everything else is dropped. Each part keeps at most its limit, in
 * the order proposed, and no line twice.
 */
export function checkBrief(proposed: readonly ProposedLine[], conversation: readonly Message[]): CallBrief {
  const brief = emptyBrief(conversation.length);
  const seen = new Set<string>();
  for (const line of proposed) {
    if (!BRIEF_SECTIONS.includes(line.section)) continue;
    const part = brief[line.section];
    if (part.length >= SECTION_LIMIT[line.section]) continue;
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text || text.length > MAX_LINE || PRESSURE.test(text)) continue;
    const key = normaliseForMatch(text);
    if (seen.has(key)) continue;
    if (!Array.isArray(line.quotes) || line.quotes.length === 0 || line.quotes.length > MAX_QUOTES) continue;
    const found = line.quotes.map((q) => (q.by === "customer" || q.by === "business" ? findQuote(q.quote, q.by, conversation) : null));
    if (found.some((q) => q === null)) continue;
    const quotes = found as BriefQuote[];
    if (line.section !== "open" && !quotes.some((q) => q.by === "them")) continue;
    seen.add(key);
    part.push({ text, quotes });
  }
  return brief;
}

/**
 * What they want, from what the Ready card already knows (A-246), for when the model couldn't be asked. Each fact
 * there was checked against the customer's words when it was learned; its words are looked up again here for the
 * date, and a fact whose words can't be found is left out.
 */
export function wantsFromFacts(facts: readonly { value: string; quote: string }[], conversation: readonly Message[]): BriefLine | null {
  const kept = facts.flatMap((f) => {
    const value = f.value.trim();
    const q = f.quote ? findQuote(f.quote, "customer", conversation) : null;
    return value && q ? [{ value, q }] : [];
  });
  if (kept.length === 0) return null;
  const text = kept
    .slice(0, MAX_QUOTES)
    .map((k) => k.value.replace(/[.\s]+$/, ""))
    .join(". ");
  return { text: `${text}.`, quotes: kept.slice(0, MAX_QUOTES).map((k) => k.q) };
}

/** A stored note, read defensively: anything off-shape is treated as no note. */
export function readCallBrief(value: unknown): CallBrief | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1 || typeof v.messages !== "number") return null;
  const lines = (x: unknown): BriefLine[] =>
    Array.isArray(x)
      ? x.flatMap((l): BriefLine[] => {
          const o = l as Record<string, unknown>;
          if (!o || typeof o.text !== "string" || !Array.isArray(o.quotes)) return [];
          const quotes = o.quotes.flatMap((q): BriefQuote[] => {
            const r = q as Record<string, unknown>;
            return r && typeof r.quote === "string" && (r.by === "them" || r.by === "you") && typeof r.at === "string"
              ? [{ quote: r.quote, by: r.by, at: r.at }]
              : [];
          });
          return quotes.length > 0 ? [{ text: o.text, quotes }] : [];
        })
      : [];
  return { v: 1, messages: v.messages, wants: lines(v.wants), asked: lines(v.asked), open: lines(v.open), mind: lines(v.mind), next: lines(v.next) };
}

/** Nothing true to say in any part. */
export function isBriefEmpty(b: CallBrief | null): boolean {
  return !b || BRIEF_SECTIONS.every((s) => b[s].length === 0);
}

/** Written from the conversation as it is now: no message has come or gone since. */
export function isBriefCurrent(b: CallBrief | null, messages: number): boolean {
  return Boolean(b && b.messages === messages);
}

/** Each part's heading, with the customer's first name. */
export function sectionTitle(section: BriefSection, first: string): string {
  switch (section) {
    case "wants":
      return `What ${first} wants`;
    case "asked":
      return `What ${first} asked`;
    case "open":
      return "Still open";
    case "mind":
      return `On ${first}'s mind`;
    case "next":
      return "A next step to offer";
  }
}

/** Every quote behind the note, once each, oldest first, with the part it supports: "See Aisha's own words". */
export function quotesOf(b: CallBrief): (BriefQuote & { section: BriefSection })[] {
  const out: (BriefQuote & { section: BriefSection })[] = [];
  const seen = new Set<string>();
  for (const section of BRIEF_SECTIONS) {
    for (const line of b[section]) {
      for (const q of line.quotes) {
        const key = `${q.by}:${normaliseForMatch(q.quote)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...q, section });
      }
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** The row on Today (A-268): what time, and that the note is there. */
export function callRowSub(time: string): string {
  return `Your call is at ${time}. What to talk about is ready.`;
}

/**
 * Today's row for a booked call (A-283): the time sits on the right of the row, like a calendar, so the sentence
 * doesn't repeat it. A call starting within the hour says so.
 */
export function callRowWords(soon: boolean): string {
  return soon ? "Starting soon. What to talk about is ready." : "What to talk about is ready.";
}

/** A call that starts within the next hour (or has started and isn't over): it goes to the top of Then (A-283). */
export const SOON_MINUTES = 60;
export function callIsSoon(scheduledAt: Date, now: Date, minutes = SOON_MINUTES): boolean {
  return scheduledAt.getTime() - now.getTime() <= minutes * 60_000;
}

/**
 * Is the call still to come, or under way? The note shows on Today from the start of the call's day (the caller
 * picks today's bookings) until the call has ended; after that the row asks how it went (A-263).
 */
export function callNotOver(scheduledAt: Date, durationMinutes: number, now: Date): boolean {
  return scheduledAt.getTime() + Math.max(durationMinutes, 1) * 60_000 > now.getTime();
}

/** The phone buzz shortly before a call (A-268): its title and line. */
export const CALL_SOON_MINUTES = 30;

/** The note by email, to the owner only, an hour before a call (A-268; founder, 2026-10-16: "yes its fine"). */
export const CALL_NOTE_MINUTES = 60;

/** Due: the call starts within the next hour and hasn't started yet. */
export function callNoteDue(scheduledAt: Date, now: Date): boolean {
  const until = scheduledAt.getTime() - now.getTime();
  return until > 0 && until <= CALL_NOTE_MINUTES * 60_000;
}

/** The note as parts to read in an email or anywhere outside the app: each part's heading and its lines. */
export function briefParts(b: CallBrief, first: string): { label: string; lines: string[] }[] {
  return BRIEF_SECTIONS.filter((s) => b[s].length > 0).map((s) => ({ label: sectionTitle(s, first), lines: b[s].map((l) => l.text) }));
}

/** Due: the call starts within the next half hour and hasn't started yet. */
export function callSoonDue(scheduledAt: Date, now: Date): boolean {
  const until = scheduledAt.getTime() - now.getTime();
  return until > 0 && until <= CALL_SOON_MINUTES * 60_000;
}
