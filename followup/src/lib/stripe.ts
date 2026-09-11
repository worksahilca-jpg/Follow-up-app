import Stripe from "stripe";

// Lazily-constructed shared Stripe client. STRIPE_SECRET_KEY doesn't exist
// yet in local dev before billing is configured, and the Stripe SDK throws
// immediately if constructed with an empty key — which would crash `next
// build` itself, since Next.js imports every route module (without calling
// the handler) to collect its config. Building the client on first real
// use, inside a request, avoids that.
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!cached) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) throw new Error("Billing isn't configured yet.");
    cached = new Stripe(apiKey, { apiVersion: "2026-08-26.dahlia" });
  }
  return cached;
}

// Paid tiers only — "free" needs no Stripe object at all (nothing to bill),
// so it's deliberately absent from this type and from PAID_TIER_PRICE_ID
// below. See research/market/2026-09-11-stripe-tier-billing-implementation.md
// §1 for why: modeling Free as a $0 Price would only add webhook noise.
export type PaidTier = "plus" | "pro";

// One env var per Price object this shape needs — Plus and Pro are each a
// single ordinary recurring ("licensed") Price; the Voice add-on needs TWO
// Prices under one Product (a flat base fee plus a metered overage backed
// by a Stripe Billing Meter), because Stripe's billing_scheme doesn't
// support "flat fee, then metered after a free allowance" as one Price
// object (confirmed in the research doc §1 — not a FollowUp workaround,
// it's Stripe's own documented shape for this exact use case). All four
// come from the Stripe Dashboard (test mode first — see the PR description
// for the exact objects to create) and are undefined until configured,
// same pattern as the old single PLAN_PRICE_ID.
export const PLUS_PRICE_ID = process.env.STRIPE_PLUS_PRICE_ID ?? "";
export const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID ?? "";
export const VOICE_FLAT_PRICE_ID = process.env.STRIPE_VOICE_FLAT_PRICE_ID ?? "";
export const VOICE_METERED_PRICE_ID = process.env.STRIPE_VOICE_METERED_PRICE_ID ?? "";

// Kept for existing pre-restructure subscribers only — their subscription
// was created against this single price and nothing re-subscribes anyone
// to it going forward (see getTierFromPriceId below for how they're
// grandfathered onto Plus without ever touching this constant again).
export const LEGACY_PLAN_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";

export function priceIdForTier(tier: PaidTier): string {
  return tier === "pro" ? PRO_PRICE_ID : PLUS_PRICE_ID;
}

// The inverse: given a Stripe Price ID actually on a subscription's tier
// line item, which of our tiers is that? Anything that isn't recognizably
// Pro falls back to "plus" — deliberately, not as an error case. This is
// what grandfathers every subscriber created before this restructure (on
// LEGACY_PLAN_PRICE_ID, or on no stored price ID at all) onto Plus
// permanently at their existing price, with no backfill migration needed:
// their subscriptionStatus is active/trialing and their tier price ID
// simply never matches PRO_PRICE_ID.
export function getTierFromPriceId(priceId: string | null | undefined): PaidTier {
  return priceId === PRO_PRICE_ID ? "pro" : "plus";
}

export function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
