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
