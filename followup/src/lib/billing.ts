import { prisma } from "@/lib/db";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Single flat plan, no trial: a business has full access only while its
// mirrored Stripe subscription status is "active" (or "trialing", handled
// defensively in case a trial is ever configured on the Stripe side).
// Anything else — never subscribed (null), past_due, canceled, unpaid,
// incomplete — falls back to read-only: they can still see their existing
// data, they just can't create new leads, sync, draft, or send.
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
  "Subscribe to unlock this — see Billing in Settings ($29/mo).";
