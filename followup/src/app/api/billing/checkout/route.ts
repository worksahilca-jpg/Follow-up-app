import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getStripe, PLAN_PRICE_ID, appUrl } from "@/lib/stripe";
import { requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { TRIAL_PERIOD_DAYS } from "@/lib/billing";

// POST /api/billing/checkout — starts a Stripe Checkout session for the
// caller's business and hands back the URL to redirect to. Reuses the
// business's existing Stripe customer if one was already created by a
// prior (possibly abandoned) checkout attempt.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });
  if (!(await requireAdmin(ctx))) return NextResponse.json({ success: false, message: "Only an admin can do this." }, { status: 403 });
  void recordAudit(ctx, "billing.checkout");

  if (!PLAN_PRICE_ID) {
    return NextResponse.json({ success: false, message: "Billing isn't configured yet." }, { status: 500 });
  }

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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: ctx.businessId,
      line_items: [{ price: PLAN_PRICE_ID, quantity: 1 }],
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
