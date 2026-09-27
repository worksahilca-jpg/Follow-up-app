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

/** Matches the blank however the model cased or spaced it: [PRICE], [ price ], [Price]. */
const SLOT_RE = /\[\s*price\s*\]/gi;

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
  const squash = (t: string) => t.replace(/\s+/g, " ").trim();
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = splitAtPriceSlot(squash(draft));
  if (parts.length < 2) return false;
  const pattern = new RegExp(`^${parts.map(escape).join("(.+?)")}$`);
  const m = squash(sent).match(pattern);
  return Boolean(m) && m!.slice(1).every((fill) => !hasPriceSlot(fill));
}

