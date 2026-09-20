/**
 * Names FollowUp must never put in front of a customer.
 *
 * Both halves of one rule: how to address a LEAD when FollowUp may not
 * know who they are, and what to call the BUSINESS when the owner has
 * not named it yet. Each half shipped its own production incident —
 * "Hi! Instagram," on 2026-09-19 and "Thank you for contacting My
 * Business" on 2026-09-20 — and they live together so the next
 * placeholder has an obvious home rather than a second module.
 *
 * How to address a lead, when FollowUp may not know who they are.
 *
 * A zero-dependency leaf module on purpose, the same reason
 * src/lib/instagramId.ts is one: both the acknowledgement
 * (src/lib/acknowledge.ts) and the automation's hold notes
 * (src/lib/automation.ts) need this, and neither should have to import
 * the other's dependency tree to get it.
 *
 * The case behind it, 2026-09-19: the first real Instagram lead was
 * answered with "Hi! Instagram, I'll check on the availability for you
 * shortly." The greeting took the first word of Lead.name, and Lead.name
 * was findOrCreateLeadByInstagram's placeholder "Instagram DM". A
 * prospect reading that sees a business whose software is broken, which
 * is the exact opposite of what a first touch is for.
 */

/**
 * The names a lead is given when nobody knows who they are yet — labels
 * for a row, never a person's name. Lowercased for comparison.
 */
const PLACEHOLDER_LEAD_NAMES = new Set([
  "instagram dm",
  "instagram",
  "messenger dm",
  "messenger",
  "facebook",
  "whatsapp",
  "whatsapp lead",
  "sms lead",
  "unknown",
  "lead",
]);

/**
 * The name to greet this lead by, or "" when there isn't one. Callers
 * must treat "" as "do not use a name" — writing a sentence around it
 * ("Hi! , ...") or substituting the placeholder back in defeats the
 * point.
 *
 * An Instagram or Messenger handle ("@sahildoes") IS a real way to
 * address someone on those channels, so the "@" is dropped and the
 * handle kept.
 */
export function greetingFirstName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || PLACEHOLDER_LEAD_NAMES.has(trimmed.toLowerCase())) return "";
  const first = trimmed.split(/\s+/)[0];
  return first.startsWith("@") ? first.slice(1) : first;
}

/**
 * The same problem from the other side: the BUSINESS's own placeholder.
 *
 * Found in production 2026-09-20 — four messages went to real people
 * saying "Thank you for contacting My Business." That string comes from
 * src/lib/auth.ts, which names a brand-new workspace `"<their name>'s
 * Business"` or, when Google hands over no name at all, the literal
 * "My Business". It is a row label waiting to be replaced in Settings,
 * and on the founder's own account it never was.
 *
 * A lead who reads "Thank you for contacting My Business" learns one
 * thing: nobody is home. It is the same failure as "Hi! Instagram," and
 * it lives here beside it because the rule is one rule — **a placeholder
 * identity never reaches a customer** — and two modules enforcing half
 * of it each is how the second half gets forgotten.
 *
 * Returns "" for a placeholder. Callers must treat "" as "write the
 * sentence without a name", never as something to interpolate into a
 * gap ("Thank you for contacting .").
 */
const PLACEHOLDER_BUSINESS_NAMES = new Set(["my business", "us", "business", "untitled", "unnamed"]);

export function businessDisplayName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || PLACEHOLDER_BUSINESS_NAMES.has(trimmed.toLowerCase())) return "";
  return trimmed;
}
