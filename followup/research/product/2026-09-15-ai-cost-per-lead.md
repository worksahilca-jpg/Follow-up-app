# What the AI actually costs: per lead, per customer, per month

**Date:** 2026-09-15
**Scope:** every OpenAI call FollowUp makes on the platform's own shared API key, what one lead
costs end to end, what one customer costs per month, where the waste is, which paths are guarded,
and whether any pricing tier loses money.
**Nothing in this document changed application code.** It is measurement and analysis only.

**Builds on, does not repeat:** `research/integrations/2026-09-06-openai-pricing-data-retention.md`
(rate limits, retention, ZDR — still accurate, not re-derived here) and
`research/market/2026-09-11-tier-pricing-recommendation.md` §5 (the cost model this document is
the measurement of). The competitor and pricing-shape reasoning is not reproduced.

---

## 0. Method, and how much to trust each number

**Three different kinds of number appear below. They are not equally solid.**

| Kind | How it was produced | Confidence |
|---|---|---|
| **Token counts** | *Measured*, not guessed. The real prompt-assembly code was executed with a stubbed OpenAI client that captured the exact request body, and every message was tokenized with the `o200k_base` encoding that `gpt-4o-mini` uses (`gpt-tokenizer`, installed in a scratch directory, not in the repo). | **High** for the fixed parts of each prompt — these are the literal strings the model receives. |
| **Conversation sizes** | *Modelled.* Three thread shapes (below) chosen to bracket real usage. No production conversation data exists to sample from. | **Medium** — the shapes are stated explicitly so they can be swapped for real ones. |
| **Prices** | *Third-party verified, not vendor-verified.* OpenAI's own pricing pages (`platform.openai.com`, `developers.openai.com`) are **EGRESS_BLOCKED** from this environment — both returned a hard block, not a timeout. See §9. | **Medium-high** — multiple independent trackers agree with each other and with this repo's two prior pricing passes. |

**Snapshot.** All token counts were measured against `src/lib/integrations/openai.ts` at
`md5 7a2facd83b1c4898bc941bc0864a000b` (63,363 bytes, 1,157 lines) — the revision landed by commit
`f50d9ad` *"Make the drafts sound typed, not generated"*, which was uncommitted in the working tree
when I started measuring and committed before I finished. **This file is actively being edited
right now.** During
this analysis the drafting system prompt grew from 901 to 1,274 tokens and the instant-reply
prompt from ~730 to 1,135 tokens, inside about an hour — that is `f50d9ad` landing while I
measured, not drift in my method; both figures are real readings taken either side of it.
Every "fixed prompt" number below is therefore a reading taken at one moment on a rising line, not
a constant. That is itself a finding — see §5.6.

### 0.1 The price variables

Everything is computed from two named variables so the arithmetic survives a price change:

```
P_in    = price per input token
P_out   = price per output token
cost(call) = tokens_in × P_in + tokens_out × P_out
```

Values used, for `gpt-4o-mini` (the model named in `MODEL`, line 12 of `openai.ts`):

```
P_in  = $0.15 / 1,000,000 tokens  = $0.00000015
P_out = $0.60 / 1,000,000 tokens  = $0.00000060
P_in(cached) = $0.075 / 1,000,000 tokens   (see §5.4 — not currently benefiting FollowUp)
```

Checked 2026-09-15 via WebSearch; consensus across several independent trackers (OpenRouter,
pricepertoken.com, devtk.ai, langcopilot, CloudZero) and unchanged from the values this repo
recorded on 2026-09-06 and re-verified on 2026-09-11. **I could not confirm this against OpenAI's
own published page from this environment** (egress blocked). If you want a hard number, the
one-minute check is the OpenAI dashboard's own pricing page or a $1 test spend against the real
key — see §8.

Audio, for the voicemail path: `gpt-4o-mini-transcribe` at **~$0.003/minute** (or $1.25/1M input,
$5.00/1M output tokens if billed per token). Same sourcing caveat. Grade C.

### 0.2 The three thread shapes

Named `short` / `mid` / `long` throughout. These are **modelling assumptions**, derived as follows:

| Shape | What it is | Why this size |
|---|---|---|
| **short** | 1 inbound message, 220 characters | A first-contact web-form/SMS/DM message. `research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md` Finding 1 documents that the canonical first messages ("is it still available?", "what's the price?", "when can I tour?") are **short** — a sentence or two. 220 chars is a generous one-to-two-sentence message. |
| **mid** | 4 messages (600/600/500/550 chars) | A normal email back-and-forth after one reply each way. 500–600 chars ≈ 3–4 sentences, the length of a real quote-request email. |
| **long** | 12 messages × 700 chars = 8,400 chars | Deliberately **over** `MAX_TRANSCRIPT_CHARS` (8,000, `openai.ts` line 47) so it measures the *capped worst case* — the most any transcript can ever cost, because `formatTranscript()` drops oldest lines until it fits. |

`long` is the ceiling for `scoreLead`, `generateFollowUpMessage` and `assessSendRisk`, which send
the whole (capped) transcript. `classifyAsProspect` (first 3 messages, de-quoted, 1,200 chars
each) and `classifyThreadOutcome` (first + last 3, de-quoted, 1,200 chars each) have their own,
much tighter caps, which is why their `long` column barely rises — that trimming already works.

