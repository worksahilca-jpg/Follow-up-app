import type { Message } from "@/lib/types";

/**
 * Where does this customer stand? Qualifying a realtor's customer (A-246,
 * approved 2026-10-14; research/product/2026-10-14-how-big-players-qualify.md).
 *
 * The founder asked for "a proven system" built on what the big players do.
 * None of them publishes a script, but they all check the same things:
 * when first (Zillow sorts every lead on it), money only for people moving
 * soon, already with an agent (Structurely, LPMAMA), and for a seller why,
 * condition and price (REsimpli, Opendoor). So FollowUp asks in three short
 * rounds of at most two questions, joined into one natural sentence, and
 * then sorts the customer:
 *
 *  - Ready: moving within about 3 months with the money sorted (a seller:
 *    within about 3 months, with a reason). The owner's phone buzzes.
 *  - Warm: 3 to 6 months away, or the money isn't sorted yet.
 *  - Later: 6+ months away, or just looking. No money questions, no push.
 *  - Has an agent: FollowUp stops following up and tells the owner.
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
 *  - the sorting is fixed rules over a few labels the reader picks
 *    (`bucket`: "soon", "sorted", "has" ...), never a model's verdict;
 *  - each thing is asked about once.
 *
 * One template per line of work. Real estate first and only, on purpose —
 * the same choice as tradePlaybooks.ts: the testers are realtors, and one
 * trade measured beats six done thinly. Every other business gets no
 * checklist, which is exactly what every lead had before this file.
 */

export type CriterionKey =
  | "side"
  // buying or renting
  | "area"
  | "timing"
  | "financing"
  | "budget"
  | "kind"
  | "agent"
  | "viewing"
  // selling
  | "home"
  | "why"
  | "condition"
  | "price"
  | "visit";

/** Which way the customer is going. "both" (selling one home and buying another) follows the seller's rounds. */
export type Side = "buy" | "rent" | "sell" | "both";

/** Where the customer stands. Absent while FollowUp is still finding out. */
export type Tier = "ready" | "warm" | "later" | "agent";

export type Criterion = {
  key: CriterionKey;
  /** What the owner sees on the card. */
  label: string;
  /** What counts as known, for the reader that fills the checklist. */
  find: string;
  /** What a reply may ask about, for the reply writer. */
  ask: string;
  /**
   * For the few items FollowUp sorts on: the labels the reader must pick
   * one of, and what each means. An item that needs one and arrives
   * without a valid one is still shown, but sorts nothing.
   */
  buckets?: Readonly<Record<string, string>>;
};

export type QualItem = {
  key: CriterionKey;
  /** A short summary for the owner, e.g. "Pre-approved to $650k". */
  value: string;
  /** The customer's own words, copied exactly. Empty only when `source` is "booking". */
  quote: string;
  /** "booking": known from a confirmed booking made through the booking link, not from words. */
  source?: "booking";
  /** The reader's label for sorting ("soon", "sorted", "has" ...), one of the criterion's buckets. */
  bucket?: string;
};

export type Qualification = {
  v: 2;
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
  /**
   * Where they stand, judged when the customer last wrote — before that
   * reply's own questions were marked as asked, so a question only counts
   * as asked once the customer has had the chance to answer it.
   */
  tier?: Tier;
  /** The owner pressed "Keep following up anyway" on a customer who has an agent. */
  keepGoing?: boolean;
};

export type Template = {
  id: string;
  criteria: Criterion[];
  /** The rounds, in asking order: each round is at most two things, asked in one sentence. */
  rounds: Readonly<Record<"buy" | "rent" | "sell", readonly (readonly CriterionKey[])[]>>;
};

const TIMING_BUCKETS = {
  soon: "within about 3 months of today, including 'as soon as possible', 'this month' or a lease ending within 3 months",
  months: "about 3 to 6 months from today",
  later:
    "more than 6 months from today, no plans yet, 'not for a while', or only looking or browsing for now",
} as const;

