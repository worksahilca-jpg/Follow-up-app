import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

// POST /api/billing/webhook — Stripe calls this server-to-server, so
// there's no user session here. Trust comes entirely from the signature
// check against STRIPE_WEBHOOK_SECRET (the raw request body, read via
// request.text() before any JSON parsing, is required for that check to
// pass — App Router route handlers don't auto-parse the body, so no
// special config is needed for this, unlike the old Pages Router).
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.client_reference_id;
      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (businessId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(businessId, customerId, subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const business = await prisma.business.findUnique({ where: { stripeCustomerId: customerId } });
      if (business) await syncSubscription(business.id, customerId, subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(businessId: string, customerId: string | null, subscription: Stripe.Subscription) {
  const periodEndUnix = subscription.items.data[0]?.current_period_end;
  await prisma.business.update({
    where: { id: businessId },
    data: {
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
    },
  });
}
