import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getTierFromPriceId, VOICE_FLAT_PRICE_ID, VOICE_METERED_PRICE_ID } from "@/lib/stripe";
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

  // Stripe does not guarantee exactly-once or in-order delivery — a
  // retried or duplicate delivery of the same event.id must not re-apply
  // its side effects (research/market/2026-09-11-stripe-tier-billing-
  // implementation.md §5). Insert-before-process, and treat a unique-
  // constraint collision as "already handled, tell Stripe it succeeded"
  // rather than reprocessing — returning an error here would make Stripe
  // retry forever instead.
  try {
    await prisma.processedWebhookEvent.create({ data: { eventId: event.id } });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const businessId = session.client_reference_id;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      // Never trust the payload embedded in the event for anything that
      // matters — re-fetch the live object and treat THAT as truth. Cheap
      // (one Stripe API call) and it's what protects against an
      // out-of-order delivery describing a state that's already stale by
      // the time it arrives.
      if (businessId && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(businessId, subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const eventSubscription = event.data.object as Stripe.Subscription;
      const subscription =
        event.type === "customer.subscription.deleted"
          // A deleted subscription's live GET can 404/still-return-canceled
          // depending on timing — the event payload's own terminal state
          // is what there is to go on here, so this one case is the
          // deliberate exception to "always re-fetch."
          ? eventSubscription
          : await stripe.subscriptions.retrieve(eventSubscription.id);
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
      const business = await prisma.business.findUnique({ where: { stripeCustomerId: customerId } });
      if (business) await syncSubscription(business.id, subscription);
      break;
    }
    case "invoice.payment_failed": {
      // Dunning notice — Stripe's own retry schedule (Smart Retries) keeps
      // trying the card automatically; subscriptionStatus already reflects
      // "past_due" via the subscription.updated event Stripe sends
      // alongside this one, so there's nothing to persist here. Logged
      // (rather than left silently unhandled, the status quo before this
      // case existed) so a failed charge is at least visible — an actual
      // customer-facing notice is real follow-up work, not done here.
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`[billing] invoice.payment_failed for customer ${String(invoice.customer)}, invoice ${invoice.id}`);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(businessId: string, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const items = subscription.items.data;
  // The tier item is whichever one isn't a Voice item — Plus/Pro and Voice
  // are never the same Price, so this is an unambiguous partition, not a
  // guess. Falls back to the subscription's first item if for some reason
  // every item matches a Voice price ID (shouldn't happen — a tier item is
  // always present — but this keeps currentPeriodEnd sane rather than
  // reading off `undefined` if it ever did).
  const tierItem = items.find((item) => item.price.id !== VOICE_FLAT_PRICE_ID && item.price.id !== VOICE_METERED_PRICE_ID) ?? items[0];
  const voiceAddonEnabled = items.some((item) => item.price.id === VOICE_FLAT_PRICE_ID);
  const periodEndUnix = tierItem?.current_period_end;

  await prisma.business.update({
    where: { id: businessId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      tier: getTierFromPriceId(tierItem?.price.id),
      voiceAddonEnabled,
    },
  });
}