/**
 * The asking order inside each round is the order a good agent would take
 * it: what and when first (nothing sensible can be asked before that), then
 * money, then the next step. The keys not in any round are read whenever
 * the customer mentions them, but never asked.
 */
const REALTOR: Criterion[] = [
  {
    key: "side",
    label: "Looking to",
    find:
      "whether they want to buy a home, rent one, or sell a home they own. Asking about a listing for sale, or about finding a home to buy, is buying; asking about a rental is renting; asking what their own home is worth, or about listing it, is selling",
    ask: "whether they are looking to buy, sell, or both",
    buckets: {
      buy: "they want to buy a home",
      rent: "they want to rent a home",
      sell: "they want to sell a home they own, and nothing about buying",
      both: "they want to sell a home they own and also buy another",
    },
  },
  {
    key: "area",
    label: "Area",
    // Something specific (accuracy test 2026-10-12: "do you have any
    // listings?" came back as known, which tells the agent nothing).
    find:
      "the area, neighbourhood or city they want to live in, or the specific listing they asked about, e.g. 'near Liberty Village', 'Mississauga' or '220 King St unit 4'. 'Do you have any listings?' on its own is not this",
    ask: "which area they are looking in",
  },
  {
    key: "timing",
    label: "When",
    // Not a viewing time (accuracy test 2026-10-12: "Can we come see 31 Elm
    // tomorrow at 5pm?" came back as moving "Tomorrow").
    find:
      "when they want to move, buy or sell: a month, a season, a date, a deadline such as a lease ending, or that they are only looking for now. A day or time to SEE a home is a viewing, not this: asking to visit tomorrow says nothing about when they move",
    ask: "roughly when they are hoping to move",
    buckets: TIMING_BUCKETS,
  },
  {
    key: "financing",
    label: "Money",
    find:
      "whether they are pre-approved for a mortgage or paying cash, or that they are not pre-approved yet. Known only when they said so: a price range alone says nothing about this",
    ask: "whether they have been pre-approved yet (or are buying with cash)",
    buckets: {
      sorted: "pre-approved, approved for a mortgage, or paying cash",
      not_yet: "not pre-approved yet, still talking to the bank, or still working out a mortgage",
    },
  },
  {
    key: "budget",
    label: "Price range",
    // A number or it isn't a budget (accuracy test 2026-10-12: "way above
    // what we can spend" came back as a budget).
    find:
      "the price they want to stay under or the range they mentioned, the amount they are pre-approved for, or the monthly rent they can pay. It needs an amount: 'too expensive' or 'out of our budget' with no number is not this",
    ask: "what price range to keep an eye on",
  },
  {
    key: "kind",
    label: "Wants",
    find: "the kind of home they want: a type, a size or a number of bedrooms, e.g. '2-bed condo' or 'detached with a yard'",
    ask: "what kind of place they are after",
  },
  {
    key: "agent",
    label: "Agent",
    find: "whether they are already working with another real estate agent, or said they are not",
    ask: "whether they are working with an agent yet",
    buckets: {
      has: "they are already working with, or signed with, another agent",
      none: "they said they are not working with an agent",
    },
  },
  {
    key: "viewing",
    label: "Viewing",
    find:
      "a specific day or time they agreed to, or proposed, for seeing a property. Known only when THEY said yes to a time or named one; an offer of times that they have not answered is not a viewing",
    // "Weekday or weekend?" is still picking for them, and it is the exact
    // question a real lead answered with "What do you mean" (2026-09-20).
    ask: "whether they would like to see the home, as an open question; never suggest a day, a time, or weekday versus weekend yourself",
  },
  {
    key: "home",
    label: "Home",
    find: "the address, or the specific property, they want to sell",
    ask: "the address of the home they want to sell",
  },
  {
    key: "why",
    label: "Why",
    find: "why they are selling: moving for work or family, downsizing, buying another home, a change in their life",
    ask: "the reason for the move",
  },
  {
    key: "condition",
    label: "Condition",
    find: "what shape their home is in: updates, renovations, repairs it needs, or that it is original",
    ask: "what shape the home is in",
  },
  {
    key: "price",
    label: "Price in mind",
    find: "the price they hope to sell for or a number they have in mind. It needs an amount",
    ask: "whether they have a price in mind, and offer to come by and give them a real number",
  },
  {
    key: "visit",
    label: "Home visit",
    find:
      "a specific day or time they agreed to, or proposed, for the business to come and see their home or meet about selling it. Known only when THEY said yes to a time or named one",
    ask: "whether they would like you to come by and give them a real number, as an open question; never suggest a day or time yourself",
  },
];

