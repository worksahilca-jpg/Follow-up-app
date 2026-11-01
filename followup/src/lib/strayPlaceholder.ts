/**
 * Template leftovers in a reply: "[Your Name]", "{first_name}", "<insert date>". A writer model sometimes leaves one
 * where it didn't know a detail, and a reply that goes out on its own would reach the customer with it, the clearest
 * sign of a robot there is. Found by plain rules, no AI (Nov 1 2026, accuracy without credit).
 *
 * FollowUp's own two blanks, "[PRICE]" and "[ANSWER: parking]" (src/lib/priceSlot.ts), are not leftovers: they have
 * their own path, where the owner fills them in. Only tokens that name a template field are caught, so a customer's
 * "[sic]" or a heart "<3" is never one.
 */

const FIELD =
  "(?:(?:your|my|the|our|agent'?s?|realtor'?s?|business|company|customer'?s?|client'?s?|lead'?s?|first|last|full|insert|add|enter|specific|preferred|desired)\\s+)*" +
  "(?:name|first\\s+name|last\\s+name|full\\s+name|company(?:\\s+name)?|business(?:\\s+name)?|brokerage(?:\\s+name)?|agent(?:\\s+name)?|" +
  "address|street(?:\\s+address)?|phone(?:\\s+number)?|number|email(?:\\s+address)?|date|time|day|date\\s+and\\s+time|" +
  "link|url|website|calendar\\s+link|booking\\s+link|signature|title|neighbou?rhood|city|area|location|property(?:\\s+address)?|" +
  "listing(?:\\s+address)?|amount|budget|contact\\s+info(?:rmation)?|details?)";

// A written link, "[my website](https://...)", is a real link, not a blank.
const SQUARE = new RegExp(`\\[\\s*${FIELD}\\s*\\](?!\\()`, "i");
const DOUBLE_CURLY = /\{\{\s*[^{}\n]{1,40}?\s*\}\}/;
const CURLY = new RegExp(`\\{\\s*${FIELD.replace(/\\s\+/g, "[_\\s]?")}\\s*\\}`, "i");
const ANGLE = new RegExp(`<\\s*${FIELD}\\s*>`, "i");

/** The first template leftover in the text, as written, or null when there is none. */
export function strayPlaceholder(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const re of [SQUARE, DOUBLE_CURLY, CURLY, ANGLE]) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

/** Why a reply with a leftover waits for the owner, in the words the owner reads. */
export function strayPlaceholderReason(token: string): string {
  return `the reply still says "${token}" where a real detail goes`;
}

const REASON_RE = /^the reply still says "(.+)" where a real detail goes$/;

/** Today's line for that reason (src/lib/holdReasons.ts): what to do, like the price blank's "Add the price, then send." */
export function strayPlaceholderAction(reason: string): string | null {
  const token = REASON_RE.exec(reason)?.[1];
  return token ? `Change "${token}" to the real words, then send.` : null;
}
