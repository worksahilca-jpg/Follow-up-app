import type { Message } from "@/lib/types";

/**
 * Is this customer ready? The qualification checklist (founder, 2026-10-09:
 * the funnel's steps 4–6 — "qualify accurately… hand the hot lead to the
 * owner"; design brain prototypes/2026-10-09-qualification-card).
 *
 * The owner never fills this in and never sets it up. It is FollowUp's own
 * working notes on one customer:
 *
 *  - each item is filled ONLY from something the customer actually wrote,
 *    and keeps those words as proof. A model can summarise, but the quote
 *    has to be found, character for character, in one of the customer's own
 *    messages, or the item stays unknown. Nothing is guessed (research
 *    2026-10-09-lead-qualification-strategy.md §4: a model's own confidence
 *    is not evidence; a quote is);
 *  - the next reply may ask about the first thing still missing, once, after
 *    answering everything the customer asked;
 *  - when every item is known the customer is ready, and the owner hears
 *    about it once ("Nadia is ready").
 *
 * One template per line of work. Real estate first and only, on purpose —
 * the same choice as tradePlaybooks.ts: the testers are realtors, and one
 * trade measured beats six done thinly. Every other business gets no
 * checklist, which is exactly what every lead had before this file.
 */

export type CriterionKey = "want" | "timing" | "budget" | "viewing";

export type Criterion = {
  key: CriterionKey;
  /** What the owner sees on the card. */
  label: string;
  /** What counts as known, for the reader that fills the checklist. */
  find: string;
  /** What the next reply may ask about, for the reply writer. */
  ask: string;
};

export type QualItem = {
  key: CriterionKey;
  /** A short summary for the owner, e.g. "Pre-approved to $650k". */
  value: string;
  /** The customer's own words, copied exactly. Empty only when `source` is "booking". */
  quote: string;
  /** "booking": known from a confirmed booking made through the booking link, not from words. */
  source?: "booking";
};

export type Qualification = {
  v: 1;
  template: string;
  items: QualItem[];
  /**
   * What a reply has already been allowed to ask about. Each thing is asked
   * once: a customer who didn't answer it the first time is not asked again,
   * and the next reply moves on to the next thing instead — or asks nothing,
   * once everything has had its turn. Asking for a budget twice is how an
   * assistant starts to sound like a form.
   */
  offered?: CriterionKey[];
};

export type Template = { id: string; criteria: Criterion[] };

/**
 * The order is the order the reply writer asks in: what they want first
 * (you cannot ask anything sensible before you know what they're after),
 * then when, then budget, then the viewing — the order an agent would take
 * it in a conversation, softest question first.
 */
const REALTOR: Criterion[] = [
  {
    key: "want",
    label: "What they want",
    find: "the home, listing or area they are asking about, e.g. 'the 2-bed on King Street' or '3 bedrooms near a school'",
    ask: "what kind of home, or which area, they are looking for",
  },
  {
    key: "timing",
    label: "When",
    find: "when they want to move or buy: a month, a season, a date, or a deadline such as a lease ending",
    ask: "when they are hoping to move",
  },
  {
    key: "budget",
    label: "Budget",
    find: "the price they want to stay under or the range they mentioned, or the amount they are pre-approved for",
    ask: "the price range they have in mind, or whether they are already pre-approved, framed as helping you send them the right homes",
  },
  {
    key: "viewing",
    label: "Viewing",
    find:
      "a specific day or time they agreed to, or proposed, for seeing a property. Known only when THEY said yes to a time or named one; an offer of times that they have not answered is not a viewing",
    ask: "whether they would like to see it, asking which days suit them; never pick a day or time yourself",
  },
];

const KEYS: readonly CriterionKey[] = ["want", "timing", "budget", "viewing"];
const isKey = (k: unknown): k is CriterionKey => typeof k === "string" && (KEYS as readonly string[]).includes(k);

const TEMPLATES: Record<string, Template> = {
  "Real estate": { id: "realtor", criteria: REALTOR },
};

/** The checklist for this line of work, or null when there is none. */
export function templateFor(industry: string | null | undefined): Template | null {
  return industry ? TEMPLATES[industry.trim()] ?? null : null;
}

/** The checklist a stored qualification was filled against, or null. */
export function templateById(id: string): Template | null {
  return Object.values(TEMPLATES).find((t) => t.id === id) ?? null;
}

/** Longest a stored summary or quote may be; anything longer is not a short fact. */
export const MAX_VALUE = 80;
export const MAX_QUOTE = 200;

/**
 * Text compared the forgiving way a person would: case, runs of whitespace
 * and curly-vs-straight quotes don't matter; every other character does.
 */
export function normaliseForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Is `quote` really something the customer wrote? It has to appear, as is,
 * inside one of their own messages. Three characters at least, so a stray
 * "ok" can't stand in as proof of anything.
 */
export function isCustomerQuote(quote: string, customerTexts: readonly string[]): boolean {
  const q = normaliseForMatch(quote);
  if (q.length < 3 || q.length > MAX_QUOTE) return false;
  return customerTexts.some((t) => normaliseForMatch(t).includes(q));
}

/** Everything the customer wrote, oldest first. */
export function customerTexts(conversation: readonly Message[]): string[] {
  return conversation.filter((m) => m.direction === "inbound" && m.body.trim()).map((m) => m.body);
}

/** What the reader proposed for one item. */
export type ExtractedItem = { key: CriterionKey; known: boolean; value: string; quote: string };