const KEYS: readonly CriterionKey[] = REALTOR.map((c) => c.key);
const isKey = (k: unknown): k is CriterionKey => typeof k === "string" && (KEYS as readonly string[]).includes(k);

const TEMPLATES: Record<string, Template> = {
  "Real estate": {
    id: "realtor",
    criteria: REALTOR,
    rounds: {
      buy: [["area", "timing"], ["financing", "budget"], ["agent", "viewing"]],
      rent: [["area", "timing"], ["budget"], ["agent", "viewing"]],
      sell: [["home", "timing"], ["why", "condition"], ["price", "visit"]],
    },
  },
};

/** The checklist for this line of work, or null when there is none. */
export function templateFor(industry: string | null | undefined): Template | null {
  return industry ? TEMPLATES[industry.trim()] ?? null : null;
}

/** The checklist a stored qualification was filled against, or null. */
export function templateById(id: string): Template | null {
  return Object.values(TEMPLATES).find((t) => t.id === id) ?? null;
}

export function criterionOf(template: Template, key: CriterionKey): Criterion | null {
  return template.criteria.find((c) => c.key === key) ?? null;
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

/** What the reader proposed for one item. `bucket` is "" when the item has none. */
export type ExtractedItem = { key: CriterionKey; known: boolean; value: string; quote: string; bucket?: string };

/** The v1 checklist (2026-10-09 to 2026-10-14) called the area "want"; the rest kept its name. */
const V1_KEYS: Readonly<Record<string, CriterionKey>> = { want: "area", timing: "timing", budget: "budget", viewing: "viewing" };

/**
 * A stored checklist, read defensively: anything that isn't the shape is
 * treated as empty. A v1 checklist reads as v2 without its sorting labels,
 * so what was learned before A-246 still shows, and sorting starts the
 * next time the customer writes.
 */
export function readQualification(value: unknown): Qualification | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { v?: unknown; template?: unknown; items?: unknown; offered?: unknown; tier?: unknown; keepGoing?: unknown };
  if ((v.v !== 1 && v.v !== 2) || typeof v.template !== "string" || !Array.isArray(v.items)) return null;
  const legacy = v.v === 1;
  const keyOf = (k: unknown): CriterionKey | null => (legacy ? (typeof k === "string" ? V1_KEYS[k] ?? null : null) : isKey(k) ? k : null);
  const items: QualItem[] = [];
  for (const it of v.items) {
    if (!it || typeof it !== "object") continue;
    const i = it as Record<string, unknown>;
    const key = keyOf(i.key);
    if (!key || typeof i.value !== "string" || typeof i.quote !== "string") continue;
    if (items.some((x) => x.key === key)) continue;
    items.push({
      key,
      value: i.value,
      quote: i.quote,
      ...(i.source === "booking" ? { source: "booking" as const } : {}),
      ...(!legacy && typeof i.bucket === "string" && i.bucket ? { bucket: i.bucket } : {}),
    });
  }
  const offered = Array.isArray(v.offered) ? [...new Set(v.offered.map(keyOf).filter((k): k is CriterionKey => k !== null))] : [];
  const tier = !legacy && (v.tier === "ready" || v.tier === "warm" || v.tier === "later" || v.tier === "agent") ? v.tier : undefined;
  return {
    v: 2,
    template: v.template,
    items,
    ...(offered.length ? { offered } : {}),
    ...(tier ? { tier } : {}),
    ...(!legacy && v.keepGoing === true ? { keepGoing: true } : {}),
  };
}