---

## 1. Every OpenAI call, and how often it fires

Nine functions in `src/lib/integrations/openai.ts` reach the API. All nine use `MODEL =
"gpt-4o-mini"` except `transcribeAudio`, which uses `gpt-4o-mini-transcribe`. **There is no other
OpenAI client anywhere in `src/`** (grep-verified: every call site imports from this one module).

| # | Function | Called from | Trigger | Times per lead, over the lead's life |
|---|---|---|---|---|
| 1 | `classifyAsProspect` | `integrations/gmail.ts:604`, `integrations/outlook.ts:398`, `api/leads/cleanup/route.ts:114` | A mailbox sync sees a thread it has never stored. Cached hard: known threads and previously-rejected threads (unless a new message arrived) skip it entirely. | **1** for a mailbox lead, 0 for every other channel. Plus 1 more *per `leads/cleanup` run* (§5.2). |
| 2 | `generateInstantReply` | `acknowledge.ts:225` | Every brand-new lead with an inbound message, within a minute of capture. Atomically once-per-lead (`Lead.acknowledgedAt`). | **1** |
| 3 | `assessAckRisk` | `acknowledge.ts:241` | Straight after #2, unless the lead is `AUTONOMOUS`. | **1** (0 for AUTONOMOUS) |
| 4 | `localizeFixedText` | `sender.ts:74` (inside `composeFollowUpEmail`), `acknowledge.ts:328/331/333` | Once per composed email frame, plus 1–2 more on the ack fallback path. Fires whenever the lead has written anything at all — **including when the lead wrote English**. | **1 per drafted email** + 1 per ack + up to 2 more on fallback |
| 5 | `scoreLead` | `scoring.ts:62` | `scoreAndDraftForLead()`, which every capture path calls: all 4 Twilio webhooks, Instagram/Messenger webhook, embed form, generic webhook, test lead, CRM sync, Gmail/Outlook sync (per *touched* lead), spam-scan restore, and the unscored sweep. | **1 per inbound message** |
| 6 | `generateFollowUpMessage` | `scoring.ts:69`, `automation.ts:483`, `sequences.ts:566`, `reactivationSend.ts:99`, `api/leads/[id]/regenerate/route.ts` | Paired with #5 on every capture; again per automation cycle for unanswered/dead leads; again per sequence step; again per reactivation send; again per manual "regenerate" click. | **1 per inbound message, plus 1 per automation/sequence/reactivation event** |
| 7 | `assessSendRisk` | `automation.ts:503`, `sequences.ts:588` | Before any automated send that isn't an `AUTONOMOUS` lead. | **1 per automation cycle the lead is eligible for** (not once — see §5.1) |
| 8 | `classifyThreadOutcome` | `reactivation.ts:326` | Quiet-lead verdict, once per lead ever (`quietOutcome` is permanent), paid businesses only. | **1**, at most |
| 9 | `transcribeAudio` | `api/twilio/voice/transcription/[secret]/route.ts:65` | One voicemail recording. | **1 per voicemail** |

**The thing to notice in that table:** #5, #6 and #4 are a bundle — `scoreAndDraftForLead()` always
does all three — and the bundle fires **once per inbound message**, not once per lead. A lead who
sends four messages costs four score+draft+localize bundles even if the owner replies by hand
every time and never looks at a single generated draft.

---

## 2. Measured token counts and per-call cost

Input tokens include the system prompt, the user message, and the JSON schema sent in
`response_format` (schema text is billed as input — consistent across the structured-output
write-ups found via WebSearch 2026-09-15, Grade C, and in any case it is only 137–313 tokens
here). Output tokens are the measured size of a realistic structured response.

### 2.1 Fixed overhead (the part that does not depend on the lead at all)

| Call | System prompt | JSON schema | Fixed total |
|---|---|---|---|
| `scoreLead` | 223 | 158 | **381** |
| `generateFollowUpMessage` (no voice samples) | 1,274 | 187 | **1,461** |
| `generateFollowUpMessage` (+5 voice samples) | 2,106 | 187 | **2,293** |
| `assessSendRisk` | 424 | 210 | **634** |
| `classifyAsProspect` | 506 | 137 | **643** |
| `classifyThreadOutcome` | 457 | 313 | **770** |
| `generateInstantReply` | 1,135 | 67 | **1,202** |
| `assessAckRisk` | 645 | 145 | **790** |

For a first-contact lead — the single most common shape in this product — the 220-character
message is ~55 tokens and the instructions wrapped around it are 1,202–2,293. **The prompt is
20–40× the size of the thing being reasoned about.**

### 2.2 Input / output tokens per call, by thread shape

