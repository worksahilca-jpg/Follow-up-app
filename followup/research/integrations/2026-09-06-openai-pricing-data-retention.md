# OpenAI — pricing, rate limits, data retention for scoring + drafting

Checked: 2026-09-06. Current wiring: `src/lib/integrations/openai.ts` is real — calls
`gpt-4o-mini` via Structured Outputs for lead scoring (`SCORE_JSON_SCHEMA`, strict JSON schema)
and for reply drafting. `package.json` pins `"openai": "^7.8.0"`.

## Nothing here is a hard blocker — this integration is in decent shape. Two things worth doing before scale.

### Pricing at current model choice
`gpt-4o-mini`: **$0.15/1M input tokens, $0.60/1M output tokens** ($0.075/1M for cached input).
Source: https://devtk.ai/en/models/gpt-4o-mini/ , cross-checked against
https://intuitionlabs.ai/articles/chatgpt-api-pricing-2026-token-costs-limits (consistent).
128K context window, up to 16K output tokens/request. For a per-lead scoring call (a short
transcript in, a small structured JSON out) plus a drafting call, this is genuinely cheap — even
at thousands of leads/day this stays well under $1-2k/month in raw API cost, so cost is not the
concern; rate limits and retention settings are.

### Rate limits scale with cumulative spend tier, not a flat cap
OpenAI's usage tiers unlock automatically as an account's total historical spend crosses
thresholds (free tier starts around 500 RPM for a model like `gpt-4o-mini`; paid tiers unlock
materially higher RPM/TPM as spend crosses tier thresholds, up to enterprise-scale limits).
Source: https://www.finout.io/blog/openai-pricing-in-2026 . **Actionable point:** FollowUp's
account should be checked against its actual current usage tier in the OpenAI dashboard
(Settings → Limits) as real customer volume grows — a burst of scoring calls during, say, a bulk
CSV import (already a supported lead-entry path per growth-agent's channel list) could hit a rate
limit on a still-low tier and cause scoring to silently queue or fail. This is a "watch it, don't
panic about it" item, not something requiring action today.

### Data retention / training opt-out — the setting that actually matters for a customer-facing product
Two genuinely separate things, worth not conflating (a common mistake per the sources):
1. **Training opt-out**: OpenAI API business/enterprise accounts default to **not** using
   submitted data to train models — this should already be the default for FollowUp's account
   type, but it's worth explicitly confirming in the OpenAI org settings (Data controls) rather
   than assuming, since older/consumer-linked accounts can default differently.
2. **Data retention** (separate from training): by default, API inputs/outputs are retained for
   **30 days** for abuse-monitoring purposes even when training is off. **Zero Data Retention
   (ZDR)** is available on request for qualifying use cases/endpoints and removes even that
   30-day window — content is deleted essentially immediately after the request completes and is
   never available for human review.
Source: https://openai.com/index/offering-zero-data-retention-for-frontier-models/ ,
https://openai.com/enterprise-privacy/ (both official OpenAI pages, high confidence).

**Recommendation:** FollowUp is processing real sales-lead conversation content (potentially
containing customer PII — names, phone numbers, deal details) through `classifyAsProspect()` and
the drafting path. Before this scales to real customer volume, it's worth (a) confirming
training-opt-out is actually set at the org level, not just assumed by account type, and (b)
applying for Zero Data Retention if FollowUp's use case qualifies — this is a real trust/privacy
selling point (`src/app/privacy/page.tsx` could then make a specific, verifiable claim about it)
and a genuine risk-reduction step, not just a compliance checkbox, given some of FollowUp's
customers' leads will include people who never explicitly agreed to have their conversation sent
to a third-party model provider.

## Should do before scale, not before launch
- Add basic retry/backoff and a rate-limit-aware queue around the scoring calls in
  `openai.ts` if not already present (I did not find explicit rate-limit handling in the section
  read — backend-agent should confirm) — this becomes relevant only once volume approaches the
  account's current tier ceiling, not before.
- Track OpenAI usage tier as a config value being monitored, since crossing to real-volume
  customers will likely require a tier bump (a spend threshold that's typically self-serve, not a
  support request) — mostly an operational note, not a code change.

Sources checked 2026-09-06:
- https://devtk.ai/en/models/gpt-4o-mini/
- https://intuitionlabs.ai/articles/chatgpt-api-pricing-2026-token-costs-limits
- https://www.finout.io/blog/openai-pricing-in-2026
- https://openai.com/index/offering-zero-data-retention-for-frontier-models/
- https://openai.com/enterprise-privacy/
