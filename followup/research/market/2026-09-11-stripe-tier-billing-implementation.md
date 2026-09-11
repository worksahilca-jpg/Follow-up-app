# Stripe implementation: Free / Plus / Pro + metered Voice add-on

**Date:** 2026-09-11
**Task:** sanity-check the Stripe *implementation* shape for the tier structure recommended in
`research/market/2026-09-11-tier-pricing-recommendation.md` (Free $0 / Plus $39 / Pro $79, plus a
Voice add-on at $39/mo including 200 minutes then $0.20/min overage) against current Stripe
best practice, and produce a concrete migration checklist from what's wired today.

## What's already wired (read from the codebase, not inferred)

- `src/lib/stripe.ts` — one lazily-constructed Stripe client, and **one** env-configured price ID
  (`PLAN_PRICE_ID` / `STRIPE_PRICE_ID`). There is currently no concept of multiple tiers at all.
- `src/app/api/billing/checkout/route.ts` — starts a single Stripe Checkout Session in
  `mode: "subscription"` against that one price, `quantity: 1`, with `subscription_data:
  { trial_period_days: TRIAL_PERIOD_DAYS }` (14 days, from `src/lib/billing.ts`) and
  `payment_method_collection: "if_required"` (no card during trial).
- `src/app/api/billing/webhook/route.ts` — handles exactly three event types:
  `checkout.session.completed` (re-fetches the subscription via `stripe.subscriptions.retrieve`
  before syncing — good practice), and `customer.subscription.created` / `.updated` / `.deleted`
  (these three **cast `event.data.object` directly** rather than re-fetching the live object).
  `syncSubscription()` writes `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, and
  `currentPeriodEnd` (read off `subscription.items.data[0].current_period_end` — i.e., already
  assumes exactly one subscription item). **No `invoice.payment_failed` handling exists at all.**
  **No event-id deduplication exists** — every delivery re-runs the handler; it happens to be safe
  today only because `syncSubscription` is an idempotent upsert-by-latest-status, not because the
  code defends against duplicate/out-of-order delivery.
- `src/lib/billing.ts` — `hasActiveAccess()` is a **binary** gate (`active`/`trialing` = full
  access, everything else = read-only). There is no tier field anywhere in the schema or code —
  a business either has "the plan" or doesn't. Introducing Free/Plus/Pro requires adding tier
  state that doesn't exist yet, not just adding prices.
- `src/app/api/billing/portal/route.ts` — a plain Stripe Billing Portal session, no
  `features`/`products` configuration passed, so today it inherits whatever the Dashboard's
  default portal configuration allows (this matters once self-serve tier-switching is wanted — see
  checklist).

This confirms the task brief's framing: today's integration is single-flat-tier, and going to
Free/Plus/Pro + metered Voice is a materially bigger lift than swapping a price ID.

---

## 1. Object model: Billing Meters API vs. legacy metered pricing

**Billing Meters is not a choice to weigh in 2026 — it's the only option.** Stripe removed the
legacy usage-records API: "since API version 2025-03-31.basil, the legacy usage records API is
gone... every metered price now requires a backing Meter," and creating a price with
`usage_type: metered` without a Meter attached now errors outright.
*(WebSearch 2026-09-11 — [Stripe changelog: deprecate legacy usage-based billing](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-legacy-usage-based-billing), [migration guide](https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide).)*
Any tutorial describing `stripe.subscriptionItems.createUsageRecord(...)` is describing a dead
API path for a new integration.

**Recommended object model for FollowUp specifically:**

- **Free** needs **no Stripe object at all.** It's a $0/mo product-side gate (lead cap, feature
  gate) enforced in FollowUp's own code against a `tier` field — there is nothing for Stripe to
  bill. Don't model it as a $0 Stripe Price; that only adds webhook noise for no benefit.
- **Plus** and **Pro**: two ordinary recurring, licensed (`usage_type: licensed` — the default,
  non-metered) Prices, most simply as two Prices on **one** "FollowUp Subscription" Product (a
  single Product can carry multiple Prices — e.g. "you might have a single 'gold' product that
  has prices for $10/mo, $100/yr..." is Stripe's own framing for this exact pattern; *WebSearch
  2026-09-11, [Stripe: create products and prices](https://support.stripe.com/questions/how-to-create-products-and-prices)*),
  or as two separate Products if you want them to show distinctly in reporting/portal — either
  works; the Product/Price split doesn't affect the mechanics below.
- **Voice add-on**: this is the one piece that actually needs metering, and it needs **two Prices
  under one Product**, not one — this is Stripe's own documented pattern for "flat fee + included
  usage + overage," not a FollowUp-specific workaround:
  1. A flat **licensed** Price for the $39/mo base (the 200-minutes-included plan fee).
  2. A **metered** Price, backed by a Billing Meter (`event_name` e.g. `voice_minutes`,
     aggregation `sum`), using a **graduated tiered** structure: tier 1 = 0–200 units at
     $0/unit (this is what makes the first 200 minutes "included" rather than double-charged),
     tier 2 = 200+ units at $0.20/unit. *(WebSearch 2026-09-11 —
     [Stripe: flat fee and overages use case](https://docs.stripe.com/billing/subscriptions/usage-based-v1/use-cases/flat-fee-and-overages)
     confirms this exact two-Price shape and explicitly states "you cannot use a single price
     object" for this pattern.)* Every voice minute is reported to the Meter via Meter Events
     (not just overage minutes) — the tiering itself is what makes the first 200 free.

Why this fits better than trying to force one Price to do both jobs: Stripe's own billing_scheme
model doesn't support "flat fee, then metered after a free allowance" as a single Price object —
confirmed directly in the search result above, not an inference. Building this as one custom
"metered-with-a-discount" Price would mean fighting the API rather than using it as designed.

---

## 2. Structuring Prices so tier switches and the Voice toggle don't recreate the subscription

**Use one subscription per business, with multiple Subscription Items — not separate
subscriptions per product.** This is the documented, intended shape for "customers commonly
subscribed to multiple plans such as those with add-on features" — Stripe added multiplan
subscriptions specifically to solve base-plan-plus-add-on modeling
*(WebSearch 2026-09-11 — [Stripe blog: Multiple plans and previews for subscriptions](https://stripe.com/blog/multiplan-subscriptions))*.
Concretely for FollowUp:

- **Item A** = the tier Price (Plus or Pro). Switching Plus↔Pro is `subscriptionItems.update`
  on **this same item's `price`** with a `proration_behavior` (`create_prorations` for
  immediate mid-cycle switches, or `none`/schedule-based if you'd rather bill the new tier
  starting next period) — "update the subscription item to the new price, let Stripe handle
  proration, and let Stripe compute the money rather than trying to pre-calculate the proration
  yourself" *(WebSearch 2026-09-11 — [Stripe: change the price of existing subscriptions](https://docs.stripe.com/billing/subscriptions/change-price))*.
  This never touches Item B and never recreates the subscription.
- **Item B** = the Voice flat Price, and **Item C** = the Voice metered Price. Turning Voice on
  is adding Items B+C to the existing subscription; turning it off is removing them. Both are
  independent add/remove operations on the same subscription object — the tier item is untouched.
- A single subscription in "flexible" billing mode supports **up to 100 items** (classic mode:
  20) *(WebSearch 2026-09-11 — [Stripe: set product/subscription quantities](https://docs.stripe.com/billing/subscriptions/multiple-products))*,
  so 2–3 items per business is nowhere near a real ceiling.
- **Why not separate subscriptions for Voice?** Stripe explicitly frames this as a genuine
  choice with a real tradeoff, not a wrong answer either way: separate subscriptions give each
  product its own billing period/invoice/charge, which is useful when they should be able to
  drift independently; a single multi-item subscription gives one combined invoice and one
  payment, which is the simpler support/reconciliation story for a business toggling one add-on
  on and off *(WebSearch 2026-09-11 — search on Stripe multiple-products docs)*. For FollowUp,
  where Voice should visibly ride on top of one bill a small-business owner already understands,
  single-subscription/multi-item is the better fit — this part is this document's own judgment,
  not a direct quote, but it follows directly from the tradeoff Stripe itself documents.

---

## 3. Trial handling: one trial-eligible price, or per-tier trial config?

**A single subscription-level trial (what's already implemented) continues to work for Plus vs.
Pro** as long as the trial is granted at subscription creation regardless of which tier Price the
customer picked — `subscription_data.trial_period_days` is a property of the subscription, not
tied to a specific Price, so starting Checkout with either the Plus or the Pro Price and the same
`trial_period_days: 14` gives both tiers an identical trial with no per-tier config needed. Nothing
here needs to change from what `checkout/route.ts` already does.

Where it gets more interesting is the **Voice add-on**, and this is where Stripe's newer,
**item-level** trial mechanism matters: Stripe added the ability to "assign a Trial Offer to a
Subscription Item and specify a trial ending timestamp on the Subscription Item using the
`current_trial` parameter" *(WebSearch 2026-09-11 — [Stripe changelog: trial offers on subscription items](https://docs.stripe.com/changelog/dahlia/2026-03-25/trial-offers-on-subscription-items))*,
and confirms "if a subscription has mixed items (some trialing, some not), the top-level status
is active" *(WebSearch 2026-09-11 — general Stripe trials search)*. Two concrete scenarios:

- **Voice added at signup, same time as the base tier:** the existing subscription-level trial
  already covers every item added at creation — no extra config needed, Voice trials for the
  same 14 days as the base tier automatically.
- **Voice added later, to an existing (already-trialed-or-paid) subscription:** the subscription-
  level trial has already ended, so Voice would bill immediately with no trial *unless* you
  explicitly attach a per-item Trial Offer / `current_trial` to the new Voice item. **This is a
  real decision FollowUp needs to make, not an implementation detail Stripe resolves for you:**
  does a business that adds Voice three months into their Plus subscription get any trial on
  Voice, or does it bill from day one? Recommendation: bill Voice from day one when added
  mid-subscription (it's a discrete, informed opt-in add-on purchase, not a first-touch
  conversion moment) — but if the founder wants a "try Voice free for 14 days" motion later,
  the mechanism for it (per-item Trial Offers) already exists in the API and doesn't require
  restructuring anything above.
- **`trial_settings.end_behavior.missing_payment_method`** (`create_invoice` /
  `pause` / `cancel`) is worth setting explicitly rather than leaving as the Stripe default,
  since it governs what happens to a trialing multi-item subscription when the trial ends with no
  card on file — directly relevant given Checkout is configured with
  `payment_method_collection: "if_required"` today, meaning many trial subscriptions genuinely
  will have no card yet *(WebSearch 2026-09-11 — [Stripe: manage trial compliance](https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance), Acodei glossary on trial settings)*.

**Bottom line: each tier does not need its own separate trial configuration** — one
subscription-level trial, applied at Checkout regardless of which tier Price is chosen, is
sufficient. The Voice add-on is the one place a genuine per-item trial decision exists, and it's
a product decision (does Voice get its own trial when added later?), not a technical constraint.

---

## 4. Webhook events this shape needs beyond what's handled today

Confirmed gaps against the current three-event handler:

| Event | Currently handled? | Why it matters for this shape |
|---|---|---|
| `invoice.payment_failed` | **No — missing entirely today.** | This is "your signal to handle dunning (retry logic, customer notifications, service degradation)" *(WebSearch 2026-09-11 — Stripe subscription lifecycle sources)*. With three paid states now possible (Plus, Pro, Plus+Voice, Pro+Voice) rather than one, a failed payment needs to degrade access without destroying tier/add-on state — worth writing deliberately rather than leaving unhandled, which is the status quo. |
| `customer.subscription.updated` | Handled, but **generically** — treats every update (tier switch, Vo, add/remove, card update, cancel-at-period-end toggle) identically. | A tier switch and a Voice add/remove are both delivered as `customer.subscription.updated` with a changed `items` array — the handler needs to **diff the items list against what's stored** to know whether the tier changed, Voice was added/removed, or neither, since the current code only persists `status` and `currentPeriodEnd`, not which Price(s) are active. This is new logic, not a new event type — but it's real work the current handler doesn't do. |
| `v1.billing.meter.error_report_triggered` | Not applicable today (no meters exist yet); **required once Voice ships.** | Fires when async Meter Events fail validation — Stripe's own documented error codes include `meter_event_customer_not_found`, `meter_event_invalid_value`, `archived_meter`, `timestamp_too_far_in_past` (events older than 35 days) *(WebSearch 2026-09-11 — [Stripe changelog: billing meter webhooks](https://docs.stripe.com/changelog/basil/2025-03-31/billing-meter-webhooks), [Meter Events API reference](https://docs.stripe.com/api/billing/meter-event))*. Without handling this, silently-failing usage reports mean **undercharging for Voice minutes with no alert** — a direct margin leak given the 41%-worst-case-margin math in the pricing doc already assumes usage is billed correctly. |
| Pending-update discard on metered items | Not a webhook event per se, but a documented invoice-generation edge case: "if a subscription includes metered items, Stripe bills any outstanding usage on the pending update invoice. However, if the pending update expires before payment, Stripe **discards this usage**" *(WebSearch 2026-09-11 — Stripe pending updates docs)*. | Worth knowing this exists so a failed-payment retry cycle on a Voice-attached subscription doesn't quietly write off real usage cost with no accounting trail. |

---

## 5. Common mistakes teams hit going single-tier → multi-tier + metered

**Idempotency on usage reporting.** Stripe's Meter Event `identifier` field is documented to
deduplicate "within a rolling period of at least 24 hours" only — **not permanently** — so "you
should never retry a sync job across day boundaries without checking whether the record already
exists" *(WebSearch 2026-09-11 — search on Stripe meter idempotency)*. The safe pattern found
repeatedly across independent sources: keep your **own** durable usage ledger (a DB table with a
unique constraint on the underlying job/call ID — e.g. the voice-call ID FollowUp already has),
and derive the Stripe meter-event identifier from that same ledger row, rather than trusting
Stripe's 24-hour dedup window as your only defense *("keep a durable internal usage ledger with a
unique constraint on the completed job... then send each accepted ledger event through a
retryable outbox," WebSearch 2026-09-11 — mvpfactory/dev.to sources found via search)*. One team
went further and built their own credit ledger specifically to avoid depending on Stripe's usage
records for correctness at all *(WebSearch 2026-09-11, title: "Why we built our own credit ledger
instead of using Stripe metered billing")* — a data point that this is a genuinely common enough
pain point to name explicitly, not a hypothetical.

**Race conditions / out-of-order webhook delivery on tier-switch events.** Stripe explicitly does
not guarantee delivery order — "a `customer.subscription.deleted` event might arrive before
`customer.subscription.created`... this is by design" *(WebSearch 2026-09-11 — search results on
Stripe webhook race conditions, e.g. pedroalonso.net, dev.to)*. The documented mitigation, stated
consistently across every source found: **never trust the payload embedded in the event for
anything that matters — re-fetch the live object from the Stripe API** and treat that as truth;
**dedupe by event ID** (an insert into a table with a unique constraint on `event.id`, returning
200 immediately on a collision, since returning an error makes Stripe retry forever). FollowUp's
current webhook handler does **neither** of these for the subscription-update path — it casts
`event.data.object` directly rather than calling `stripe.subscriptions.retrieve`, and has no
event-id dedup table at all. This is low-risk today only because the shape is trivial (one item,
one status). It becomes a real risk the moment a business can be mid-tier-switch and
mid-Voice-toggle at once, because an out-of-order `subscription.updated` could momentarily persist
a stale items snapshot that gates the wrong tier.

**Clock/billing-period misalignment between the metered add-on and the base subscription.** Two
concrete documented cases: (1) "if you add a new subscription item with a billing meter price in
the middle of the service period, at the end of the month the invoice includes usage from when
the item was added through the end of the period" — i.e., a Voice add-on turned on mid-cycle
doesn't get its own separate period, it rides the existing cycle's remaining days, which is
usually what you want but is worth confirming isn't silently mis-modeled; (2) Stripe "generates a
single, combined invoice when item-level billing periods align and separate invoices when billing
periods diverge" *(WebSearch 2026-09-11 — Stripe multiple-products docs)* — so if Voice and the
base tier are ever put on different intervals (e.g. someone experiments with an annual base +
monthly Voice), the "one bill" assumption in §2 breaks and the business gets two invoices instead
of one. Keep Voice's billing interval identical to the base tier's to avoid this.

---

## 6. Concrete, ordered checklist: current state → Free/Plus/Pro/Voice

**Stripe Dashboard (test mode first):**
1. Create a Billing Meter for voice minutes (`event_name: voice_minutes`, aggregation `sum`).
2. Create/rename Products: e.g. "FollowUp Plus," "FollowUp Pro," "FollowUp Voice."
3. Create Prices: Plus $39/mo (licensed, recurring monthly) + $390/yr variant; Pro $79/mo +
   $790/yr variant; Voice flat $39/mo (licensed); Voice metered price on the meter above,
   graduated tiers (0–200 → $0, 200+ → $0.20/unit).
4. Decide and configure the Customer Portal's allowed product/price switches (`billingPortal
   .configurations`) so self-serve tier switching and Voice add/remove actually work through
   `/api/billing/portal` rather than requiring bespoke code for every change — today's portal call
   passes no configuration and inherits whatever's set in the Dashboard, which needs to be
   deliberately set once multiple tiers exist.
5. Set `trial_settings.end_behavior.missing_payment_method` explicitly (recommend `cancel` or
   `pause`, not the default) given Checkout already runs with `payment_method_collection:
   "if_required"`.

**Code changes, roughly in dependency order:**
6. Add a `tier` (Free/Plus/Pro) column and a `voiceAddonEnabled` boolean to `Business` — today
   there is no tier concept anywhere, only the binary `subscriptionStatus`; this is the actual
   prerequisite everything else hangs off, not an afterthought.
7. Replace the single `PLAN_PRICE_ID` env var in `src/lib/stripe.ts` with a small tier→price-ID
   map (Plus/Pro monthly+annual, Voice flat, Voice metered) — four to six price IDs instead of
   one.
8. Rewrite `src/app/api/billing/checkout/route.ts` to accept a chosen tier (and optionally
   Voice at signup) and build `line_items` from the map above instead of one hardcoded price.
9. Add a tier-switch endpoint/action that calls `subscriptionItems.update` on the existing tier
   item (§2) rather than creating a new Checkout Session — this is the part that avoids
   "recreating subscriptions" the task explicitly asked about.
10. Add Voice add/remove endpoints that add/remove the two Voice items (flat + metered) on the
    same subscription.
11. Rewrite the webhook handler's `customer.subscription.*` cases to re-fetch the live
    subscription object (don't trust `event.data.object`), diff its `items` against what's
    stored to detect tier switches vs. Voice toggles, and add an `event.id`-keyed dedup table.
12. Add `invoice.payment_failed` handling (dunning notice; do not touch tier/add-on state, only
    `subscriptionStatus`).
13. Add `v1.billing.meter.error_report_triggered` handling — at minimum, log/alert; this is the
    tripwire for silent under-billing on Voice.
14. Wire actual Meter Event reporting at every point FollowUp's Voice feature consumes minutes,
    keyed off FollowUp's own call-record ID (per §5's idempotency guidance) rather than a
    freshly-generated UUID per attempt.
15. Update `hasActiveAccess()` / `requireActiveBilling()` (currently boolean-only) to be
    tier-aware, since "has access" now needs to answer "access to what" (Plus-gated feature vs.
    Pro-gated feature vs. Voice-gated feature) rather than a single yes/no.
16. Test end-to-end in Stripe test mode with `stripe trigger`: trial→paid conversion on each
    tier, Plus→Pro and Pro→Plus switches, Voice add/remove mid-cycle, a simulated
    `invoice.payment_failed` → retry → recovery cycle, and `stripe trigger
    v1.billing.meter.error_report_triggered` specifically (Stripe documents this exact CLI
    command for testing it).

---

## So what — next actions for FollowUp

1. **Add the missing `tier` field and `invoice.payment_failed` handler before writing any new
   Stripe objects.** Both are prerequisites the current single-tier code never needed; skipping
   straight to creating multi-tier Prices without them will produce a webhook handler that can't
   express "which tier" and silently ignores failed payments.
2. **Model Voice as two Prices under one Product (flat $39 + metered graduated overage), backed
   by a Billing Meter — not a custom single-Price hack.** This is the one Stripe-documented
   pattern for "flat fee + included usage + overage," and fighting it will cost more engineering
   time than using it.
3. **Rewrite the `customer.subscription.*` webhook cases to re-fetch the live subscription and
   dedupe by event ID before shipping tier switching** — the out-of-order-delivery risk is
   real and Stripe-documented, and today's handler has neither defense, which was low-stakes for
   one item and stops being low-stakes at three.
4. **Derive every Voice-minute Meter Event's idempotency key from FollowUp's own call-record ID**,
   not a fresh UUID per attempt, given Stripe's 24-hour (not permanent) dedup window on meter
   event identifiers.
5. **Decide, as a product call rather than leaving it implicit, whether Voice gets its own trial
   when added after initial signup** — the mechanism (per-item Trial Offers) exists either way,
   but which behavior ships is a decision, not something Stripe resolves automatically.

---

## Sources (WebSearch, 2026-09-11)

- https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-legacy-usage-based-billing
- https://docs.stripe.com/billing/subscriptions/usage-based-legacy/migration-guide
- https://docs.stripe.com/billing/subscriptions/usage-based-v1/use-cases/flat-fee-and-overages
- https://support.stripe.com/questions/how-to-create-products-and-prices
- https://stripe.com/blog/multiplan-subscriptions
- https://docs.stripe.com/billing/subscriptions/multiple-products
- https://docs.stripe.com/billing/subscriptions/change-price
- https://docs.stripe.com/billing/subscriptions/prorations
- https://docs.stripe.com/changelog/dahlia/2026-03-25/trial-offers-on-subscription-items
- https://docs.stripe.com/billing/subscriptions/trials
- https://docs.stripe.com/billing/subscriptions/trials/manage-trial-compliance
- https://www.acodei.com/glossary/stripe-trial-settings
- https://docs.stripe.com/billing/subscriptions/pending-updates
- https://docs.stripe.com/billing/revenue-recovery/smart-retries
- https://docs.stripe.com/changelog/basil/2025-03-31/billing-meter-webhooks
- https://docs.stripe.com/api/billing/meter-event
- https://docs.stripe.com/api/billing/meter
- https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/
- https://dev.to/belazy/the-race-condition-youre-probably-shipping-right-now-with-stripe-webhooks-mj4
- https://amplifiedcreations.com/journal/stripe-subscription-webhooks
- https://dev.to/mtahir27/architecting-multi-tenant-saas-stripe-billing-metered-usage-idempotent-webhooks-2ej
- https://dev.to/zoetaka38/why-we-built-our-own-credit-ledger-instead-of-using-stripe-metered-billing-4ke5
- https://mvpfactory.io/blog/usage-based-pricing-engineering-metering-aggregation-and-the-billing-pipeline
- https://www.buildmvpfast.com/blog/stripe-metered-billing-implementation-guide-saas-2026

**Note on sourcing:** `docs.stripe.com`, `dev.to`, `stripe.com`, and several other cited domains
were not directly fetchable in this environment (outbound `WebFetch` to them was blocked by the
network egress proxy) — every claim attributed to those URLs above is drawn from the search-result
snippets `WebSearch` returned for them (which quote or closely paraphrase the source page), not
from a full independent read of the page. Where a claim is this document's own reasoning rather
than something a source stated, it's labeled as such inline (e.g. §2's "why not separate
subscriptions" paragraph, most of §6's ordering).

**Internal files read:** `research/market/2026-09-11-tier-pricing-recommendation.md`,
`src/lib/stripe.ts`, `src/lib/billing.ts`, `src/app/api/billing/checkout/route.ts`,
`src/app/api/billing/webhook/route.ts`, `src/app/api/billing/status/route.ts`,
`src/app/api/billing/portal/route.ts`.