| Call | short in/out | mid in/out | long (capped) in/out |
|---|---|---|---|
| `scoreLead` | 486 / 50 | 975 / 50 | 2,127 / 50 |
| `generateFollowUpMessage` (+voice) | 2,392 / ~80 | 2,881 / ~80 | 4,033 / ~80 |
| `generateFollowUpMessage` (no voice) | 1,560 / ~80 | 2,049 / ~80 | 3,201 / ~80 |
| `assessSendRisk` | 774 / 17 | 1,263 / 17 | 2,415 / 17 |
| `classifyAsProspect` | 772 / 17 | 1,131 / 17 | 1,224 / 17 |
| `classifyThreadOutcome` | 923 / 15 | 1,412 / 15 | 1,536 / 15 |
| `generateInstantReply` | 1,290 / 25 | — | — |
| `assessAckRisk` | 906 / 15 | — | — |
| `localizeFixedText` (email frame) | 208 / 7 | — | — |

*Output tokens are the one estimate in this table.* The JSON bodies shown are measured
(`scoreLead` 50, `classifyAsProspect` 17, `assessSendRisk` 17, `classifyThreadOutcome` 15,
`assessAckRisk` 15, `localizeFixedText` 7, a sample draft 48). For drafts I use **80** rather than
48, because a real 2–4 sentence body plus subject runs longer than the sample. The hard ceiling is
`max_tokens: 260` — if every draft ran to the cap, drafts would cost $0.00011 more each, which
moves the per-lead total by under 10%. Output is not where the money is.

### 2.3 Cost per call

`cost = tokens_in × $0.00000015 + tokens_out × $0.00000060`

| Call | short | mid | long |
|---|---|---|---|
| `scoreLead` | $0.000103 | $0.000176 | $0.000349 |
| `generateFollowUpMessage` (+voice) | **$0.000407** | **$0.000480** | **$0.000653** |
| `generateFollowUpMessage` (no voice) | $0.000282 | $0.000355 | $0.000528 |
| `assessSendRisk` | $0.000126 | $0.000200 | $0.000372 |
| `classifyAsProspect` | $0.000126 | $0.000180 | $0.000194 |
| `classifyThreadOutcome` | $0.000147 | $0.000221 | $0.000239 |
| `generateInstantReply` | $0.000208 | — | — |
| `assessAckRisk` | $0.000145 | — | — |
| `localizeFixedText` | $0.000035 | — | — |

Drafting is the most expensive call in the system by a factor of 2–4 over everything else.

---

## 3. What one lead costs, end to end

### Lead A — a realistic email lead, full life

Arrives in Gmail → triaged → instant-acked → scored + drafted → replies once (re-scored,
re-drafted) → goes quiet → automation drafts/holds → later judged for cold outcome.

| Step | Call | Cost |
|---|---|---|
| Gmail sync triage | `classifyAsProspect` / short | $0.000126 |
| Instant ack, generated | `generateInstantReply` / short | $0.000208 |
| Instant ack, safety gate | `assessAckRisk` / short | $0.000145 |
| Instant ack, email frame | `localizeFixedText` | $0.000035 |
| Capture scoring | `scoreLead` / short | $0.000103 |
| Capture drafting | `generateFollowUpMessage` / short | $0.000407 |
| Draft email frame | `localizeFixedText` | $0.000035 |
| Lead replies → re-score | `scoreLead` / mid | $0.000176 |
| Lead replies → re-draft | `generateFollowUpMessage` / mid | $0.000480 |
| Draft email frame | `localizeFixedText` | $0.000035 |
| Automation, silence rule | `assessSendRisk` / mid | $0.000200 |
| Quiet-lead verdict | `classifyThreadOutcome` / mid | $0.000221 |
| **Total — 12 calls** | | **$0.00217** |

### Lead C — captured, acked, scored, never touched again

7 calls, **$0.00106**. This is the most common lead in the product.

### Lead D — a dormant thread imported on the first sync

`classifyAsProspect` (long) + `scoreLead` (long) + `generateFollowUpMessage` (long) +
`localizeFixedText` + `classifyThreadOutcome` (long) = 5 calls, **$0.00147**.

### Lead E — a reactivation message the owner approves

Adds `generateFollowUpMessage` (long) + `localizeFixedText` = **$0.00069** on top of D.

### Lead B — the expensive one: a held lead nobody approves

See §5.1. **$0.0257/month, indefinitely** — 12× lead A's entire life, per month, forever.

**Headline: a lead costs $0.001–0.002 in OpenAI spend.** A lead nobody ever approves costs
$0.026/month for as long as it sits there.

This *measures* what `research/market/2026-09-11-tier-pricing-recommendation.md` §2.1 *estimated*
("~$0.001–0.002/lead"). That estimate was right.

---

## 4. Cost per customer per month

| Customer | Mix assumed | AI text cost/mo |
|---|---|---|
| **Solo trade, 30 leads/mo** | 10 full-life (A) + 20 capture-only (C) | **$0.043** |
| **Small team, 150 leads/mo** | 50 full-life + 100 capture-only | **$0.215** |
| **First-sync spike, 200 dormant leads** | 200 × Lead D, one time | **$0.294** |
| …plus a 40-lead reactivation send | + 40 × Lead E | **$0.322** |

The mix (1 in 3 leads gets a reply and a full life) is an assumption. Shifting it to *every* lead
being full-life makes the 150-lead customer $0.33/mo instead of $0.215. It does not change any
conclusion.

