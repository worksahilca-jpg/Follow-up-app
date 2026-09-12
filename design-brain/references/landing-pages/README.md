# References — Landing pages

Marketing sites, pricing pages, positioning, trust signals, conversion.

## What to look for here

- **The first 100 words.** How quickly a visitor understands what the product does, for
  whom, and why it matters.
- **Trust construction** — how a serious B2B product proves it's real: specificity,
  named customers, honest screenshots, clear pricing, visible company.
- **How the product is shown.** Real screenshots vs. abstracted illustration, and which
  builds more confidence.
- **Pricing page clarity**, especially for a product with usage-based or per-seat pricing.
- **Where the marketing voice differs from the product voice**, and how much.

## The FollowUp-specific question

FollowUp sells to people who have been pitched *hard* by lead-gen tools, AI sales
automation, and outright spam vendors. **Our landing page's job is to look like the
opposite of that category** — calm, specific, provable. Study references for restraint and
proof, and be alert to the fact that high-converting SaaS landing pages often use exactly
the manufactured-urgency devices we've ruled out.

## Note on scope

The landing page (`followup/src/app/page.tsx`) is implemented by `frontend-3d-agent`
(copy and positioning come from `product-ux-agent`) in the current agent roster. It
now shares the product's typeface and palette, which is the right call — a visitor
and a customer should feel they're in one product. Marketing has more latitude on
motion and visual flourish than the authenticated app does; it has none
on the standing rejections in `decisions/rejected.md`.

## Anti-patterns to notice and name

Gradient hero + floating 3D mockups; "AI-powered" as the headline; fake urgency ("only 3
spots left"); testimonials with no name or company; hidden pricing; a demo that's a form.