/** A stored checklist, read defensively: anything that isn't the shape is treated as empty. */
export function readQualification(value: unknown): Qualification | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { v?: unknown; template?: unknown; items?: unknown; offered?: unknown };
  if (v.v !== 1 || typeof v.template !== "string" || !Array.isArray(v.items)) return null;
  const items: QualItem[] = [];
  for (const it of v.items) {
    if (!it || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    if (!isKey(i.key) || typeof i.value !== "string" || typeof i.quote !== "string") continue;
    items.push({ key: i.key, value: i.value, quote: i.quote, ...(i.source === "booking" ? { source: "booking" as const } : {}) });
  }
  const offered = Array.isArray(v.offered) ? v.offered.filter(isKey) : [];
  return { v: 1, template: v.template, items, ...(offered.length ? { offered } : {}) };
}

/**
 * The new checklist: what the reader found now, checked against the
 * customer's own words, laid over what was already known.
 *
 * - A new item counts only with a real quote and a short value.
 * - Something already known stays known when the reader misses it this
 *   time (a long thread, a model having an off moment). Knowledge is only
 *   replaced by better-evidenced knowledge, never by silence.
 * - A confirmed booking made through the booking link IS the next step,
 *   whatever was said before it: it wins over words about a viewing.
 */
export function mergeQualification(
  template: Template,
  previous: Qualification | null,
  extracted: readonly ExtractedItem[] | null,
  texts: readonly string[],
  booking: string | null = null
): Qualification {
  const same = previous?.template === template.id ? previous : null;
  const prev = new Map((same?.items ?? []).map((i) => [i.key, i]));
  const found = new Map((extracted ?? []).map((e) => [e.key, e]));
  const items: QualItem[] = [];
  for (const c of template.criteria) {
    if (c.key === "viewing" && booking) {
      items.push({ key: "viewing", value: `Booked call, ${booking}`, quote: "", source: "booking" });
      continue;
    }
    const e = found.get(c.key);
    const value = e?.value.trim().slice(0, MAX_VALUE) ?? "";
    if (e?.known && value && isCustomerQuote(e.quote, texts)) {
      items.push({ key: c.key, value, quote: e.quote.trim() });
      continue;
    }
    const before = prev.get(c.key);
    if (before) items.push(before);
  }
  return { v: 1, template: template.id, items, ...(same?.offered?.length ? { offered: same.offered } : {}) };
}

/** Every item known: the customer is ready to hand over. */
export function isReady(template: Template, q: Qualification | null): boolean {
  if (!q || q.template !== template.id) return false;
  const known = new Set(q.items.map((i) => i.key));
  return template.criteria.every((c) => known.has(c.key));
}

/**
 * The first thing still missing that hasn't been asked about yet, in
 * asking order, or null when there is nothing left to ask.
 */
export function nextToAsk(template: Template, q: Qualification | null): Criterion | null {
  const same = q && q.template === template.id ? q : null;
  const skip = new Set<CriterionKey>([...(same?.items.map((i) => i.key) ?? []), ...(same?.offered ?? [])]);
  return template.criteria.find((c) => !skip.has(c.key)) ?? null;
}

/** The checklist with `key` marked as asked about. */
export function markOffered(q: Qualification, key: CriterionKey): Qualification {
  const offered = q.offered ?? [];
  return offered.includes(key) ? q : { ...q, offered: [...offered, key] };
}

/**
 * The paragraph the reply writer gets about the next missing item.
 *
 * Written against the rule it relaxes. The drafting prompt forbids "a
 * qualifying question about a detail the lead has not raised" because of a
 * real failure — "Will this be for a weekday or weekend?" in answer to "is
 * this still available?", about a post FollowUp couldn't see. That rule
 * still stands for everything else; this opens exactly one topic, only
 * after their questions are answered, only when what they're asking about
 * is clear, and never as a second question.
 */
export function qualifyPromptBlock(next: Criterion | null): string {
  if (!next) return "";
  return (
    "\n\nONE THING TO LEARN NEXT. This business finds out a few things from each customer before handing them to " +
    "the owner, one at a time and only in the natural course of the conversation. After you have fully answered " +
    `everything they asked, you may end with one short, friendly question about ${next.ask}. Frame it as helping ` +
    "them, never as screening them. Ask it only when the conversation already makes clear what they are enquiring " +
    "about; if it does not, ask what they mean instead. If your reply already needs a different question to answer " +
    "them properly, ask that one and leave this for a later message. Never ask more than one question in total. " +
    "This is the only exception to the rule about not asking qualifying questions on details they have not raised, " +
    "and it covers this one topic only."
  );
}

/** "Sat, Oct 12, 10:30 AM" in the business's time zone, for a booking made through the booking link. */
export function bookingWhen(at: Date, timeZone: string): string {
  try {
    return at.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return at.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
}

/**
 * The one line the owner reads on the card and in the alert, built from
 * the summaries, never from the raw quotes (those are one tap away). The
 * strongest reasons first — money, then timing, then what they want:
 * "Pre-approved to $650k · Moving in March · 3 bedrooms near a school".
 * Separated rather than run into a sentence, because each summary starts
 * with its own capital and some start with a place name.
 */
const WHY_ORDER: readonly CriterionKey[] = ["budget", "timing", "want"];
export function readyWhy(q: Qualification): string {
  const by = new Map(q.items.map((i) => [i.key, i.value.trim()]));
  return WHY_ORDER.map((k) => by.get(k))
    .filter((v): v is string => Boolean(v))
    .map((v) => v.replace(/[.;,]+$/, ""))
    .join(" · ");
}

/** The viewing summary, or null when there isn't one. */
export function viewingOf(q: Qualification | null): string | null {
  return q?.items.find((i) => i.key === "viewing")?.value ?? null;
}
