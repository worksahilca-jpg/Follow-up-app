import { prisma } from "@/lib/db";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Re-exported for server-side code that wants both the gate functions
// below AND the display constants in one import — a "use client" component
// must import these from @/lib/pricing directly instead, never from here:
// this file pulls in @/lib/db (the Prisma client), which must never reach a
// client bundle (see the fix for issue #93, "leads/pipeline pages loading
// Prisma into the client bundle" — the exact bug this split avoids
// repeating).
export { TIER_INFO, VOICE_ADDON_INFO } from "@/lib/pricing";

// Every new subscription (src/app/api/billing/checkout/route.ts) starts
// with this many days free, no card required, before the first real charge.
// A business has full access while its mirrored Stripe subscription status
// is "active" or "trialing" — both are in ACTIVE_STATUSES below, so no
// gating code anywhere else needed to change when this was added.
export const TRIAL_PERIOD_DAYS = 14;

// Deliberately still tier-blind — this predates Free/Plus/Pro (this file's
// TIER_INFO above) and hasn't caught up to it yet. It answers one question
// only, "is there a paid subscription in good standing," and every one of
// its ~45 call sites across the API routes still uses it that way: no
// subscription (Free, by definition) reads the same as canceled/past_due,
// full lockout rather than the capped-but-real access the Free tier is
// actually supposed to have. Rewiring that — a real per-feature check
// answering "access to *what*, at *this* tier" instead of one yes/no — is
// its own pass, deliberately not bundled into wiring the Stripe side of
// these tiers (see the PR that introduced tier/voiceAddonEnabled on
// Business). Anything that has to change *by tier* (the Free lead cap, the
// Free channel restriction, Voice-gating) needs a new check that reads
// Business.tier — not a rewrite of what this function means.
export function hasActiveAccess(subscriptionStatus: string | null | undefined): boolean {
  return !!subscriptionStatus && ACTIVE_STATUSES.has(subscriptionStatus);
}

// Convenience for API routes that need to gate a mutation on billing —
// looks up the caller's business fresh (session JWT doesn't carry
// subscription state, and it changes independently of login).
export async function requireActiveBilling(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { subscriptionStatus: true },
  });
  return hasActiveAccess(business?.subscriptionStatus);
}

export const BILLING_LOCKED_MESSAGE =
  "Start your free 14-day trial to unlock this — see Billing in Settings.";
