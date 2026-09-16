import { prisma } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { TIER_AI_LEAD_CAP } from "@/lib/pricing";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

// Re-exported for server-side code that wants both the gate functions
// below AND the display constants in one import — a "use client" component
// must import these from @/lib/pricing directly instead, never from here:
// this file pulls in @/lib/db (the Prisma client), which must never reach a
// client bundle (see the fix for issue #93, "leads/pipeline pages loading
// Prisma into the client bundle" — the exact bug this split avoids
// repeating).
export { TIER_INFO, VOICE_ADDON_INFO, FREE_TIER_LEAD_CAP, TIER_AI_LEAD_CAP } from "@/lib/pricing";

// Every new subscription (src/app/api/billing/checkout/route.ts) starts
// with this many days free, no card required, before the first real charge.
// A business has full access while its mirrored Stripe subscription status
// is "active" or "trialing" — both are in ACTIVE_STATUSES below, so no
// gating code anywhere else needed to change when this was added.
export const TRIAL_PERIOD_DAYS = 14;

// Was tier-blind until this fix — it predates Free/Plus/Pro (this file's
// TIER_INFO above) and answered one question only, "is there a paid
// subscription in good standing." Every one of its ~45 call sites across
// the API routes (lead capture on every channel, sync, sends, etc.) used it
// that way, which meant Free tier — which by design has no Stripe
// subscription at all, see checkout/route.ts — read as fully locked out,
// identical to canceled/past_due. That made the whole Free tier
// non-functional end to end (a Free business couldn't capture a single
// lead) rather than the capped-but-real access it's supposed to have.
//
// The fix: accept the caller's tier as a second, optional argument. A
// Business.tier of "free" now counts as access on its own, independent of
// subscriptionStatus — because Free tier genuinely has none. This is
// additive and opt-in per call site: omit the second argument and the
// check is exactly what it always was (subscription-only), which is
// deliberately still correct for call sites gating a Plus/Pro-only
// capability (e.g. crmSync.ts's CRM import, not a Free-tier-allowed
// channel — see FREE_TIER_ALLOWED_SOURCES below). Pass the tier at any
// call site that gates something Free tier is meant to have (lead
// capture/processing, Gmail/Outlook sync — both Free-tier channels).
//
// Who this Free-tier bypass reaches, exactly:
//
//  - a business that has never subscribed (subscriptionStatus null, tier
//    "free") — the population it was written for;
//  - a business whose subscription reached a terminal state (canceled,
//    incomplete_expired). The webhook resets tier to "free" in that case
//    (syncSubscription in billing/webhook/route.ts), so cancellation
//    lands them on the Free plan instead of locking them out of a
//    product a never-subscribed stranger can use. It used to leave tier
//    at the stale "plus"/"pro", which made cancelling a one-way door
//    with no way back short of resubscribing.
//
// It does NOT reach a past_due/unpaid business: that subscription is
// alive and in dunning, tier stays "plus"/"pro", and access stays
// paused until the card recovers. Capture still runs for them — that
// happens below this gate entirely, see checkAiEligibility.
export function hasActiveAccess(subscriptionStatus: string | null | undefined, tier?: string | null): boolean {
  return (!!subscriptionStatus && ACTIVE_STATUSES.has(subscriptionStatus)) || tier === "free";
}

// Convenience for API routes that need to gate a mutation on billing —
// looks up the caller's business fresh (session JWT doesn't carry
// subscription state, and it changes independently of login). Passes tier
// through to hasActiveAccess so every one of this function's ~45 call
// sites automatically treats Free tier as real access, not lockout — see
// hasActiveAccess's own comment for why that's safe to do unconditionally
// here specifically (this function gates general lead-capture/processing
// mutations, which Free tier is meant to have; a call site gating a
// genuinely Plus/Pro-only capability calls hasActiveAccess directly
// instead, as crmSync.ts already does).
export async function requireActiveBilling(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { subscriptionStatus: true, tier: true },
  });
  return hasActiveAccess(business?.subscriptionStatus, business?.tier);
}

/**
 * The generic lock message, for the common case: nobody has subscribed yet.
 *
 * Prefer `billingLockedMessage(businessId)` below. This constant is still
 * exported for the handful of places that genuinely have no business context
 * to look up, and as the fallback when the lookup fails.
 */
export const BILLING_LOCKED_MESSAGE =
  "Start your free 14-day trial to unlock this — see Billing in Settings.";

/**
 * Why access is locked, in words the owner can act on.
 *
 * Every one of the ~40 gated routes used to return BILLING_LOCKED_MESSAGE
 * verbatim, whatever the actual reason. So a paying customer whose card was
 * declined — `past_due` — was told to "start your free 14-day trial" when they
 * tried to send a follow-up, invite a teammate, or run automation. They are
 * already a customer. The one place that told them the truth ("Payment failed
 * — update your card") was the Billing tab, which is the one screen they had
 * no reason to open, because as far as every other screen was concerned they
 * had simply never subscribed.
 *
 * Losing a customer to a silently-expired card is bad; losing them because the
 * product couldn't tell them their card had expired is worse.
 *
 * Statuses come from Stripe via the billing webhook — see syncSubscription.
 */