const itemOf = (q: Qualification | null, key: CriterionKey) => q?.items.find((i) => i.key === key) ?? null;
const bucketOf = (q: Qualification | null, key: CriterionKey) => itemOf(q, key)?.bucket ?? null;
const knows = (q: Qualification | null, key: CriterionKey) => itemOf(q, key) !== null;
const asked = (q: Qualification | null, key: CriterionKey) => Boolean(q?.offered?.includes(key));

/** Which way they are going, or null when FollowUp doesn't know yet. */
export function sideOf(q: Qualification | null): Side | null {
  const b = bucketOf(q, "side");
  return b === "buy" || b === "rent" || b === "sell" || b === "both" ? b : null;
}

/** Selling (alone or with buying) follows the seller's rounds. */
export function isSeller(q: Qualification | null): boolean {
  const s = sideOf(q);
  return s === "sell" || s === "both";
}

/**
 * The rounds for this customer. A buyer moving 6+ months out is asked what
 * kind of home instead of about money, and nothing after it: nobody that
 * far out wants to be asked about agents and viewings (Ylopo: it doesn't
 * push for a meeting; Zillow nurtures them instead).
 */
export function roundsFor(template: Template, q: Qualification | null): CriterionKey[][] {
  const side = sideOf(q);
  if (side === "sell" || side === "both") return template.rounds.sell.map((r) => [...r]);
  const rounds = (side === "rent" ? template.rounds.rent : template.rounds.buy).map((r) => [...r]);
  if (bucketOf(q, "timing") === "later") return [rounds[0], ["kind"]];
  return rounds;
}

/**
 * Where the customer stands, by fixed rules (A-246). Null while FollowUp
 * is still finding out. `offered` counts only questions asked before the
 * customer's latest message (see Qualification.tier).
 */
export function tierOf(template: Template, q: Qualification | null): Tier | null {
  if (!q || q.template !== template.id) return null;
  if (bucketOf(q, "agent") === "has" && !q.keepGoing) return "agent";
  const timing = bucketOf(q, "timing");
  if (timing === "later") return "later";
  if (timing === "months") return "warm";
  if (timing !== "soon") return null;
  if (isSeller(q)) return knows(q, "why") ? "ready" : asked(q, "why") ? "warm" : null;
  if (sideOf(q) === "rent") {
    if (!knows(q, "budget")) return asked(q, "budget") ? "warm" : null;
  } else {
    const money = bucketOf(q, "financing");
    if (money === "not_yet") return "warm";
    if (money !== "sorted") return asked(q, "financing") ? "warm" : null;
  }
  // Moving soon with the money sorted: ready once the agent question has
  // been answered, or asked and passed over. Before it, an owner could be
  // buzzed about someone who already has an agent.
  return knows(q, "agent") || asked(q, "agent") ? "ready" : null;
}

