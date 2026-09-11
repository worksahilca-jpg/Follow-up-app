import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getStripe, priceIdForTier, VOICE_FLAT_PRICE_ID, VOICE_METERED_PRICE_ID, appUrl } from "@/lib/stripe";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/validation";
import { TRIAL_PERIOD_DAYS } from "@/lib/billing";

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

  const tierPriceId = priceIdForTier(tier);
  if (!tierPriceId || (voiceAddon && (!VOICE_FLAT_PRICE_ID || !VOICE_METERED_PRICE_ID))) {
    return NextResponse.json({ success: false, message: "Billing isn't configured yet." }, { status: 500 });
  }

  void recordAudit(ctx, "billing.checkout", { meta: { tier, voiceAddon } });

  try {
    const stripe = getStripe();

    const business = await prisma.business.findUnique({
      where: { id: ctx.businessId },
      select: { stripeCustomerId: true, name: true },
    });
    if (!business) {
      return NextResponse.json({ success: false, message: "Business not found." }, { status: 404 });
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: ctx.businessId,
      line_items: lineItems,
      // Every new subscription starts with a free trial (see TRIAL_PERIOD_DAYS
      // in @/lib/billing) — requireActiveBilling() already treats a
      // "trialing" Stripe status the same as "active", so no gating code
      // needed to change. payment_method_collection: "if_required" means
      // Checkout won't ask for a card at all when nothing is due today
      // (i.e. during the trial) — matches the landing page's own "no credit
      // card required to see it for yourself." A card is still collected
      // automatically the moment the trial ends and the first invoice is
      // actually due, same as any other Stripe subscription.
      subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS },
      payment_method_collection: "if_required",
      success_url: `${appUrl()}/settings?billing=success`,
      cancel_url: `${appUrl()}/settings?billing=canceled`,
    });

    if (!session.url) {
      return NextResponse.json({ success: false, message: "Couldn't start checkout." }, { status: 500 });
    }
    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't start checkout.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
