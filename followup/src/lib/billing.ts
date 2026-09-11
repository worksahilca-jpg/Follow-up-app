import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { FREE_TIER_LEAD_CAP } from "@/lib/pricing";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Re-exported for server-side code that wants both the gate functions
// below AND the display constants in one import — a "use client" component
// must import these from @/lib/pricing directly instead, never from here:
// this file pulls in @/lib/db (the Prisma client), which must never reach a
// client bundle (see the fix for issue #93, "leads/pipeline pages loading
// Prisma into the client bundle" — the exact bug this split avoids
// repeating).
export { TIER_INFO, VOICE_ADDON_INFO, FREE_TIER_LEAD_CAP } from "@/lib/pricing";

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

// --- Free tier: the two checks called out in the comment above as not yet
// wired anywhere (research/market/2026-09-11-tier-pricing-recommendation.md
// §2.2) — FREE_TIER_LEAD_CAP itself is imported from @/lib/pricing (and
// re-exported above) since a "use client" Settings component needs the
// number too, without pulling in this file's @/lib/db import.

// Which Lead.source values count as "email or website widget" for Free
// tier eligibility. Manual entry / CSV import / the internal test-lead
// route are included too, deliberately — they're the business's own
// first-party data entry, not a live external channel with its own
// ongoing per-message AI cost the way SMS/WhatsApp/Instagram/CRM sync are;
// the doc's restriction is about channels, not about how a lead got typed
// in. Matched by exact string against the literal values each capture
// path actually writes (grep-verified against gmail.ts "Gmail"/"Gmail
// (spam)", outlook.ts "Outlook", the embed route's "Website form",
// twilio.ts's "SMS"/"Phone call"/"WhatsApp" params, instagram.ts's
// "Instagram", facebook.ts's "Facebook Messenger"/"Facebook Lead Ad",
// crmSync.ts's CRM_PROVIDERS labels, the generic webhook's "Webhook", and
// leads/route.ts's "Manual entry" default) — not an enum, since
// Lead.source itself isn't one.
const FREE_TIER_ALLOWED_SOURCES = new Set([
  "Gmail",
  "Gmail (spam)",
  "Outlook",
  "Website form",
  "Manual entry",
  "CSV import",
  "Test lead",
]);

export function isChannelAvailableOnFreeTier(source: string | null | undefined): boolean {
  return !!source && FREE_TIER_ALLOWED_SOURCES.has(source);
}

/**
 * Whether `lead` is within the first FREE_TIER_LEAD_CAP leads its business
 * captured in `lead`'s own calendar month (UTC) — a fixed fact about the
 * lead, not something that moves as "now" advances, so a lead that was
 * within cap when it arrived stays within cap for as long as it exists,
 * and a lead that arrived as #21 that month never retroactively becomes
 * eligible just because a cron tick runs the check later. This is what
 * "AI processing pauses past lead #20, until the next billing cycle" means
 * concretely: leads keep their rank forever; only NEW leads in a new month
 * start counting from 1 again. Ties on createdAt (same millisecond) are
 * broken by id so the count is deterministic — an edge case rare enough
 * that exact ordering doesn't matter, the same tolerance
 * scoreAndDraftForLead's own "occasional duplicate notification" comment
 * already accepts elsewhere in this codebase.
 */
export async function isWithinFreeTierLeadCap(
  businessId: string,
  lead: { id: string; createdAt: Date }
): Promise<boolean> {
  const monthStart = new Date(Date.UTC(lead.createdAt.getUTCFullYear(), lead.createdAt.getUTCMonth(), 1));
  const rank = await prisma.lead.count({
    where: {
      businessId,
      createdAt: { gte: monthStart },
      OR: [{ createdAt: { lt: lead.createdAt } }, { createdAt: lead.createdAt, id: { lte: lead.id } }],
    },
  });
  return rank <= FREE_TIER_LEAD_CAP;
}

export interface FreeTierStatus {
  tier: "free" | "plus" | "pro";
  voiceAddonEnabled: boolean;
  // How many leads this business has captured so far in the CURRENT
  // calendar month (UTC) — "now"'s month, unlike isWithinFreeTierLeadCap's
  // per-lead-fixed-month rank above, because this is for a live "X/20 this
  // month" display, not a gating decision. Always 0 on Plus/Pro — nobody
  // needs this number once there's no cap to measure it against.
  leadsUsedThisMonth: number;
}

/**
 * Server-Component convenience, mirroring src/lib/leads-data.ts's own
 * "resolve the caller's business from the session, don't make the page
 * thread businessId through" pattern — used by the Settings billing tab
 * (via /api/billing/status) and the per-lead automation toggle (which
 * needs to know whether AUTONOMOUS is even choosable before rendering it),
 * so both surfaces show the same numbers instead of each recomputing
 * their own slightly-different version of "where does this business
 * stand." Null only when there's no session — callers already sit behind
 * the (app) layout's own auth gate, so this is a formality, not a real
 * path.
 */
export async function getFreeTierStatus(): Promise<FreeTierStatus | null> {
  const ctx = await getSessionContext();
  if (!ctx) return null;

  const business = await prisma.business.findUnique({
    where: { id: ctx.businessId },
    select: { tier: true, voiceAddonEnabled: true },
  });
  const tier = (business?.tier as FreeTierStatus["tier"] | undefined) ?? "free";

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const leadsUsedThisMonth =
    tier === "free" ? await prisma.lead.count({ where: { businessId: ctx.businessId, createdAt: { gte: monthStart } } }) : 0;

  return { tier, voiceAddonEnabled: business?.voiceAddonEnabled ?? false, leadsUsedThisMonth };
}
