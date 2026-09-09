import { prisma } from "@/lib/db";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Every new subscription (src/app/api/billing/checkout/route.ts) starts
// with this many days free, no card required, before the first real charge.
// A business has full access while its mirrored Stripe subscription status
// is "active" or "trialing" — both are in ACTIVE_STATUSES below, so no
// gating code anywhere else needed to change when this was added.
export const TRIAL_PERIOD_DAYS = 14;

// Single flat plan: a business has full access only while its mirrored
// Stripe subscription status is "active" or "trialing" (during the free
// trial above). Anything else — never subscribed (null), past_due,
// canceled, unpaid, incomplete — falls back to read-only: they can still
// see their existing data, they just can't create new leads, sync, draft,
// or send.
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