/**
 * The new checklist: what the reader found now, checked against the
 * customer's own words, laid over what was already known, then sorted.
 *
 * - A new item counts only with a real quote and a short value. A sorting
 *   label counts only when it is one of the item's own.
 * - Something already known stays known when the reader misses it this
 *   time (a long thread, a model having an off moment). Knowledge is only
 *   replaced by better-evidenced knowledge, never by silence.
 * - A confirmed booking made through the booking link IS the next step,
 *   whatever was said before it: it wins over words about a viewing (or,
 *   for a seller, the home visit).
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
    const e = found.get(c.key);
    const value = e?.value.trim().slice(0, MAX_VALUE) ?? "";
    if (e?.known && value && isCustomerQuote(e.quote, texts)) {
      const bucket = c.buckets && e.bucket && Object.hasOwn(c.buckets, e.bucket) ? e.bucket : undefined;
      items.push({ key: c.key, value, quote: e.quote.trim(), ...(bucket ? { bucket } : {}) });
      continue;
    }
    const before = prev.get(c.key);
    if (before) items.push(before);
  }
  const merged: Qualification = {
    v: 2,
    template: template.id,
    items,
    ...(same?.offered?.length ? { offered: same.offered } : {}),
    ...(same?.keepGoing ? { keepGoing: true } : {}),
  };
  if (booking) {
    const key: CriterionKey = isSeller(merged) ? "visit" : "viewing";
    merged.items = [
      ...merged.items.filter((i) => i.key !== key),
      { key, value: `Booked call, ${booking}`, quote: "", source: "booking" },
    ];
  }
  const tier = tierOf(template, merged);
  return tier ? { ...merged, tier } : merged;
}

/** Ready to hand over: the owner's phone buzzes once (Lead.qualifiedAt). */
export function isReady(template: Template, q: Qualification | null): boolean {
  return Boolean(q && q.template === template.id && q.tier === "ready");
}

/**
 * What the next reply may ask about: the first round with something
 * neither known nor asked, and only those things (one or two). Nothing once
 * the customer has an agent or is a long way off and has been asked what
 * they're after. A customer whose side isn't clear is asked that first.
 */
export function nextToAsk(template: Template, q: Qualification | null): Criterion[] {
  const same = q && q.template === template.id ? q : null;
  if (same?.tier === "agent") return [];
  const open = (k: CriterionKey) => !knows(same, k) && !asked(same, k);
  if (!sideOf(same) && open("side") && !knows(same, "area") && !knows(same, "home")) {
    return [criterionOf(template, "side")!];
  }
  for (const round of roundsFor(template, same)) {
    const missing = round.filter(open);
    if (missing.length) return missing.map((k) => criterionOf(template, k)!);
  }
  return [];
}

/** The checklist with `keys` marked as asked about. */
export function markOffered(q: Qualification, ...keys: CriterionKey[]): Qualification {
  const offered = q.offered ?? [];
  const add = keys.filter((k) => !offered.includes(k));
  return add.length ? { ...q, offered: [...offered, ...add] } : q;
}

/** The things to ask, as one thing for the reply writer: "which area they are looking in, and roughly when ...". */
export function askFor(criteria: readonly Criterion[]): Pick<Criterion, "ask"> | null {
  if (criteria.length === 0) return null;
  return { ask: criteria.map((c) => c.ask).join(", and ") };
}

/**
 * The paragraph the reply writer gets about what to learn next.
 *
 * Written against the rule it relaxes. The drafting prompt forbids "a
 * qualifying question about a detail the lead has not raised" because of a
 * real failure — "Will this be for a weekday or weekend?" in answer to "is
 * this still available?", about a post FollowUp couldn't see. That rule
 * still stands for everything else; this opens exactly these topics, only
 * after their questions are answered, only when what they're asking about
 * is clear. Two things go in ONE sentence with one question mark (A-246:
 * "at most two questions, joined into one natural sentence"), which is also
 * the shape a DM may take (src/lib/dmDrafts.ts).
 */
