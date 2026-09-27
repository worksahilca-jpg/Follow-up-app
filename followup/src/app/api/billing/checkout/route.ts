import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getStripe, priceIdForTier, VOICE_FLAT_PRICE_ID, VOICE_METERED_PRICE_ID, appUrl } from "@/lib/stripe";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { TRIAL_PERIOD_DAYS, hasActiveAccess } from "@/lib/billing";
import { VOICE_ADDON_AVAILABLE } from "@/lib/pricing";
import { publicErrorMessage } from "@/lib/publicError";

const bodySchema = z.object({
  tier: z.enum(["plus", "pro"]),
  voiceAddon: z.boolean().optional().default(false),
});

// POST /api/billing/checkout — starts a Stripe Checkout session for the
// caller's business on the chosen tier (Free needs no checkout at all —
// there's no Stripe object for it, see @/lib/stripe) and hands back the
// URL to redirect to. Reuses the business's existing Stripe customer if
// one was already created by a prior (possibly abandoned) checkout
// attempt.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;
  const { tier, voiceAddon } = parsed.data;

  // The Voice add-on is deferred (VOICE_ADDON_AVAILABLE, @/lib/pricing).
  // Settings hides the checkbox, but a hidden control is not a gate —
  // this endpoint takes `voiceAddon` straight from the request body, so
  // the refusal has to live here too or a direct POST still buys it.
  //
  // Refused rather than silently dropped: quietly ignoring a paid option
  // someone asked for is how a customer ends up believing they bought
  // something they didn't.
  if (voiceAddon && !VOICE_ADDON_AVAILABLE) {
    return NextResponse.json(
      { success: false, message: "The Voice add-on isn't available to add right now." },
      { status: 400 }
    );
  }

  const tierPriceId = priceIdForTier(tier);
  if (!tierPriceId || (voiceAddon && (!VOICE_FLAT_PRICE_ID || !VOICE_METERED_PRICE_ID))) {
    return NextResponse.json({ success: false, message: "Billing isn't configured yet." }, { status: 500 });
  }

  void recordAudit(ctx, "billing.checkout", { meta: { tier, voiceAddon } });

  try {
    const stripe = getStripe();

    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { stripeCustomerId: true, stripeSubscriptionId: true, subscriptionStatus: true, name: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });
    }

    // Refuse a second checkout rather than silently creating a second live
    // Stripe subscription on the same customer (B-002,
    // research/audit/backend-backlog.md) — two browser tabs both landing
    // on "start Plus"/"start Pro" is enough to trigger this with no direct
    // API access needed. `hasActiveAccess` is deliberately called WITHOUT
    // a tier here: this is asking "is there already a paid subscription in
    // good standing," not "does this business have product access" — a
    // Free business (no stripeSubscriptionId at all) must still fall
    // through and be allowed to check out for the first time.
    if (business.stripeSubscriptionId && hasActiveAccess(business.subscriptionStatus)) {
      return NextResponse.json(
        { success: false, message: "You already have a plan — use Manage billing to change it." },
        { status: 409 }
      );
    }

    let customerId = business.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.email,
        name: business.name,
        metadata: { businessId: ctx.businessId },
      });
      customerId = customer.id;
      await prisma.business.update({ where: { id: ctx.businessId }, data: { stripeCustomerId: customerId } });
    }

    // Item A (see @/lib/stripe) is always the tier price. When Voice is
    // chosen at signup, items B+C (the flat fee and the metered overage)
    // ride the same subscription and inherit the same trial — a
    // subscription-level trial covers every item present at creation, no
    // per-item trial config needed for this case (research doc §3). Voice
    // added LATER, after the trial has already ended, is a separate
    // add-on flow (not yet built — see the PR description) and bills
    // immediately by design, per that same doc.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [{ price: tierPriceId, quantity: 1 }];
    if (voiceAddon) {
      lineItems.push({ price: VOICE_FLAT_PRICE_ID, quantity: 1 });
      // Metered items take usage from Meter Events, never a quantity —
      // Stripe rejects a metered line item that specifies one.
      lineItems.push({ price: VOICE_METERED_PRICE_ID });
    }

    // One free trial per business, not one per checkout. The trial asks for
    // no card, and nothing stopped a business whose trial had ended (and
    // whose unpaid subscription had lapsed) from pressing Upgrade again for
    // a fresh 14 days — Pro indefinitely, for nothing, never entering a
    // card (security audit 2026-09-26, A-9). A business that has ever had
    // a subscription, here or on its Stripe customer, starts paid.
    const hadSubscriptionBefore =
      !!business.stripeSubscriptionId ||
      (!!business.stripeCustomerId &&
        (await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 })).data.length > 0);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: ctx.businessId,
      line_items: lineItems,
      // A first subscription starts with a free trial (see TRIAL_PERIOD_DAYS
      // in @/lib/billing) — requireActiveBilling() already treats a
      // "trialing" Stripe status the same as "active", so no gating code
      // needed to change. payment_method_collection: "if_required" means
      // Checkout won't ask for a card at all when nothing is due today
      // (i.e. during the trial) — matches the landing page's own "no credit
      // card required to see it for yourself." A card is still collected
      // automatically the moment the trial ends and the first invoice is
      // actually due, same as any other Stripe subscription. Without a
      // trial the first invoice is due today, so Checkout asks for a card.
      ...(hadSubscriptionBefore ? {} : { subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS } }),
      payment_method_collection: "if_required",
      success_url: `${appUrl()}/settings?billing=success`,
      cancel_url: `${appUrl()}/settings?billing=canceled`,
    });

    if (!session.url) {
      return NextResponse.json({ success: false, message: "Couldn't start checkout." }, { status: 500 });
    }
    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = publicErrorMessage(err, "Couldn't start checkout.", "billing/checkout");
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
