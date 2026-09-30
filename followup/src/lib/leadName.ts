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
 *
 * The one list. Anywhere FollowUp creates a lead without a real name, the
 * label it writes belongs here, and anywhere it decides whether a lead
 * HAS a name it asks greetingFirstName / isPlaceholderLeadName rather than
 * keeping its own check. Where each one comes from:
 *
 *   "Instagram DM"         findOrCreateLeadByInstagram, before a handle is
 *                          known (src/lib/instagram.ts)
 *   "Facebook Messenger"   findOrCreateLeadByMessenger, whenever Meta
 *                          refuses the name lookup — every Messenger lead
 *                          before App Review (src/lib/facebook.ts). Missing
 *                          from this list until backlog b010, so drafts
 *                          opened "Hi Facebook,".
 *   "Facebook lead"        upsertLeadFromLeadgen, a Lead Ad with no name,
 *                          email or phone (src/lib/facebook.ts)
 *   "WhatsApp contact"     the WhatsApp history importer's stand-in for a
 *                          contact with no profile name (inbound/whatsappCloud.ts)
 *
 * The rest are the same labels in other words ("Instagram User", "SMS
 * lead"), and the bare channel names, which are also what the FIRST WORD
 * of each label above comes to — the prompt that produced "Hi Facebook,"
 * was reading lead.name.split(" ")[0].
 *
 * SMS and WhatsApp write the phone number itself as the name
 * (findOrCreateLeadByPhone in src/lib/twilio.ts), and a Lead Ad can fall
 * back to an email address. Those are NOT on this list on purpose: the
 * owner reading an alert is better served by "+1415…" than by "A
 * customer". Only customerGreetingName, below, refuses them — a number
 * is useful to the owner and absurd in a greeting to the customer.
 */
const PLACEHOLDER_LEAD_NAMES = new Set([
  "instagram dm",
  "instagram user",
  "instagram",
  "messenger dm",
  "messenger user",
  "messenger",
  "facebook messenger",
  "facebook messenger user",
  "facebook user",
  "facebook lead",
  "facebook",
  "whatsapp contact",
  "whatsapp user",
  "whatsapp lead",
  "whatsapp",
  "sms lead",
  "sms",
  "unknown",
  "lead",
]);

/**
 * Is this one of the labels above (in any casing), or no name at all?
 * False for a real name, an "@handle", a phone number and an email
 * address — see customerGreetingName for the last two.
 */
export function isPlaceholderLeadName(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  return !trimmed || PLACEHOLDER_LEAD_NAMES.has(trimmed.toLowerCase());
}

/**
 * The name to greet this lead by, or "" when there isn't one. Callers
 * must treat "" as "do not use a name" — writing a sentence around it
 * ("Hi! , ...") or substituting the placeholder back in defeats the
 * point.
 *
 * An Instagram or Messenger handle ("@sahildoes") IS a real way to
 * address someone on those channels, so the "@" is dropped and the
 * handle kept.
 *
 * Safe to call on a first name that was already split off a full name
 * (the "Facebook" of "Facebook Messenger" is itself on the list), so a
 * caller handed only a first name can still ask.
 *
 * Owner-facing text (alerts, hold notes) uses this one, so a lead named
 * by their phone number still shows the owner that number. Anything a
 * CUSTOMER reads uses customerGreetingName instead.
 */
export function greetingFirstName(name: string | null | undefined): string {
  if (isPlaceholderLeadName(name)) return "";
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first.startsWith("@") ? first.slice(1) : first;
}

const EMAIL_SHAPED = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The name to put in a greeting a CUSTOMER reads — the drafting and
 * instant-reply prompts' first-name line, the email "Hi …," and the
 * WhatsApp template's name slot — or "" for none.
 *
 * greetingFirstName, plus two stand-ins that are not labels: the phone
 * number SMS and WhatsApp use as the name of a contact with no profile
 * name, and the email address a Lead Ad falls back to. "Hi +14155551234,"
 * is the same failure as "Hi Facebook,". A first word with no letters in
 * it at all (a number, "+1") is never a name, which also catches a number
 * a caller already split on spaces.
 */
export function customerGreetingName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (EMAIL_SHAPED.test(trimmed)) return "";
  const first = greetingFirstName(trimmed);
  if (!first || EMAIL_SHAPED.test(first) || !/\p{L}/u.test(first)) return "";
  return first;
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
