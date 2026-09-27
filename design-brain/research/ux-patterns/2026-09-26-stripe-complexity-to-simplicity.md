# Stripe: a deep product introduced without its complexity, and what FollowUp takes

**Asked by:** the founder, 2026-09-26: *"Stripe ... complexity to simplicity. How to introduce a very deep product
without exposing all complexity at once. Do the research, and let's try to implement the same thing."*
**Method:** WebSearch summaries; stripe.com and docs.stripe.com can't be fetched from this session.
**Grades:** B = search summary of Stripe's own docs or site; C = third-party write-up.

## What Stripe does

| Principle | How Stripe does it | Grade |
|---|---|---|
| **The first layer is complete on its own** | Payment Links: a full payment page "in just a few clicks", no code. Then Checkout (hosted), then the API. Three depths of one product, and nobody has to start at the deep end. | B (Payment Links docs) |
| **Ask the minimum to move one step** | Onboarding asks only what's needed to advance (country, business name first). Everything else comes later, when the context calls for it. | C (Perspective AI, LoginRadius write-ups) |
| **Defaults that already work** | Radar screens every payment with machine-learning default rules from day one. Custom rules exist only "for businesses that need more control". | B (Radar rules docs) |
| **A safe place to try** | Test mode and sandboxes: try everything with no real money moving. | B (Sandboxes docs) |
| **Quickstart, then advanced** | Each product has a quickstart; "design an advanced integration" sits underneath it. | B / C (Stripe docs, Moesif teardown) |
| **Depth added over time** | Stripe nailed payments first, then added Connect, Radar, Atlas, Capital and more, each one a layer on a core that already worked. | C |

## FollowUp's layers (proposed)

1. **Layer 1, complete on its own:** connect one inbox, then Today shows real customers with their replies written and
   a Send button. Nothing else is required to get value. This is the proof screen (A-027 area) and the one job
   (Calendly study).
2. **Layer 2, when they come back:** the follow-up plan card (change the days) and the "send simple replies by
   themselves" switch.
3. **Layer 3, only for those who look:** source rules, workflows, CRM sync, webhooks, the voice agent and team settings,
   all under "More settings".

## What to build from it

- **A. Ask when it matters, not up front (Stripe's minimum-per-step).** Don't ask for prices, hours or services at
  sign-up. The first time a reply needs one, ask right there in one line: "Priya asked for a bathroom price. What do you
  usually charge?" The answer is saved for next time.
- **B. A safe first try (Stripe's test mode).** On the first screen after connecting, offer "Send yourself a test
  message". The owner sees the whole loop (message → written reply → Send) on themselves, with no real customer at
  risk. The pieces already exist: the "send a test lead to myself" route, and the landing page's "Try it" box.
- **C. Defaults explained in one line (Radar).** Every held reply already says why it waits. Every default in Settings
  should too: "Anything about price waits for you, because a wrong number costs you the job."
- **D. Settings in three layers.** This already matches the phone Settings design (plan card, sources, sending, then
  "More settings"). The live app's Settings still shows everything at once.

## Not taken

Stripe's audience includes developers, so its deepest layer is an API. FollowUp's deepest layer is still something an
owner can use without help: no code, no API keys.

## Sources

- Stripe, Payment Links: https://docs.stripe.com/payment-links
- Stripe, Radar rules: https://docs.stripe.com/radar/rules
- Stripe, Sandboxes: https://docs.stripe.com/sandboxes
- Stripe, Quickstarts: https://docs.stripe.com/quickstarts
- Perspective AI, Stripe onboarding philosophy (C): https://getperspective.ai/blog/stripe-ai-customer-onboarding-philosophy-lessons-from-a-conversion-obsessed-company
- Moesif, Stripe developer experience teardown (C): https://www.moesif.com/blog/best-practices/api-product-management/the-stripe-developer-experience-and-docs-teardown/