**Cross-check against the pricing doc's §5.2 estimates** — which were built top-down, before any
measurement:

| | Pricing doc estimate | Measured here | |
|---|---|---|---|
| Free, 20 leads/mo | $0.02–0.04 → $0.03 | **$0.032** | ✅ |
| Plus, 300 leads/mo | $0.30–0.60 → $0.45 | **$0.43** | ✅ |
| Pro, 700 leads/mo | $0.70–1.40 → $1.05 | **$1.00** | ✅ |

The cost model in that document is validated. No pricing conclusion in it needs revisiting on AI
cost grounds.

**The first-sync spike is a non-event.** 200 dormant leads classified, scored, drafted and judged
costs **29 cents, once.** It is a *latency* and *rate-limit* concern (see the 2026-09-06 note on
usage tiers), not a cost one.

---

## 5. Where the waste is, ranked by dollars

Ranked by what each would actually save, not by how interesting it is. The honest summary: **items
1 and 2 are real money; items 3–6 are pennies that matter only at 1,000+ customers.**

### 5.1 The 20-hour re-draft/re-risk loop on held leads — the single biggest waste

`runAutomationForBusiness()` (`automation.ts`) runs hourly (`vercel.json`). A lead is re-eligible
once `lastAutomationCheckedAt` is older than **20 hours** (`automation.ts:284`). When a lead is
*held* rather than sent — which is the correct, deliberate behaviour for any `medium`/`high` risk
verdict and for **every cold lead**, by the founder's 2026-09-15 call — nothing about that lead
changes: no outbound message is sent, `lastContacted` does not move, the stage does not move. So
it is eligible again 20 hours later, and the cycle repeats **forever**, on a conversation and a
draft that are byte-for-byte identical to last time.

For a lead in the **unanswered** or **dead-lead** bucket it is worse, because
`automation.ts:479` deliberately distrusts the cached draft for exactly those two cases and
regenerates it:

```
if (!message || isDeadLead || isUnanswered) {
  const draft = await generateFollowUpMessage({ name: lead.name, conversation }, voiceSamples, messageHint);
```

So each 20-hour cycle pays `generateFollowUpMessage` + `localizeFixedText` + `assessSendRisk`:

```
$0.000480 + $0.000035 + $0.000200 = $0.000715 per cycle
× 36 cycles per 30 days                = $0.0257 per lead per month
```

| Stuck leads in the approval queue | Cost/month |
|---|---|
| 1 | $0.026 |
| 10 | **$0.257** |
| 50 | **$1.29** |

**Ten leads sitting unapproved cost more per month than everything else a 150-lead/month customer
does ($0.215).** And the queue of never-approved leads is not an edge case — it is the expected
steady state for a busy trade owner, and the cold-lead hold *guarantees* a permanent population of
them (a cold lead that is held stays cold).

*Why the redraft is there:* the comment above `isUnanswered` explains it — a cached draft can
predate the lead's most recent message, and a live test shipped an English reply to a lead writing
romanized Gujarati. That reasoning is correct. But it justifies redrafting when **new inbound
content has arrived since the cached draft was written**, which is a comparison the code never
makes — it redrafts on *bucket membership*, which does not change between cycles.

**Fix (backend-ai-agent, not small enough for me):** stamp the draft with the id/timestamp of the
newest message it was written against, and skip both the redraft and the risk check when that is
still the newest message. That preserves the guarantee exactly (a new message still forces a fresh
draft) and takes the steady-state cost of a parked lead to **$0**. Failure scenario to test: lead
writes message M1 → draft D1 held → 20h passes with no new message → expected: zero OpenAI calls,
current: 3 calls; then lead writes M2 → expected: full redraft + re-risk.

**Saving: up to ~$0.26/customer/month at 10 stuck leads — i.e. it can more than double a
customer's AI bill, and it is the only per-customer line that grows without bound over time.**

### 5.2 `POST /api/leads/cleanup` re-classifies the entire Gmail backlog, unbounded per run

```ts
const leads = await prisma.lead.findMany({
  where: { businessId: ctx.businessId, source: "Gmail" },
  include: { conversations: { include: { messages: { orderBy: { sentAt: "asc" } } } } },
});
```

No `take`. Every Gmail-sourced lead the business has, every run, one `classifyAsProspect` call
each — **including leads that were classified by the sync ten minutes ago and whose threads have
not changed since.** This is the clearest case of "the same call for the same unchanged input" in
the codebase.

It has a good rate limit (2/hour, `leads.cleanup`) and a correct billing gate (paid only,
`hasActiveAccess` without the tier bypass) — both recent, both verified. But the limit bounds
*runs*, not *work per run*:

| Backlog | Per run | Ceiling at 2 runs/hour, 24h |
|---|---|---|
| 200 leads | $0.04 | $1.86/day |
| 1,000 leads | $0.19 | $9.30/day |
| 5,000 leads | $0.97 | **$46.51/day** (≈$1,395/month, one account, $39 plan) |

This is the only path in the app that can reach real money. It is not a *likely* path — it needs
an admin session hammering the button or a retry loop — but it is the one with no ceiling.

