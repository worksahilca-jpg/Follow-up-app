import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getStripe, PLAN_PRICE_ID, appUrl } from "@/lib/stripe";

// POST /api/billing/checkout — starts a Stripe Checkout session for the
// caller's business and hands back the URL to redirect to. Reuses the
// business's existing Stripe customer if one was already created by a
// prior (possibly abandoned) checkout attempt.
export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ success: false, message: "Not signed in." }, { status: 401 });

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
