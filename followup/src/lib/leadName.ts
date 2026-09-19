/**
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