**Two cheap fixes, either sufficient:** (a) skip leads whose thread has not changed since their
last verdict — the same `lastMessageAt` guard `gmail.ts` already uses on `FilteredEmail`, which is
the established pattern; (b) add a `take:` cap and resume across runs, like
`MAX_CLASSIFICATIONS_PER_RUN` in `gmailSync.ts`. **Saving: the entire tail risk of this path.**

### 5.3 Scoring and drafting fire on every inbound message, and drafting is 40% of a lead's cost

`scoreAndDraftForLead()` always does `scoreLead` **and** `generateFollowUpMessage` **and**
`localizeFixedText`. Drafting is $0.000407–$0.000653 of a $0.001–0.002 lead — **~40%** — and it
runs on every inbound message whether or not anyone will ever read the draft. A lead the owner
handles by hand in five messages pays for five drafts, all discarded.

This is a **product** decision, not a bug: a draft waiting on the lead page the instant it opens
is the feel of the product. Worth knowing the price of it:

| Change | Saving for a 150-lead/mo customer | Cost |
|---|---|---|
| Draft lazily (on first view of the lead / on approval) instead of eagerly | **$0.10/mo (45%)** | The draft is no longer already there; a spinner appears |
| Draft only on the *first* inbound message, refresh on demand | ~$0.04/mo (20%) | Stale draft risk — the exact bug §5.1's `isUnanswered` redraft exists to prevent |

**Recommendation: don't.** 45% of $0.215 is ten cents a month. It is the largest *structural*
saving available and it is still not worth the product regression. Revisit only if per-customer AI
cost ever crosses ~$2/month.

### 5.4 The voice-sample block is resent, identical, on every single draft

`getVoiceSamples()` returns up to 5 outbound emails, 500 chars each. Measured: the block adds
**exactly 832 input tokens** to every `generateFollowUpMessage` call — ~30% of the call's input,
$0.000125 each. It is identical for every lead in a business and changes only when the business
sends new mail.

Two independent ways to reduce it:

1. **Prompt caching.** `gpt-4o-mini` publishes a cached-input rate of $0.075/1M — half price. The
   system prompt (fixed instructions + voice block) is a stable per-business prefix and the
   lead-specific content is already in a separate user message, so the layout is *already right*
   for caching. Whether it currently applies depends on OpenAI's minimum cacheable prefix length
   (commonly reported as 1,024 tokens) — **I could not verify that threshold**, because OpenAI's
   docs are egress-blocked here. With voice samples the prefix is 2,106 tokens, comfortably over
   any such threshold; without them it is 1,274. **Action: read the real `usage.prompt_tokens_details.cached_tokens`
   field off a live response — it is one log line and it settles this exactly.**
2. **Fewer / shorter samples.** 3 samples at 300 chars instead of 5 at 500 would cut the block by
   ~64%. Whether draft quality survives that is a question for the drafting owner, not for me.

**Saving: $0.02/mo per 150-lead customer (12% of the bill), or roughly half of that again free if
caching already applies.** Small, but it is pure overhead with no per-lead information in it.

### 5.5 `localizeFixedText` pays a model call to translate "Hi Dana," for English leads

`composeFollowUpEmail()` calls it whenever `languageSample` is non-empty — which is **always**,
for any lead who has written anything. For an English-speaking lead the model is paid $0.000035 to
return the input unchanged. At 3 calls per lead life that is ~5% of a lead's cost and, more
noticeably, ~3 round-trips of latency on a path whose entire promise is "instant".

A cheap pre-filter (ASCII-only *and* two or more common English stopwords → skip the call) would
remove almost all of these with no behaviour change for non-English leads, and the existing
"anything that doesn't come back in the right shape falls back to English" guard already makes a
wrong skip harmless. **Saving: ~$0.01/mo per 150-lead customer. Rank: low on dollars, real on
latency.**

### 5.6 A cheaper model for the classifiers — worth testing on exactly one of them

Four calls are enum/boolean judgments, not writing: `classifyAsProspect`, `classifyThreadOutcome`,
`assessSendRisk`, `assessAckRisk`. Together they are ~$0.00068 of Lead A's $0.00217 (31%).
`gpt-4.1-nano` is reported at $0.10/1M in, $0.40/1M out (WebSearch 2026-09-15, Grade C — not
vendor-verified) — a **33% cut** on those four, ≈$0.00023/lead, ≈$0.03/mo for a 150-lead customer.

**Do not move `assessSendRisk` or `assessAckRisk`.** They are the trust gates that decide whether
an unreviewed message reaches a real prospect, they are prompt-injection targets by design, and
`src/lib/__tests__/prompts.test.ts` asserts their *prompt content*, not their *behaviour* — so a
model swap would pass the suite while quietly degrading the guarantee. Three cents a month is not
a reason to touch them.

`classifyAsProspect` is the defensible candidate: it is cheap to evaluate (a labelled set of
threads, measured precision/recall), a wrong answer is visible and reversible in Settings → Gmail,
and its own doc comment records that its failures were fixed by *trimming input*, not by a bigger
model. **Even so: $0.01/mo. Rank last.**

