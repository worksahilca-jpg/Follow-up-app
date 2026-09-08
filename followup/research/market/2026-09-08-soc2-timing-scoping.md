# SOC 2 timing for FollowUp — is it premature, and what does groundwork now look like

Checked: 2026-09-08. Scoping pass per `PRODUCT_DIRECTION.md` Rule 3 ("Trust is a feature — ship it
like one"). FollowUp handles real customer PII (lead contact info, message content, encrypted
credentials for connected Gmail/Twilio/Instagram/WhatsApp accounts) across many third-party
integrations already researched in `research/integrations/`. This pass asks: when do comparable
early-stage B2B SaaS companies typically pursue SOC 2, what does it cost/take, and is it premature
for FollowUp right now.

**WebFetch is blocked; findings are WebSearch-snippet-sourced from compliance-automation vendors
(Vanta, Drata, Workstreet, etc.) and compliance-consulting content, i.e. mostly grade C
vendor-published material with a self-interest in selling SOC 2 services — read the numbers as
directional, not audited.**

## Where FollowUp sits, per its own repo

`PRODUCT_DIRECTION.md`'s "Where we are right now" section (2026-09-07) describes Point 4's
autonomy default as pending "after real customers have watched Assisted work" and elsewhere frames
things in terms of what's "built" and "closed in code" rather than describing an active paying
customer base or enterprise pipeline. Nothing in the file names a revenue stage, funding stage, or
named enterprise prospect. Taken at face value, FollowUp reads as **pre-revenue-to-very-early**,
still validating the product with real users rather than running an enterprise sales motion. That
matters directly for the timing question below — most of what was found ties the right SOC 2 moment
to sales-motion stage (is an enterprise deal actually blocked on it?), not to how sensitive the data
handled is in the abstract.

## When comparable companies pursue it

**General pattern found across several compliance-vendor guides (Workstreet, Comp AI, SureCloud,
soc2auditors.org), consistent with each other:**

- **Pre-seed / pre-product-market-fit: not needed.** Multiple sources state plainly that SOC 2 is
  "usually overhead you don't need yet" at this stage "unless a specific enterprise pilot requires
  it" — it's explicitly framed as a market/procurement requirement, not a legal one, so with no
  enterprise buyer asking, there's no forcing function.
- **Seed / early traction with mostly SMB customers: still usually not needed.** One source frames
  it as "Series A and Seed companies can usually stop at [nothing, or at most] Type 1 for now" —
  i.e. even companies with some traction don't need a Type 2 report unless mid-market/enterprise
  buyers are already in the pipeline asking for one.
- **The trigger is a specific blocked deal, not a maturity milestone.** The clearest framing found:
  "the ROI math only works when there is a deal or procurement process actively blocked by the
  absence of a report. If no enterprise prospect has asked for it, that money is better spent on
  product." This is stated across multiple sources in slightly different words, suggesting it's a
  fairly settled piece of startup-compliance conventional wisdom, not one vendor's opinion.
  **[Grade C — vendor-published guides converge on this framing, but they're also the parties
  selling the compliance tooling, so there's some tension between "don't do this yet" advice and
  their own commercial interest — worth noting as a point in favor of the advice being genuine
  rather than a sales pitch, since it argues against urgency.]**
- **Regulated-industry customers (fintech, healthtech, legaltech) are called out as needing to skip
  straight to Type 2 early**, because those buyers' own compliance obligations force the question
  regardless of the vendor's stage. FollowUp's ICP (home services, realtors, small-business
  verticals per `research/customers/2026-09-05-icp-pain-and-trust-objections.md`) is not in this
  category — its own customers are small businesses, not regulated enterprises buying on FollowUp's
  behalf, which further supports "not yet" for FollowUp specifically. Worth flagging as an open
  question, not confirmed here: if FollowUp ever sells into a **franchise group or larger
  multi-location operator** (a segment `research/market/` docs mention as adjacent to the core
  SMB ICP), that buyer's own procurement process could import an enterprise-style compliance
  requirement even though FollowUp's typical customer wouldn't ask.

## What it costs and takes, if/when pursued

