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

  // The marker above is written BEFORE the work below, so it has to be
  // rolled back if the work doesn't actually happen — otherwise a
  // transient failure here (Stripe API timeout on the re-fetch, a DB blip
  // in syncSubscription) is permanent: this returns 500, Stripe retries,
  // the retry collides with the marker, and the handler reports "already
  // handled" for an event whose side effects never ran. A business that
  // just paid would stay locked out with no second chance at the event.
  try {
    await processEvent(stripe, event);
  } catch (err) {
    await prisma.processedWebhookEvent
      .delete({ where: { eventId: event.id } })
      // Best-effort: if the rollback itself fails there's nothing further
      // to do here, and the original error is the one worth surfacing.
      .catch((cleanupErr) => console.error(`[billing] failed to roll back the processed-event marker for ${event.id}:`, cleanupErr));
    throw err;
  }

  return NextResponse.json({ received: true });
}

async function processEvent(stripe: Stripe, event: Stripe.Event) {
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
      // Only the id — Business carries AES-GCM encrypted third-party
      // secrets (ENCRYPTED_FIELDS in src/lib/db.ts), and a whole-row read
      // would decrypt Gmail/Twilio/CRM credentials this handler never
      // touches, on every Stripe event.
      const business = await prisma.business.findUnique({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
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
}

// A subscription in one of these states is genuinely live, and is allowed
// to take over as the business's subscription of record even if a
// different subscription id is currently mirrored. Mirrors
// ACTIVE_STATUSES in @/lib/billing deliberately: "may supersede" and "has
// access" are the same question asked twice.
const LIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

async function syncSubscription(businessId: string, subscription: Stripe.Subscription) {
  // Stripe delivers out of order, and one customer can hold more than one
  // subscription over time. Without this guard, an event about a SUPERSEDED
  // subscription overwrites the live one and locks a paying customer out:
  //
  //   1. Sub A is cancelled at period end — it stays `active` until then.
  //   2. Before that date the owner resubscribes; checkout creates sub B,
  //      and checkout.session.completed mirrors B as active/trialing.
  //   3. Period end arrives and Stripe fires customer.subscription.deleted
  //      for A — later in wall-clock time than everything about B.
  //   4. The old code mirrored A's terminal status over B's live one:
  //      subscriptionStatus "canceled" on a business that is paying.
  //      Every gated route 402s, sync stops, inbound leads stop being
  //      captured, and nothing ever corrects it (Stripe has no more events
  //      to send for A, and B is stable so it sends none for B either).
  //
  // Rule: an event about a subscription other than the one on record is
  // applied only when that subscription is itself live, i.e. only a real
  // takeover moves the mirror. A terminal state on a subscription the
  // business already moved off is dropped.
  const current = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stripeSubscriptionId: true },
  });
  if (
    current?.stripeSubscriptionId &&
    current.stripeSubscriptionId !== subscription.id &&
    !LIVE_SUBSCRIPTION_STATUSES.has(subscription.status)
  ) {
    console.warn(
      `[billing] ignoring ${subscription.status} event for superseded subscription ${subscription.id}; business ${businessId} is on ${current.stripeSubscriptionId}`
    );
    return;
  }

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
