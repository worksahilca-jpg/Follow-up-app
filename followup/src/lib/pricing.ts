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
