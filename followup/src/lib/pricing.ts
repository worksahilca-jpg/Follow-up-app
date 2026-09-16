/**
 * Pure display data for the tier/Voice pricing shown in Settings
 * (research/market/2026-09-11-tier-pricing-recommendation.md). Deliberately
 * has NO imports — @/lib/billing pulls in @/lib/db (the Prisma client),
 * which must never reach a "use client" component's bundle (see the fix
 * for that exact bug, PR for issue #93). The actual Stripe Price IDs these
 * numbers correspond to live in @/lib/stripe, server-only.
 */
export const TIER_INFO = {
  free: { label: "Free", priceLabel: "$0/mo" },
  plus: { label: "Plus", priceLabel: "$39/mo" },
  pro: { label: "Pro", priceLabel: "$79/mo" },
} as const;

// The same figures as TIER_INFO's priceLabel strings above, kept as real
// numbers too — for anything that needs to compute with a price (e.g. the
// platform admin dashboard's rough MRR estimate, src/lib/admin-data.ts)
// rather than parsing "$39/mo" back out of a display string.
export const TIER_MONTHLY_PRICE_USD: Record<keyof typeof TIER_INFO, number> = {
  free: 0,
  plus: 39,
  pro: 79,
};

export const VOICE_ADDON_INFO = { priceLabel: "+$39/mo", includedMinutes: 200, overagePerMinute: "$0.20" };

/**
 * Whether the Voice add-on can be BOUGHT right now. Founder's call,
 * 2026-09-15: the live voice agent is deferred, so it stops being
 * purchasable until it has been verified end to end with a real call.
 *
 * A flag, not a deletion, and deliberately so. Nothing about the voice
 * agent is removed — the bridge, the Twilio wiring, the webhook and the
 * billing path all stay exactly as they are, because the work is
 * postponed, not abandoned, and one boolean is the cheapest possible way
 * back.
 *
 * What made this urgent rather than tidy: the add-on was live at $39/mo
 * while the channel's weakest link is unverified. The voicemail
 * transcription path may read a `From` field Twilio does not send, which
 * if true means the whole channel is dead — and one real call settles it.
 * Selling a channel nobody has proven works is the part that had to stop
 * today; deciding its future can wait.
 *
 * Scope is deliberately narrow: this hides the CHECKOUT affordance only.
 * A business that already has the add-on keeps it, keeps being billed for
 * it, and still sees it in their plan summary — silently disabling
 * something a customer is paying for would be a worse failure than
 * selling it.
 */
export const VOICE_ADDON_AVAILABLE = false;

/**
 * Whether the CARRIER channels — SMS, voicemail and the live voice agent —
 * are offered. Founder's call, 2026-09-16: inbound leads are the core, and
 * anything that goes through a phone carrier is dropped for now.
 *
 * The line is drawn at the carrier, not at Twilio, and not at "phone".
 * SMS, voice and voicemail all sit behind A2P 10DLC registration, which is
 * a requirement of Bell, Rogers and AT&T rather than of any provider — so
 * no amount of provider-switching avoids it, and every customer would have
 * to register their own business and wait before sending one text. That is
 * a telecom onboarding process bolted to the front of a lead-follow-up
 * product.
 *
 * WhatsApp is deliberately NOT behind this flag even though it is
 * delivered through the same Twilio account. A2P 10DLC is an SMS rule and
 * does not touch WhatsApp; what WhatsApp needs is Meta's approval of the
 * business, which is the same approval Instagram and Messenger already
 * need and which the founder is doing. Grouping it with SMS was my error
 * on 2026-09-15 — the shared vendor made it look like a shared blocker,
 * and it is not one.
 *
 * A flag, not a deletion: the work is postponed, and one boolean is the
 * cheapest way back. The Twilio webhook routes stay live and unchanged, so
 * a business that already configured a number keeps working rather than
 * having it go dark without warning. What this turns off is the offer.
 */
export const CARRIER_CHANNELS_AVAILABLE = false;

/**
 * The Meta channels — Instagram DMs, Facebook Messenger, WhatsApp. All
 * available: they gate on Meta business verification, which the founder is
 * completing, not on anything a carrier controls.
 *
 * Named as a constant rather than left implicit so the distinction that
 * caused the mistake above stays written down: the question is never "is
 * this a phone number" but "who has to approve it".
 */
export const META_CHANNELS_AVAILABLE = true;

// Free tier's hard monthly cap on AI processing (research/market/2026-09-11-
// tier-pricing-recommendation.md §2.2). Lives here (not @/lib/billing)
// because a "use client" component needs the number too — see the "use
// client" note in this file's own header comment.
export const FREE_TIER_LEAD_CAP = 20;

/**
 * The monthly AI-processing ceiling for each tier, per
 * research/market/2026-09-11-tier-pricing-recommendation.md §2.2 and the
 * comparison table at line 334. Until now only Free's was implemented;
 * Plus's 1,500 and Pro's 10,000 were published policy with nothing behind
 * them.
 *
 * The three numbers are NOT the same kind of thing, and the code that
 * reads them has to keep the difference:
 *
 *   free  20      A HARD CAP, and marketed as one. Reaching it is the
 *                 plan working as sold; the honest response is "upgrade".
 *   plus  1,500   A FAIR-USE ceiling. Reaching it is possible for a real
 *                 business but far outside the tier's shape.
 *   pro   10,000  An ABUSE ceiling, explicitly "not marketed as a limit".
 *                 A Pro customer should never see it, and one who does is
 *                 far more likely to have a broken integration than a very
 *                 good month.
 *
 * So the paid ceilings are circuit breakers, in the same sense as
 * DAILY_AUTOMATED_SEND_CAP in @/lib/sendCaps: far above any legitimate
 * month, never phrased to a customer as a limit they have outgrown. At
 * the measured $0.0022/lead (research/product/2026-09-15-ai-cost-per-lead
 * .md) a Plus customer at 1,500 costs $3.26 against $39, so these exist to
 * catch a runaway, not to protect the margin — the margin is not in danger.
 */
export const TIER_AI_LEAD_CAP = {
  free: FREE_TIER_LEAD_CAP,
  plus: 1_500,
  pro: 10_000,
} as const;