### 5.7 Two smaller things worth writing down

**A failed draft throws away a paid score.** In `scoreAndDraftForLead()`, `scoreLead` and
`generateFollowUpMessage` both complete before the single `prisma.lead.update`. If drafting throws
— `generateFollowUpMessage` throws on its own on an empty body — the score is discarded and
`scoreReason` stays null. `scoreUnscoredLeads()` in `gmailSync.ts` then re-picks that lead on
**every sync tick, every 10 minutes**, re-paying for the score each time. A lead that fails to
draft persistently costs ~$0.07/day (144 ticks × $0.0005) forever. This is the retry/self-healing
loop that re-pays for the same answer. **Fix: persist the score before drafting.** Small and
contained, but it is in `src/` and two other agents are working there, so it goes to
backend-ai-agent rather than being done here.

**A push sync and a cron sync can double-score the same lead.** `touched` is computed from
`existingLead.lastContacted` before either run writes it (`gmail.ts` ~line 645). The window is
narrow and the cost is one bundle ($0.0006), and `syncGmailForBusinessFromPush` already holds a
3-minute per-business lock that covers push-vs-push. Noted for completeness, not worth fixing on
cost grounds.

### 5.8 What is *not* wasteful (verified, so nobody re-audits it)

- **`classifyAsProspect` caching is genuinely good.** Known threads (`Conversation.externalId`)
  and previously-rejected threads with no new message (`FilteredEmail.lastMessageAt`) both skip the
  call. A daily deep pass over a 90-day inbox costs Gmail reads, not OpenAI spend — the comment in
  `gmailSync.ts` claiming this is accurate.
- **`classifyThreadOutcome` is once-per-lead-ever**, claimed atomically with a stale-claim guard
  that also discards a late verdict rather than overwriting a fresh one. Two overlapping runs
  cannot double-bill.
- **Transcript trimming already exists where it matters most.** `classifyAsProspect` sends 3
  messages, `classifyThreadOutcome` sends 4, both de-quoted and capped at 1,200 chars — which is
  why their cost barely moves between `mid` and `long`. The three that *do* send the whole capped
  transcript (`scoreLead`, `generateFollowUpMessage`, `assessSendRisk`) are the ones that
  legitimately need it.
- **`MAX_TRANSCRIPT_CHARS = 8,000` is a real cost ceiling**, not just a safety one: it caps the
  most expensive call in the system at $0.000653.
- **Per-run budgets exist and are correct**: `MAX_CLASSIFICATIONS_PER_RUN = 25`,
  `MAX_SCORES_PER_RUN = 15` (`gmailSync.ts`), `DEFAULT_CLASSIFY_LIMIT = 60` (`reactivation.ts`),
  `MAX_CLASSIFICATIONS_PER_BUSINESS = 40` and `MAX_CLASSIFICATIONS_PER_TICK = 400` with a
  reserve-before-await budget (`cron/reactivation`). The only unbounded-per-run path in the app is
  §5.2.

---

## 6. The guards: which OpenAI-reaching paths are gated, and which aren't

Verified by reading each route, not assumed. The recent work here is real and mostly complete.

| Path | Billing gate | Rate limit | Free-tier AI cap |
|---|---|---|---|
| `POST /api/embed/[businessId]/lead` | ✅ | ✅ 20 / 10 min | Score/draft ✅ · **ack ✗** |
| `POST /api/webhooks/lead/[secret]` | ✅ | ✅ 100 / 10 min | Score/draft ✅ · **ack ✗** |
| `POST /api/twilio/sms/[secret]` | ✅ `requireActiveBilling` | **✗ none** | Score/draft ✅ · **ack ✗** |
| `POST /api/twilio/whatsapp/[secret]` | ✅ | **✗ none** | Score/draft ✅ · **ack ✗** |
| `POST /api/twilio/voice/transcription/[secret]` | ✅ | **✗ none** | Score/draft ✅ · ack n/a |
| `POST /api/twilio/voice-agent-callback/[secret]` | ✅ | **✗ none** | Score/draft ✅ |
| `POST /api/instagram/webhook` | ✅ (per business) | **✗ none** | Score/draft ✅ · **ack ✗** |
| `POST /api/leads/[id]/regenerate` | ✅ | ✅ 30 + 15 / 10 min | ✅ |
| `POST /api/leads/cleanup` | ✅ paid-only | ✅ 2 / hour | ✅ (paid-only gate) · **unbounded per run** |
| `POST /api/reactivation/classify` | ✅ paid-only | ✅ 6 / 10 min | ✅ |
| `POST /api/integrations/gmail/sync`, `outlook/sync`, `gmail/scan-spam` | ✅ | ✅ 5 / 10 min | ✅ (via `scoreAndDraftForLead`) |
| `POST /api/leads/test-lead` | ✅ | ✅ | ✅ |
| `POST /api/leads/import` (CSV), `POST /api/leads` (manual) | ✅ | ✅ | **reaches no model at all** — neither calls `scoreAndDraftForLead`, and a lead with no messages is excluded from the unscored sweep. $0. |
| `GET /api/cron/*` | `CRON_SECRET` + per-business billing | per-run budgets | ✅ (reactivation cron is paid-only) |
| Gmail/Outlook sync `classifyAsProspect` | ✅ (Free allowed — by design) | 25/run budget | **✗ not subject to the 20-lead cap** |