export function qualifyPromptBlock(next: Pick<Criterion, "ask"> | null): string {
  if (!next) return "";
  return (
    "\n\nWHAT TO LEARN NEXT. This business finds out a few things from each customer before handing them to the " +
    "owner, a little at a time and only in the natural course of the conversation. After you have fully answered " +
    `everything they asked, you may end with one short, friendly sentence asking about ${next.ask}. When that is ` +
    "two things, ask them together in that one sentence with a single question mark (for example \"Which area are " +
    "you looking in, and roughly when are you hoping to move?\"), never as a list and never as two questions. Frame " +
    "it as helping them, never as screening them, and never say you are qualifying them. Ask it only when the " +
    "conversation already makes clear what they are enquiring about; if it does not, ask what they mean instead. If " +
    "your reply already needs a different question to answer them properly, ask that one and leave this for a " +
    "later message. Never more than one question sentence in total. This is the only exception to the rule about " +
    "not asking qualifying questions on details they have not raised, and it covers these topics only."
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

const valueOf = (q: Qualification, key: CriterionKey) => itemOf(q, key)?.value.trim().replace(/[.;,]+$/, "") || null;

/**
 * The one line the owner reads on the card and in the alert, built from
 * the summaries, never from the raw quotes (those are one tap away). The
 * strongest reasons first. A buyer: money, then when, then where, then
 * "no agent" — "Pre-approved up to $900k · Moving in about 2 months ·
 * Mississauga · No agent yet". A seller: when, why, price, condition.
 * Separated rather than run into a sentence, because each summary starts
 * with its own capital and some start with a place name.
 */
export function readyWhy(q: Qualification): string {
  const parts: (string | null)[] = isSeller(q)
    ? [valueOf(q, "timing"), valueOf(q, "why"), valueOf(q, "price"), valueOf(q, "condition")]
    : [
        valueOf(q, "financing"),
        // "Pre-approved up to $900k" already says the range.
        /\d/.test(valueOf(q, "financing") ?? "") ? null : valueOf(q, "budget"),
        valueOf(q, "timing"),
        valueOf(q, "area"),
        bucketOf(q, "agent") === "none" ? valueOf(q, "agent") : null,
      ];
  return parts.filter((v): v is string => Boolean(v)).join(" · ");
}

/** The viewing (a seller: the home visit) summary, or null when there isn't one. */
export function viewingOf(q: Qualification | null): string | null {
  return itemOf(q, isSeller(q) ? "visit" : "viewing")?.value ?? null;
}

/** The home a seller wants to sell, or null. */
export function homeOf(q: Qualification | null): string | null {
  return isSeller(q) ? itemOf(q, "home")?.value ?? null : null;
}

/**
 * The items worth showing the owner for this customer, in the order they
 * matter: the side's rounds, then anything else they happened to say. The
 * side itself is not shown; the card's sentence already says it.
 */
export function shownItems(template: Template, q: Qualification): { criterion: Criterion; item: QualItem }[] {
  const order = [...new Set([...roundsFor(template, q).flat(), ...template.criteria.map((c) => c.key)])].filter((k) => k !== "side");
  return order.flatMap((k) => {
    const item = itemOf(q, k);
    const criterion = criterionOf(template, k);
    return item && criterion ? [{ criterion, item }] : [];
  });
}

/** What is still to find out for this customer, in asking order (for "Still to find out: ..."). */
export function stillToLearn(template: Template, q: Qualification | null): Criterion[] {
  return roundsFor(template, q)
    .flat()
    .filter((k) => !knows(q, k))
    .map((k) => criterionOf(template, k)!);
}

/** The three facts the card shows at a glance: a seller's home, when and why; a buyer's area, when and money (or, far off, what they want). */
export function glanceFacts(q: Qualification | null): [string, string | null][] {
  if (isSeller(q)) return [["Home", itemOf(q, "home")?.value ?? null], ["When", itemOf(q, "timing")?.value ?? null], ["Why", itemOf(q, "why")?.value ?? null]];
  const third: [string, string | null] =
    bucketOf(q, "timing") === "later"
      ? ["Wants", itemOf(q, "kind")?.value ?? null]
      : ["Money", itemOf(q, "financing")?.value ?? itemOf(q, "budget")?.value ?? null];
  return [["Area", itemOf(q, "area")?.value ?? null], ["When", itemOf(q, "timing")?.value ?? null], third];
}
