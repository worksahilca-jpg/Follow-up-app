/**
 * The price blank (design brain A-060, TodayHoldingPhone): when a customer
 * asks what something costs, the draft is written with PRICE_SLOT where the
 * figure goes — "The 3-month package is [PRICE]." — and the owner fills it
 * in on Today. FollowUp never knows the owner's prices, and the drafting
 * rules already forbid inventing one; before this the draft said "I'll
 * confirm the price" and the owner rewrote the whole sentence.
 *
 * Two guarantees hang on this file:
 *  - assessSendRisk holds any draft that has the blank, without asking the
 *    model, so it always comes to the owner (and a price topic gets the
 *    30-minute holding message).
 *  - sendFollowUpToLead refuses any message that still has the blank, on
 *    every path, so an unfilled "[PRICE]" can never reach a customer.
 */
export const PRICE_SLOT = "[PRICE]";

/** Finishes Today's "Held because <reason>." */
export const PRICE_SLOT_REASON = "the reply needs the price from you";

/**
 * The answer blank (A-100, founder 2026-10-07: "FollowUp will be trained
 * according to the business"). The price blank, for any plain question about
 * how the business works that FollowUp has no fact for: "[ANSWER: parking]".
 * The owner fills it on Today, and ticked, it becomes a fact (Settings →
 * What FollowUp knows), so the next customer who asks gets it without asking.
 * Same two guarantees as the price: always held, never sent unfilled.
 */
export const ANSWER_SLOT_REASON = "the reply needs your answer";
export const answerSlotFor = (topic: string) => `[ANSWER: ${topic}]`;

/**
 * Matches either blank however the model cased or spaced it: [PRICE],
 * [ price ], [ANSWER: parking], [answer:pets]. No capture groups: split and
 * replace must not get the topic back as a piece of the text.
 */
const SLOT_RE = /\[\s*(?:price|answer\s*:[^\]\n]{1,40}?)\s*\]/gi;
const ANSWER_RE = /\[\s*answer\s*:\s*([^\]\n]{1,40}?)\s*\]/i;

export type Slot = { kind: "price" } | { kind: "answer"; topic: string };

/** What the first blank in the text asks for, or null when there is none. */
export function slotOf(text: string | null | undefined): Slot | null {
  if (!hasPriceSlot(text)) return null;
  SLOT_RE.lastIndex = 0;
  const first = SLOT_RE.exec(text as string)?.[0] ?? "";
  SLOT_RE.lastIndex = 0;
  const answer = first.match(ANSWER_RE);
  return answer ? { kind: "answer", topic: answer[1].trim().toLowerCase() } : { kind: "price" };
}

/** Today's reason for holding a draft with this blank. */
export function slotReason(slot: Slot): string {
  return slot.kind === "price" ? PRICE_SLOT_REASON : ANSWER_SLOT_REASON;
}

export function hasPriceSlot(text: string | null | undefined): boolean {
  if (!text) return false;
  SLOT_RE.lastIndex = 0;
  return SLOT_RE.test(text);
}

/** The draft with every blank replaced by what the owner typed. */
export function fillPriceSlot(text: string, price: string): string {
  return text.replace(SLOT_RE, price);
}

/**
 * The draft cut at the blanks, for drawing a box in each gap. One blank is
 * what the drafting rule asks for; more than one all take the same figure.
 */
export function splitAtPriceSlot(text: string): string[] {
  return text.split(SLOT_RE);
}

/**
 * True when `sent` is `draft` with only its blanks filled in — so filling
 * the price does not count as editing FollowUp's draft (FollowUp.draftEdited,
 * the "sent without changing a word" figure). Whitespace-insensitive, like
 * that comparison.
 */
export function isFilledDraft(draft: string, sent: string): boolean {
  return fillsOf(draft, sent) !== null;
}

/**
 * What the owner typed into the blank, when `sent` is `draft` with only its
 * blanks filled — "2.5%" — or null. Kept with the sent reply so the
 * learning job (src/lib/businessFacts.ts) knows that figure is the owner's.
 */
export function filledPrice(draft: string, sent: string): string | null {
  if (slotOf(draft)?.kind !== "price") return null;
  return fillsOf(draft, sent)?.[0]?.trim() || null;
}

/** What the owner typed into an answer blank, and what it was about, or null. */
export function filledAnswer(draft: string, sent: string): { topic: string; value: string } | null {
  const slot = slotOf(draft);
  if (slot?.kind !== "answer") return null;
  const value = fillsOf(draft, sent)?.[0]?.trim();
  return value ? { topic: slot.topic, value } : null;
}

function fillsOf(draft: string, sent: string): string[] | null {
  const squash = (t: string) => t.replace(/\s+/g, " ").trim();
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = splitAtPriceSlot(squash(draft));
  if (parts.length < 2) return null;
  const pattern = new RegExp(`^${parts.map(escape).join("(.+?)")}$`);
  const m = squash(sent).match(pattern);
  if (!m || m.slice(1).some((fill) => hasPriceSlot(fill))) return null;
  return m.slice(1);
}