### 6.1 The one real gap: the instant acknowledgement has no tier gate

`src/lib/acknowledge.ts` imports no billing module at all. It runs `generateInstantReply` +
`assessAckRisk` + `localizeFixedText` — **3 model calls, $0.000388** — for every new lead,
regardless of tier, channel, or the Free-tier lead cap.

That contradicts the stated Free-tier policy, which
`research/market/2026-09-11-tier-pricing-recommendation.md` §2.2 defines as: *"no scoring, no
drafting, no translation past lead #20."* The ack path is drafting **and** translation, and
`scoring.ts` enforces the cap on its own calls while the ack that runs seconds earlier does not.
It also runs on channels Free doesn't cover: a Free business's SMS lead gets `scoreAndDraftForLead`
correctly refused by `isChannelAvailableOnFreeTier("SMS")` and then gets a generated,
risk-checked, translated acknowledgement anyway.

Cost ceiling of the gap, using the intake rate limits as the only bound:

| Path | Leads/day at the limit | Ack-only spend/day |
|---|---|---|
| Generic webhook (100 / 10 min) | 14,400 | **$5.60** |
| Embed form (20 / 10 min) | 2,880 | $1.12 |
| Twilio SMS / IG (no limit) | unbounded | unbounded |

**This needs a product decision before a code change, and that decision is not mine to make.**
There is a real argument for leaving it exactly as it is: the instant ack is the product's core
promise ("no lead is lost to LATE follow-up"), it is the one thing a free user experiences that
sells the paid tier, and $0.0004 is a rounding error. If that's the call, the *document* should
change rather than the code — §2.2's "no translation past lead #20" is currently a claim the
product does not implement. What should not persist is the two being out of step with nobody
having decided which is right.

### 6.2 Four webhooks reach the model with no rate limit

Twilio SMS/WhatsApp/voice-transcription/voice-agent-callback and the Instagram/Messenger webhook
all have a billing gate but no `tooManyRecent*` call. Every inbound message on those channels
runs `scoreAndDraftForLead` (3 calls, ~$0.0007 on a mid thread, rising with thread length), and
`acknowledgeNewLead` on the first one. The secret in the URL is the only barrier, and a *legitimate*
lead sending 50 rapid messages is enough — no attacker needed.

Per-message cost is low enough that this is a **should-do-before-scale**, not a blocker. But it is
the only remaining class of OpenAI-reaching endpoint with no ceiling of any kind, and the fix is
the existing `tooManyRecentLeads(businessId, source, …)` pattern applied at four more call sites.
Hand to backend-ai-agent. Failure scenario: 200 inbound SMS to one number in 10 minutes →
expected: capture continues, scoring deferred/dropped past a cap; current: 600 model calls.

---

## 7. Margins, and whether any tier loses money

### 7.1 On AI cost alone

| Tier | Price | Modelled volume | AI text cost | Gross margin on AI alone |
|---|---|---|---|---|
| Free | $0 | 20 leads | $0.032 | n/a (loss-leader) |
| Plus | $39 | 150 leads | $0.215 | **99.4%** |
| Plus | $39 | 300 leads (doc's assumption) | $0.429 | **98.9%** |
| Pro | $79 | 700 leads | $1.00 | **98.7%** |

### 7.2 Break-even lead volume — the number that answers "can a heavy user lose us money?"

At the measured per-lead costs, ignoring every other COGS line:

| Tier | Break-even at $0.00217/lead (full-life) | At $0.00106/lead (capture-only) |
|---|---|---|
| Plus $39 | **~17,900 leads/month** | ~36,800 |
| Pro $79 | **~36,300 leads/month** | ~74,500 |

The pricing doc's own fair-use ceilings are 1,500/mo (Plus) and 10,000/mo (Pro) — **12× and 3.6×
below break-even respectively.** A customer who maxes out Plus's fair-use cap costs $3.26/mo in AI
and pays $39.

**No tier loses money on AI text cost. Not Free, not Plus, not Pro, not at any volume a fair-use
cap permits.** Adding back the pricing doc's other COGS lines (Vercel + Supabase amortized $2.50,
Stripe $1.43 for Plus) leaves its stated **83–89% (Plus) / 84–91% (Pro)** margins intact — AI text is
the *smallest* variable line in the model, ~10% of Plus's non-support COGS ($0.43 of $4.45) and
about a sixth of what Stripe takes.

Two caveats, both already flagged in the pricing doc and neither contradicted here:

- **The Voice add-on is the one genuine margin risk**, at 41% worst case. It is a different model
  (Realtime), a different cost structure (per-minute audio, ~100× text per interaction), and is
  out of this document's scope. `transcribeAudio` at ~$0.003/min is *not* that risk — a 1-minute
  voicemail costs about twice what the whole rest of the lead does, which is still a third of a
  cent.
