/**
 * "Did this person just ask us to stop?" — one matcher, every channel.
 *
 * This lived in src/lib/twilio.ts while SMS and WhatsApp were the only
 * channels that honoured STOP. It is not a Twilio concept: the same
 * keywords now decide consent on Instagram and Messenger DMs
 * (src/lib/inbound/meta.ts) and gate the instant acknowledgement on all
 * of them (src/lib/acknowledge.ts). A second matcher per channel is how
 * you end up with "stop" working on SMS and not on Instagram, so there
 * is exactly one, here.
 *
 * Zero imports on purpose — the same reason src/lib/instagramId.ts
 * exists. twilio.ts pulls in Prisma and the Twilio REST wrappers; a pure
 * string check that four call sites need must not drag any of that
 * behind it.
 *
 * The keywords are matched as the WHOLE trimmed message body
 * (case-insensitive) — not a substring check, so "please stop texting
 * me" doesn't trip it but "STOP" or "Stop" does. Whole-body matching is
 * what makes this safe to run on a DM, where "stop by the office
 * tomorrow?" is an ordinary sentence.
 *
 * This is the app's OWN record of consent (Lead.optedOutAt for
 * SMS/WhatsApp, the Suppression table for DMs — see the argument in
 * src/lib/suppression.ts). It is deliberately NOT a substitute for
 * Twilio's own Advanced Opt-Out feature (Console → Messaging →
 * Settings), which blocks delivery at the carrier level before it ever
 * reaches our webhook. Enable both: Twilio's for the legal carrier-level
 * guarantee, this for the app's own guarantee that no send path here —
 * manual, automated, or a sequence — can ignore it.
 *
 * "YES" is deliberately excluded from the opt-in set even though some
 * CTIA guidance lists it: outside of a real Twilio Advanced Opt-Out
 * flow, a bare "yes" is far more likely to be a normal reply
 * mid-conversation than an intentional re-subscribe, and silently
 * clearing an opt-out on that would be the wrong failure mode. That
 * reasoning is stronger, not weaker, in a DM.
 */
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
const START_KEYWORDS = new Set(["start", "unstop"]);

export function isOptOutMessage(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

export function isOptInMessage(body: string): boolean {
  return START_KEYWORDS.has(body.trim().toLowerCase());
}