**Type 1 vs Type 2, and the modern default:**
- Type 1 (point-in-time control design review) is faster/cheaper — roughly 2–6 months, audit fees
  in the $10,000–$30,000 range **[Grade C, Drata/Workstreet-style guides]** — but is being
  increasingly skipped: one source states "around 70% of organizations pursuing SOC 2 skip Type 1
  entirely and go directly to Type 2 after a 3–6 month control practice period," because Type 2 (an
  observation period proving controls actually operated, typically 3–12 months) is what most
  mid-market/enterprise procurement actually wants — Type 1 alone is increasingly treated as a
  stopgap to unblock a deal in progress, not an end state.
- **All-in cost estimate, platform + auditor + implementation**, converging across several
  sources: **roughly $45,000–$70,000 total** for a first SOC 2 (Type 2) cycle. Compliance-automation
  platform subscriptions alone: Vanta roughly $10,000/yr entry tier up to far more with add-on
  frameworks; Drata starting around $3,000/yr for startups, more realistically $7,500+ once add-ons
  are included. **[Grade C — vendor list-price/estimate ranges, not verified against an actual
  FollowUp-sized quote; real negotiated pricing for an early-stage startup is often lower than list,
  per the same sources' own "how to negotiate" content, which is itself a signal these numbers are
  ceiling estimates, not floors.]**
- **The understated cost is engineering/founder time, not the invoice.** Multiple sources call this
  out specifically: "the hidden line item is months of a founding engineer's attention... pre-A,
  engineering time is the scarcest asset you own." For a small team like FollowUp's, this is
  probably the more binding constraint than the dollar figure — every week spent on access-review
  policies and evidence collection is a week not spent on Phase C (languages/platforms) or Phase D
  (autonomy by default), the items `PRODUCT_DIRECTION.md` itself names as next.

## Recommendation

**Premature to start the formal process (buying Vanta/Drata, engaging an auditor) right now** —
this matches the general pattern above cleanly: no enterprise deal is named anywhere in the repo as
blocked on a compliance report, and the repo's own "where we are" framing reads as pre-revenue/early
validation, not an active enterprise sales motion. Starting the formal audit clock now would trade
scarce engineering time against Phase C/D work that's more directly tied to the product actually
working, with no known deal on the other side of the trade to justify it.

**Cheap groundwork worth doing now, independent of when the formal process starts** — because it
overlaps with Rule 3's actual ask ("explicit, user-visible guarantee... plus a test proving it"),
this is arguably already partially in scope rather than a SOC 2-specific tangent:
1. Most of SOC 2's control domains (access control, encryption at rest/in transit, change
   management, incident response, vendor risk) are things a security-conscious product should have
   regardless of the audit — `PRODUCT_DIRECTION.md` already claims "credentials encrypted at rest,
   admin-only settings" and an "audit trail of every action" exist in code, which is a real head
   start if true. A lightweight self-assessment against a public SOC 2 Trust Services Criteria
   checklist (free, no vendor engagement needed) would show how much of the groundwork already
   exists vs. what's missing, without spending a dollar or committing to a timeline.
2. Keep a running written record of security decisions as they're made (the encrypted-credentials
   design, the risk-gate-before-autonomous-send design, the pentest-vendor research already done in
   `research/market/2026-09-08-pentest-vendor-options.md`) — this becomes exactly the evidence a
   Type 2 audit period needs later, so documenting it contemporaneously (which the repo already does
   reasonably well via `research/`) is nearly free now and expensive to reconstruct retroactively.
3. **The actual trigger to watch for**: the first real prospect (especially any franchise/multi-
   location operator, or the first customer big enough to have its own vendor-security
   questionnaire) that asks "do you have SOC 2" or sends a security questionnaire. That's the signal
   to start the formal Type 1 clock, not a calendar date or headcount milestone.

Sources checked 2026-09-08 (all via WebSearch; none WebFetch-verified):
- https://www.workstreet.com/blog/when-to-get-soc-2
- https://www.workstreet.com/blog/soc-2-for-startups
- https://drata.com/learn/soc-2/type-1-vs-type-2
- https://www.scrut.io/hub/soc-2/soc-2-type-1-vs-soc-2-type-2
- https://soc2auditors.org/guides/is-soc-2-worth-it-for-pre-seed-startups/
- https://www.trycomp.ai/hub/when-to-get-soc-2
- https://www.surecloud.com/blog-hub/soc-2-for-startups
- https://getagency.com/soc-2-before-series-a
- https://cavanex.com/blog/soc-2-compliance-cost-2026
- https://soc2auditors.org/insights/soc-2-software-pricing-comparison/