- **Plus's 1,500/mo and Pro's 10,000/mo fair-use caps are not implemented anywhere in code.**
  `FREE_TIER_LEAD_CAP = 20` is the only lead cap that exists (`src/lib/pricing.ts`). At these unit
  costs that is not a financial problem — it is a *policy* problem: a published cap nothing
  enforces.

### 7.3 So what actually threatens the margin?

Not volume. Three loops:

1. **§5.1**, the only per-customer cost that grows with time rather than with leads.
2. **§5.2**, the only path with no ceiling per run.
3. **§6.2**, the only endpoints with no rate limit at all.

All three are shape problems, not price problems. None is fixed by changing the model or the
pricing.

---

## 8. What would make these numbers exact

Everything above is derived from code and list prices. Three things would replace estimates with
measurements, roughly in order of effort:

1. **Log `usage` from every completion.** The response already carries
   `usage.prompt_tokens`, `usage.completion_tokens`, and
   `usage.prompt_tokens_details.cached_tokens`. Recording those three numbers plus the function
   name turns this entire document into a dashboard query, settles the prompt-caching question in
   §5.4 outright, and replaces my thread-shape assumptions with the real distribution. **This is
   the single highest-value follow-up, and it is small.**
2. **Read the OpenAI dashboard's usage page** after a week of real traffic and divide by leads
   captured. That is the number that actually matters and no amount of modelling substitutes for
   it.
3. **Confirm `P_in`/`P_out` against OpenAI's own pricing page** from an environment that can reach
   it, and **set a hard spend cap in the OpenAI dashboard** — the provider-level backstop the
   pricing doc §2.1 already recommended and which nothing in the product replaces.

---

## 9. Sources, and what I could not verify

**Could not verify.** `platform.openai.com` and `developers.openai.com` are **EGRESS_BLOCKED**
from this environment (hard block from the agent proxy, confirmed against
`$HTTPS_PROXY/__agentproxy/status` — the proxy is healthy; these hosts are simply not permitted).
`openrouter.ai`, `pricepertoken.com`, `devtk.ai`, `cloudzero.com` and `usagepricing.com` are
likewise blocked for direct fetch. **No price below was read from a page I fetched in full** —
they come from WebSearch result snippets, which per this repo's convention
(`design-brain/decisions/design-decisions.md` D-006) caps confidence at medium.

| Claim | Source | Checked | Grade |
|---|---|---|---|
| `gpt-4o-mini`: $0.15/1M input, $0.60/1M output, $0.075/1M cached input | WebSearch consensus across OpenRouter, pricepertoken.com, devtk.ai, langcopilot, CloudZero, Inworld | 2026-09-15 | **B–** (multiple independent, vendor page unreachable) |
| Same, unchanged since 2026-09-06 | `research/integrations/2026-09-06-openai-pricing-data-retention.md`, `research/market/2026-09-11-tier-pricing-recommendation.md` §5.1 | in-repo | B |
| `gpt-4o-mini-transcribe`: ~$0.003/min (or $1.25/1M in, $5/1M out) | WebSearch (costgoat.com, OpenRouter, getmaxim.ai snippets) | 2026-09-15 | C |
| `gpt-4.1-nano`: $0.10/1M in, $0.40/1M out; cheapest current OpenAI model by input price | WebSearch (futureagi, OpenRouter, usagepricing, g2 snippets) | 2026-09-15 | C |
| JSON schema text is billed as input tokens | WebSearch (dev.to, digitalapplied, ergini snippets — consistent, none primary) | 2026-09-15 | C |
| Prompt caching applies automatically above a minimum prefix length (~1,024 tokens) | **Not verified** — OpenAI docs unreachable. Treat §5.4's caching claim as a hypothesis to test with `cached_tokens`, not a fact. | — | **D** |
| Token counts for every prompt | Measured in-process against `openai.ts` md5 `7a2facd83b1c4898bc941bc0864a000b` with `gpt-tokenizer`'s `o200k_base` encoding | 2026-09-15 | **A** (for that file revision) |
| Lead first-contact messages are short and factual | `research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md` Finding 1 | in-repo | C (that document's own grade) |
| Rate limits, billing gates, per-run budgets in §6 | Read directly from the routes named | 2026-09-15 | **A** |
| Free-tier policy ("AI processing pauses past lead #20") | `research/market/2026-09-11-tier-pricing-recommendation.md` §2.2 | in-repo | — |
| Tier prices $0 / $39 / $79 | `src/lib/pricing.ts` (`TIER_INFO`, `TIER_MONTHLY_PRICE_USD`, `FREE_TIER_LEAD_CAP = 20`) | 2026-09-15 | **A** |

**One honest caveat about the whole document.** The prompts in `openai.ts` grew measurably while I
was measuring them — the drafting prompt by ~40% in an hour. The *structure* of the cost (drafting
dominates, fixed instructions dwarf the lead's own words, the loops in §5.1/§5.2 are where the
risk is) is stable. The absolute token counts are a reading from one revision, and will drift
upward as prompts are hardened. Item 1 in §8 is what makes that drift visible instead of
invisible.