export async function billingLockedMessage(businessId: string): Promise<string> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { subscriptionStatus: true },
    });
    switch (business?.subscriptionStatus) {
      case "past_due":
      case "unpaid":
        return "Your last payment didn't go through — update your card under Billing in Settings to switch this back on.";
      case "canceled":
        return "Your subscription was cancelled. Resubscribe under Billing in Settings to switch this back on.";
      case "incomplete":
      case "incomplete_expired":
        return "Your subscription was never finished — complete checkout under Billing in Settings.";
      case "paused":
        return "Your subscription is paused. Resume it under Billing in Settings.";
      default:
        return BILLING_LOCKED_MESSAGE;
    }
  } catch {
    // The gate has already decided to refuse; a failed lookup here must not
    // turn a clean 402 into a 500. Fall back to the generic wording.
    return BILLING_LOCKED_MESSAGE;
  }
}

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
  return isWithinTierLeadCap(businessId, lead, "free");
}

/**
 * The same rank check, for any tier.
 *
 * Plus's 1,500/mo and Pro's 10,000/mo were published in the pricing
 * recommendation and implemented nowhere: FREE_TIER_LEAD_CAP was the only
 * ceiling in the codebase, so a paid account had no upper bound on AI
 * processing at all. That is not a margin problem — the measured cost of
 * a Plus customer at their full 1,500 is $3.26 against $39
 * (research/product/2026-09-15-ai-cost-per-lead.md) — it is a runaway
 * problem, and the shape of the runaway is a broken integration looping,
 * which is exactly what an unbounded path lets run all month.
 *
 * See TIER_AI_LEAD_CAP for why the paid ceilings are circuit breakers and
 * Free's is a real cap. Callers must keep that distinction in what they
 * tell the user: "upgrade" is the honest answer on Free and the wrong one
 * on Pro.
 */
export async function isWithinTierLeadCap(
  businessId: string,
  lead: { id: string; createdAt: Date },
  tier: keyof typeof TIER_AI_LEAD_CAP
): Promise<boolean> {
  const monthStart = new Date(Date.UTC(lead.createdAt.getUTCFullYear(), lead.createdAt.getUTCMonth(), 1));
  const rank = await prisma.lead.count({
    where: {
      businessId,
      createdAt: { gte: monthStart },
      OR: [{ createdAt: { lt: lead.createdAt } }, { createdAt: lead.createdAt, id: { lte: lead.id } }],
    },
  });
  return rank <= TIER_AI_LEAD_CAP[tier];
}

/**
 * What the gate below says when it refuses on billing state alone. Kept
 * as a constant because it's the one refusal reason that is about the
 * ACCOUNT rather than about the lead, and the automation/sequence call
 * sites surface it to the owner verbatim.
 */
export const AI_PAUSED_BILLING_REASON =
  "paused while the subscription is inactive — the lead is still captured, and processing resumes as soon as billing is sorted out";

/**
 * The one place that decides whether a lead may consume AI processing,
 * so the channel rule and the rank rule can never drift apart between
 * the five call sites that need them (scoring, automation, sequences,
 * regenerate, and — newly — the instant acknowledgement, which had no
 * gate of any kind).
 *
 * Returns the reason when it refuses, because the reasons are different
 * enough that callers were already writing their own strings: a Free
 * account past 20 should be told to upgrade, and a Pro account past
 * 10,000 should be told something looks wrong.
 *
 * Billing state is checked HERE, not at the capture routes, and that
 * split is the whole point. A lapsed card used to be enforced at the
 * front door of every inbound channel — the Twilio SMS/WhatsApp
 * webhooks, the Meta webhook, the embed widget, the generic lead webhook
 * — which meant an inbound event arriving during a `past_due` window was
 * DISCARDED. None of those senders retry (Twilio and Meta got their
 * 200/TwiML, the widget's visitor got a polite "not accepting
 * submissions"), so the lead was gone permanently and fixing the card
 * did not bring it back. Email escaped only by accident, because Gmail/
 * Outlook still hold the mail until the next sync.
 *
 * So: capture always runs, and the money-spending half — OpenAI calls
 * and anything that sends a message — pauses instead. That is the same
 * shape the Free tier already uses ("capture continues, AI pauses",
 * research/market/2026-09-11-tier-pricing-recommendation.md §2.2), now
 * applied to lapsed billing too. Putting it inside this function rather
 * than at each caller is deliberate: this is already the single gate
 * every AI entry point funnels through, so there is no call site left
 * that can forget it.
 *
 * hasActiveAccess(status, tier) — not a bare status check — because a
 * genuine Free business has no Stripe subscription at all and must stay
 * eligible for its capped allowance.
 */
export async function checkAiEligibility(
  businessId: string,
  lead: { id: string; createdAt: Date; source: string | null },
  tier: "free" | "plus" | "pro"
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Only the one plain column — Business carries AES-GCM encrypted
  // third-party secrets (ENCRYPTED_FIELDS in src/lib/db.ts) that a
  // whole-row read would decrypt for nothing. `tier` is already the
  // caller's, so it isn't re-read here.
  const billing = await prisma.business.findUnique({
    where: { id: businessId },
    select: { subscriptionStatus: true },
  });
  if (!hasActiveAccess(billing?.subscriptionStatus, tier)) {
    return { ok: false, reason: AI_PAUSED_BILLING_REASON };
  }

  if (tier === "free" && !isChannelAvailableOnFreeTier(lead.source)) {
    return { ok: false, reason: "on a channel the Free plan doesn't cover" };
  }
  if (await isWithinTierLeadCap(businessId, lead, tier)) return { ok: true };

  return {
    ok: false,
    reason:
      tier === "free"
        ? `past this month's ${TIER_AI_LEAD_CAP.free}-lead AI cap on the Free plan`
        : `FollowUp paused AI processing after ${TIER_AI_LEAD_CAP[tier].toLocaleString()} leads this month as a safety measure — that is far more than a normal month, so something may be wrong`,
  };
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
