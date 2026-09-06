# Stripe — beyond the billing gate: webhooks, tax, compliance for a $29/mo SaaS

Checked: 2026-09-06. Current wiring: `src/lib/billing.ts` gates access on
`subscriptionStatus` (`active`/`trialing`); `src/app/api/billing/webhook/route.ts` already does
real signature verification (`stripe.webhooks.constructEvent` against `STRIPE_WEBHOOK_SECRET`,
raw body read before parsing) and syncs `checkout.session.completed` +
`customer.subscription.{created,updated,deleted}`. `package.json` pins `"stripe": "^22.6.0"`.
This is already close to correct — findings below are gaps, not "this is unwired."

## Nothing here is a hard blocker for launch at FollowUp's current stage. One item worth doing soon regardless.

### Webhook event coverage has a real gap: failed/past-due payments aren't handled
The webhook switch handles subscription creation/update/deletion and checkout completion, but I
did not see `invoice.payment_failed` or `customer.subscription.trial_will_end` handled — which
means a card decline mid-subscription relies entirely on Stripe's own subsequent
`customer.subscription.updated` event (status flips to `past_due` then eventually `canceled`)
rather than FollowUp proactively notifying the business or retrying/dunning. `hasActiveAccess()`
correctly locks the account once status changes, so **nothing is billing-broken** — but the
business gets no warning email/in-app notice before losing access, which is a real churn/support
risk once there are enough live customers for card declines to be a routine occurrence rather than
a hypothetical. Stripe's own Smart Retries + Billing emails can cover some of this automatically
if enabled in the Stripe Dashboard's Billing settings — worth checking whether that's turned on
before building custom dunning logic.
Source: general Stripe webhook best-practice guidance, e.g.
https://solvspot.com/blog/stripe-tax-for-saas-2026 (webhook section) — thin source, cross-checked
against Stripe's own documented event list behavior, which is standard/well-known enough not to
need a second citation.

### Sales tax (Stripe Tax) — not yet relevant at current scale, but has a real trigger date
Stripe Tax automates US economic-nexus tracking and VAT/GST for international customers, at a
0.5% per-transaction fee, and it's opt-in (add `automatic_tax` to the Checkout Session — not
mentioned in the billing files I read, so likely not enabled yet). At a single $29/mo flat plan,
FollowUp doesn't have complex tax-tier logic to worry about, but two things are worth tracking:
1. **Economic nexus** is revenue-threshold-based per US state (varies by state, commonly
   $100k/year or 200 transactions) — Stripe Tax can monitor this and alert when a threshold is
   approached, but **only based on revenue processed through Stripe** specifically, so this
   becomes inaccurate if FollowUp ever adds another payment path.
2. **A real, dated policy change**: as of **April 29, 2026**, Stripe changes how it applies tax
   settings to subscription renewals — before that date, subscriptions always used tax-exclusive
   pricing regardless of account settings; after, tax settings actually take effect on renewals
   too. Worth backend-agent confirming this transition didn't silently change what FollowUp's
   customers are charged, since today's date (per this session) is already past that trigger date.
Source: https://www.galvix.com/article/stripe-sales-tax-automation-guide/ — this is a single
source on a fairly specific dated claim; flagging it as worth a second, more authoritative check
(Stripe's own changelog) before treating the April 29, 2026 date as certain, since I could not
independently verify it against a first-party Stripe source in this pass.

**Recommendation**: Not urgent at current customer count (a handful of US customers at $29/mo is
far from any state's nexus threshold), but flip on Stripe Tax proactively once approaching
meaningful US-wide adoption or the first non-US customer — it's a low-effort dashboard toggle,
not a code project, given the Stripe SDK is already integrated.

## Should do before scale, not before launch
- **Webhook retry/idempotency**: confirm the webhook handler is idempotent (Stripe retries
  undelivered webhooks, so the same event can arrive twice) — `syncSubscription` appears to be a
  straightforward upsert-style write keyed by `businessId`/`stripeCustomerId`, which is likely
  already safe to receive twice, but worth an explicit test rather than an assumption.
- **Basic invoice/receipt requirements**: Stripe generates these automatically on subscription
  billing; no action needed unless FollowUp wants custom branding on them (cosmetic, not
  compliance).

Sources checked 2026-09-06:
- https://solvspot.com/blog/stripe-tax-for-saas-2026
- https://www.galvix.com/article/stripe-sales-tax-automation-guide/
- https://zamp.com/blog/best-sales-tax-platforms-stripe (cross-check on nexus-monitoring behavior)
