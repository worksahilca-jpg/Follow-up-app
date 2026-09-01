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

export const PLAN_PRICE_ID = process.env.STRIPE_PRICE_ID ?? "";

export function appUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
