# What one customer actually costs, per month — the non-voice plan, everything in

**Date:** 2026-09-15
**Question being answered:** *"How much does a user cost me, so I can set a price accordingly.
Suppose they're using the basic model, we're just following up, no voice."*
**Scope:** total cost to serve **one** customer for **one** month on the non-voice plan — AI,
database, serverless compute, bandwidth, email, and the payment processor's cut. Fixed platform
costs separated from per-customer costs. Break-even and supportable price at the end.
**Nothing in this document changed application code.**

**Builds on, does not repeat:** `2026-09-15-ai-cost-per-lead.md` (the AI side, measured — reused
here whole, with one correction in §1.2) and `research/market/2026-09-11-tier-pricing-recommendation.md`
§5 (which carried a **top-down guess** of "$2.50/customer for Vercel + Supabase" — replacing that
guess with something derived from the code is most of the point of this document).

---

## 0. The answer, before the working

| | Per customer / month |
|---|---|
| **Marginal cost to serve one more Plus customer** | **$2.01** |
| — of which **Stripe** | **$1.70 (85%)** |
| — of which **everything else combined** (AI + DB + compute + bandwidth) | **$0.31 (15%)** |
| Fixed platform cost, independent of customer count | **$46.25/month** |
| **Break-even** at $39 | **2 paying customers** |
| Gross margin at $39, 100 customers | **~94%** |

**The headline the founder asked for: your cost is not the AI. Your cost is Stripe.** The payment
processor takes 5.5× more per customer than every server and every model call put together. Every
other line in this document is cents.

**The second headline: none of this is what limits you.** The thing that breaks first as you grow
is not a bill — it is `maxDuration = 300` on the sync crons, which the arithmetic in §2.3 says
runs out somewhere around **450 customers**, long before any meter costs real money.

---

## 0.1 How to read the grades

Every figure below is one of three kinds. They are not equally solid and they are labelled
individually.

| Grade | Meaning |
|---|---|
| **Measured** | Read out of this repository — a cron schedule, a `take:` cap, a column list. Cited `file:line`. Not disputable. |
| **Derived** | Arithmetic on a measured quantity and a published price. Correct if the inputs are. |
| **Assumed** | A usage number nobody has observed yet, because FollowUp has no production traffic to observe. Stated explicitly, always as a named variable, so a real bill replaces it without redoing the model. |

**Vendor prices are a fourth category and the weakest one.** `vercel.com`, `supabase.com` and
`developers.google.com` are all **EGRESS_BLOCKED** from this sandbox — I tried WebFetch on each and
got a hard block from the agent proxy, not a timeout. Every vendor price below therefore comes from
**WebSearch result snippets, not from a vendor page I read.** Full sourcing table in §8. Treat them
as **Grade B–**: multiple independent aggregators agree, but none is primary.

**I have not seen the founder's actual Vercel or Supabase invoices and have not guessed at them.**
Where a real bill would settle something, §7 says so.

---

## 1. The AI side — reused, with one correction

### 1.1 What is carried forward unchanged

From `2026-09-15-ai-cost-per-lead.md`, measured (token counts read out of the real prompt-assembly
code, Grade A for that file revision):

```
AI_per_lead   = $0.0011 (capture-only)  …  $0.0022 (full life)
AI_per_month  = $0.215   at 150 leads/month, 1-in-3 mix
```

I re-checked the method rather than the arithmetic and have no objection to it. The token counts
were produced by executing the real prompt builders against a stubbed client and tokenizing with
`o200k_base` — that is the right way to do it, and it is materially better evidence than the
top-down estimate it replaced.

**`$0.215/customer/month` is the AI number used everywhere below.**

### 1.2 One thing in that document is now out of date — and it is out of date in your favour

Its §5.1 ("the 20-hour re-draft loop on held leads") priced a parked lead at **$0.0257/month,
indefinitely**, and called it the biggest waste in the system. **That is no longer true.** Commit
`d173a11` *"Stop paying to redraft a held lead, and give every tier an AI ceiling"* landed after
that document was written and fixed exactly the thing it described:

- `Lead.suggestedDraftedFor` now stamps the newest message a draft was written against
  (`prisma/schema.prisma:368`), and `automation.ts:498-500` skips the redraft when the conversation
  has not moved. A parked lead is now **$0/month** instead of $0.026.
- Its §5.2 (`/api/leads/cleanup` re-classifying the whole Gmail backlog with no `take`) is also
  fixed — `src/app/api/leads/cleanup/route.ts:94` now has `take: CLEANUP_BATCH_SIZE`. The
  "$1,395/month from one account" tail risk in that section is gone.
- Its §7.2 complaint that Plus's 1,500/mo and Pro's 10,000/mo caps "are not implemented anywhere in
  code" is fixed — `TIER_AI_LEAD_CAP` now exists in `src/lib/pricing.ts:59`.

**So: nothing in that document reads wrong to me, but three of its findings are now history rather
than open risk, and the $0.215 is if anything now a mild overstatement.** Anyone quoting its §5.1
as a live problem should stop.

**One thing in it I would still flag as genuinely soft**, and it is the author's own caveat: the
prompts grew ~40% *during* the measurement. `$0.215` is a reading on a rising line. Its §8 item 1
(log `usage.prompt_tokens` off every completion) is the fix and it is still the single
highest-value follow-up in either document.

---

## 2. Every other per-customer cost, derived from the code

### 2.1 Database rows and storage (Supabase)

**What a lead actually writes.** Row sizes are *derived* from the column lists in
`prisma/schema.prisma` plus standard Postgres heap overhead (23-byte tuple header aligned to 24, a
4-byte line pointer, a null bitmap; a `cuid` id is 25 characters = 26 bytes stored). Index entries
are costed at ~55 bytes each (key + 8-byte tid + line pointer, at default fill factor).

| Table | Rows per lead | Bytes each (heap + index) | Why that size |
|---|---|---|---|
| `Lead` | 1 | **~1,700 B** | 41 scalar columns (`schema.prisma:337-518`), of which the text ones dominate: `scoreReason`, `scoreFactors` (JSON), `suggestedMessage`, `suggestedSubject`, `quietOutcomeReason`. Plus **10 btree indexes** — 3 `@@unique` + 6 `@@index` + the PK (`schema.prisma`, Lead block) — which is ~550 B of index per row on its own. |
| `Conversation` | 1 | ~280 B | `schema.prisma:518`; 3 indexes. |
| `Message` | ~4 | **~1,070 B each** | `schema.prisma:537`. `body` is the variable. **Measured ceiling:** Gmail bodies are truncated at import — `extractPlainTextBody(m.payload).slice(0, 5000)`, `src/lib/integrations/gmail.ts:548`. So no single message can exceed ~5 KB. Assumed average stored body: **800 chars** (the AI doc's "mid" thread averages 560 chars of *lead-written* text; stored Gmail bodies carry more, quoted history included). |
| `AuditEvent` | ~2 | ~400 B each | `schema.prisma:954`. 45 `recordAudit()` call sites across `src/`; the ones on a normal lead's path are `ai.send` / `ai.hold` (`sending.ts:400`, `automation.ts:627`). `meta` is explicitly identifiers-and-counts only — *"no credentials, no message bodies"* (`src/lib/audit.ts:9`) — which is what keeps it small. 2 indexes. |
| `Notification` | ~1 | ~300 B | `scoring.ts:116`, `engagement.ts:66`, `automation.ts:730`. |
| `RateLimitHit` | ~2 | ~170 B each | `src/lib/rateLimit.ts:36` — written on **every** gated call, in or out of limit. |
| **Total** | | **≈ 8 KB per lead** | Derived. |

```
StorageGrowth(customer) = leads_per_month × 8 KB
                        = 150 × 8 KB = 1.2 MB / customer / month
                        = 14 MB / customer / year
```

**Cost of that: effectively zero.** Supabase Pro includes 8 GB of disk; overage is **$0.125/GB/month**
(search-sourced, Grade B–).

```
DiskCost(customer) = 1.2 MB/mo ÷ 1024 × $0.125 = $0.00015 / customer / month
```

8 GB holds roughly **570 customer-years** of this data. Storage will not be a line item on your bill
for a very long time.

**The real finding here is not the money — it is that three tables have no retention policy at all.**
`AuditEvent`, `RateLimitHit` and `ProcessedWebhookEvent` are only ever deleted when a whole business
is deleted (`src/lib/businessData.ts:198-201`); there is no pruning anywhere else (grep-verified).
`RateLimitHit` in particular is written once per gated request forever and read only over a
minutes-wide window (`rateLimit.ts:29-37`) — every row older than the longest window is dead weight
that the `@@index([businessId, action, createdAt])` btree still has to carry. **This is a query-latency
and index-bloat problem long before it is a storage-cost problem**, and it is a small, contained fix
(a nightly `deleteMany` on the existing cron). `ProcessedWebhookEvent`'s own schema comment already
concedes it: *"Not pruned yet"* (`schema.prisma:978`).

### 2.2 Database egress (Supabase)

Supabase Pro includes **250 GB/month** of combined egress; overage **$0.09/GB** (search-sourced,
Grade B–).

The dominant driver is not leads — it is the dashboard sitting open. **Measured:**
`src/components/NotificationBell.tsx:24` sets `POLL_MS = 45_000` and line 56 runs it on an interval
for the lifetime of the mounted component. Each poll hits `/api/notifications`, which is
**2 DB queries** (`findMany take: 30` + a `count`, `src/app/api/notifications/route.ts:13-20`) plus
the session lookup.

```
Polls(customer) = (3600 / 45) × H_open × D_open        [H_open = hours/day tab open, D_open = days/month]
                = 80 × 8 × 22 = 14,080 polls / month          [ASSUMED: 8h × 22d, one open tab]
```

```
DBEgress(customer) ≈ polls × ~6 KB  +  page loads × ~200 KB  +  cron reads
                   ≈ 85 MB + 40 MB + ~75 MB ≈ 0.20 GB / customer / month   [ASSUMED]
EgressCost = max(0, N × 0.20 − 250) × $0.09
```

**Zero until ~1,250 customers**, then **$0.018/customer/month**. Not a cost driver.

### 2.3 Serverless invocations and compute (Vercel) — the cron question, answered

**Measured, from `followup/vercel.json`:**

| Cron path | Schedule | Runs/month | Per-business or global? |
|---|---|---|---|
| `/api/cron/automation` | `0 * * * *` (hourly) | 720 | **Global** |
| `/api/cron/gmail-sync` | `*/10 * * * *` | 4,320 | **Global** |
| `/api/cron/crm-sync` | `*/10 * * * *` | 4,320 | **Global** |
| `/api/cron/outlook-sync` | `*/10 * * * *` | 4,320 | **Global** |
| `/api/cron/reactivation` | `0 */6 * * *` | 120 | **Global** |
| `/api/cron/weekly-digest` | `0 13 * * 1` | ~4.3 | **Global** |
| `/api/cron/office` | `0 6 * * 1` | ~4.3 | **Global** |
| **Total** | | **≈ 13,809 invocations/month** | **fixed, regardless of customer count** |

**This is the answer to the founder's specific question, and it is the good answer.** Every cron is
one invocation that fans *in* over all tenants, not one invocation per tenant:

- `/api/cron/automation` calls `runAutomationForAllBusinesses()`
  (`src/app/api/cron/automation/route.ts:34`), which does one `findMany` for enabled automations and
  then `mapWithConcurrency(enabled, 3, …)` (`src/lib/automation.ts:748`).
- `/api/cron/gmail-sync` calls `syncGmailForAllBusinesses()` (`route.ts:28`), same shape:
  `mapWithConcurrency([...byBusiness.entries()], 3, …)` (`src/lib/gmailSync.ts:162`).
- `crm-sync`, `outlook-sync`, `reactivation`, `weekly-digest`, `office` all take the same
  `…ForAllBusinesses` / `business.findMany` form.

**So cron *invocation* cost does not scale with customers at all.** 13,809 invocations/month at
**$0.60 per million** (Vercel Pro, search-sourced Grade B–) is **$0.0083/month, total, forever.**

**Cron *duration* does scale, and that is where the money and the risk both are.** Vercel Fluid
compute bills two meters (search-sourced, Grade B–): **Active CPU at $0.128/hour** and **Provisioned
Memory at $0.0106/GB-hour**, with **no included allowance on Pro**. Memory is billed for wall-clock;
CPU pauses during I/O wait, which matters a lot here because these crons are almost entirely waiting
on Gmail and OpenAI. Default function size is **2 GB / 1 vCPU**.

Because `mapWithConcurrency` runs a fixed pool of **3** workers (`src/lib/concurrency.ts`), wall-clock
grows linearly:

```
CronWall(N) per run  = N × t_b / 3          [t_b = seconds of work per business, UNKNOWN]
CronCost(customer)   = Σ_crons runs/mo × (t_b/3) / 3600 × ( 2 GB × $0.0106 + c × $0.128 )
                                              [c = fraction of wall that is real CPU, UNKNOWN]
```

For a **Gmail-only, non-voice customer** — no CRM, no Outlook, so `crm-sync` and `outlook-sync` find
nothing for them and add ~0 — the crons that do per-business work are `gmail-sync` (4,320 runs),
`automation` (720) and `reactivation` (120):

```
CronWall(customer) = 4320×(2/3) + 720×(2/3) + 120×(3/3) = 3,480 wall-seconds / customer / month
                                              [ASSUMED t_b = 2s sync, 2s automation, 3s reactivation]
CronCost(customer) = (3480/3600) × 2 × $0.0106  +  (3480 × 0.20 / 3600) × $0.128
                   = $0.0205 + $0.0247 = $0.045 / customer / month          [ASSUMED c = 0.20]
```

If that customer *also* connects a CRM and Outlook, the other two `*/10` crons start doing work for
them too and this roughly triples, to **$0.120/customer/month**. Still cents — but worth knowing that
"connect everything" is the most expensive customer shape on the infrastructure side.

**Request-path compute** (the dashboard, the intake webhooks):

```
Invocations(customer) = 14,080 polls + ~1,000 page/API + ~450 intake+send = 15,530 / month
                                                          [ASSUMED for all but the poll term]
InvCost      = 15,530 × $0.60/1M                                      = $0.0093
ComputeCost  = 15,530 × 0.15 s → 2,330 wall-s
             = (2330/3600)×2×$0.0106 + (2330×0.30/3600)×$0.128        = $0.0386
                                                   [ASSUMED 150 ms average, 30% CPU]
```

That $0.0386 is an **upper bound**: Fluid compute multiplexes concurrent invocations onto one
instance, so provisioned memory is billed per instance-second, not per invocation-second. At low
concurrency the real number is lower.

**Vercel total per customer: $0.093/month** (Gmail-only), **$0.168** (everything connected).

**The scaling cliff, which matters much more than the price.** Both `/api/cron/gmail-sync` and
`/api/cron/automation` set `export const maxDuration = 300`. With concurrency 3 and t_b = 2s:

| Customers | gmail-sync wall-clock per run |
|---|---|
| 100 | 67 s |
| 300 | 200 s |
| **450** | **300 s — the ceiling** |
| 1,000 | 667 s — **times out** |

Past that the function 504s mid-run and the businesses at the back of the list **silently stop being
synced**. Both routes' own comments already say this — *"past a few hundred tenants this becomes a
fan-out"* (`src/app/api/cron/gmail-sync/route.ts:9`), *"if the tenant count outgrows even that, this
needs to become a fan-out (one job enqueued per business)"* (`automation/route.ts:10-11`). **This is
the real constraint on growth, it is architectural, and it arrives at roughly 450 customers — about
$17.5k MRR.** It is not a cost problem and no amount of budget fixes it.

**Two other Vercel meters, both free at this scale:**
- **Fast Data Transfer:** 1 TB included on Pro, then $0.15–$0.35/GB by region. At an assumed
  ~0.06 GB/customer/month (app shell + API responses + poll payloads), you clear 1 TB at roughly
  **16,000 customers**. Effectively free; if ever charged, $0.009/customer.
- **Edge Requests:** 10M included, then **$2.00/million**. At an assumed ~20,000/customer/month, you
  clear 10M at **~500 customers** — the first Vercel meter you will actually cross, and it costs
  $0.04/customer past that. Note this lands at almost exactly the same customer count as the cron
  timeout.

### 2.4 Email sending — confirmed free, with a dated caveat

**Confirmed: $0 today.** The Gmail API is free of charge; the quota is expressed in abstract "quota
units," not dollars (search-sourced from Google's own quota page via snippet, Grade C — I could not
fetch `developers.google.com`; it is EGRESS_BLOCKED).

Three things about it are worth having written down, because two of them are not obvious:

1. **The quota is per Cloud project, and FollowUp has one project shared across all tenants.**
   Reported as 1.2M quota units/minute/project and 6,000/minute/user for new projects (Grade C). A
   `messages.send` is 100 units. The per-*project* ceiling is a shared resource: at high tenant
   counts one noisy customer's sync can degrade everyone's. This is the same class of ceiling as
   §2.3's 300s, arriving later.
2. **The real sending limit is not the API, it is the mailbox**: ~500 messages/day on a consumer
   Gmail account, ~2,000/day on Workspace (Grade C). That is the customer's own mailbox limit, not a
   FollowUp cost, but it is the number that caps an aggressive sequence.
3. **Google has said Gmail API usage above a daily billing threshold is "planned to incur charges to
   your Google Cloud billing account later in 2026," with at least 90 days' notice, and that a paid
   quota-increase option is coming** (search-sourced, Grade C). **This is currently a $0 line that
   Google has publicly announced will not stay $0 forever.** It does not change today's number. It
   does mean this document has a shelf life, and it is worth someone watching the Gmail API release
   notes. Projects that used the API between Nov 2025 and Apr 2026 reportedly keep existing quotas
   for now.

### 2.5 Twilio — confirmed **not** your cost

**Measured.** Twilio credentials are stored **per business**, not per platform: `twilioAccountSid`,
`twilioAuthToken`, `twilioPhoneNumber` are columns on `Business`, and every outbound send
authenticates with that business's own SID
(`src/lib/twilio.ts:498-509`, `src/lib/twilio.ts:563-567`). SMS and WhatsApp spend lands on the
**customer's** Twilio invoice, never FollowUp's. **$0 FollowUp COGS.** This confirms in code what
`research/market/2026-09-11-tier-pricing-recommendation.md` §5 asserted without citing a line.

(It also means A2P 10DLC registration is the customer's obligation, not yours — a compliance point,
not a cost one, already covered in `research/integrations/2026-09-06-twilio-sms-compliance.md`.)

### 2.6 Stripe — the actual per-customer cost

**Measured:** `src/app/api/billing/checkout/route.ts:78` creates a Checkout Session with
`mode: "subscription"`, and `src/app/api/billing/portal/route.ts:30` opens a Billing Portal session.
**That is Stripe Billing**, not bare payments — which matters, because Billing is a separate fee line.

Prices (search-sourced, Grade B–):

```
Stripe(price) = price × 2.9% + $0.30      (US online card)
              + price × 0.7%              (Stripe Billing, consolidated single rate since Jul 2024)
```

At $39: `$1.131 + $0.30 + $0.273 = ` **$1.704 per customer per month.**

Three notes:

- **The prior pricing doc under-counted this.** Its §5 costed Stripe at "2.9% + $0.30 = $1.43" and
  omitted the Billing 0.7%. The correct figure is **$1.70**, 19% higher. It does not change any
  conclusion in that document — the margins were 83–89% and are still ~85% — but it is the single
  largest correction in this write-up.
- **I could not find any free-volume threshold for the Billing 0.7%.** I searched specifically for
  one; the sources say it applies from the first dollar. **Grade C on the absence** — an absence of
  evidence found via search is weaker than a presence. If the founder's real Stripe dashboard shows
  no Billing line, drop $0.273 and the marginal cost falls to $1.74.
- **Stripe Tax is not enabled.** There is no `automatic_tax` on the Checkout Session
  (`checkout/route.ts:77-95`, verified — the prior compliance write-up inferred this from reading the
billing files; it is now confirmed). So Stripe's additional **0.5% Tax fee is not being
  incurred** — and the corresponding sales-tax/GST obligation is also not being handled. That is a
  compliance question for `research/integrations/2026-09-06-stripe-billing-compliance.md`, not a
  cost question, but turning it on later adds ~$0.20/customer/month at $39.

### 2.7 The free trial — a per-customer cost that is easy to forget

**Measured:** `TRIAL_PERIOD_DAYS = 14` (`src/lib/billing.ts:21`), and Checkout is created with
`payment_method_collection: "if_required"`, so **no card is collected during the trial**
(`checkout/route.ts:91-92`). `requireActiveBilling()` treats `trialing` the same as `active`, so a
trialing business gets the full product.

```
TrialCost = (14/30) × non-Stripe marginal = 0.47 × $0.31 = $0.14 per signup
CostPerPayingCustomer_including_trials = $0.14 / conversion_rate
```

At a 20% trial→paid conversion that is **$0.70 of trial cost per paying customer acquired** — small,
but it is a real line and it is the only one that scales with *signups* rather than customers. It
also means an abusive signup loop costs money at $0/revenue; the tier AI caps added in `d173a11`
are what bound it.

---

## 3. Marginal cost per customer — the total

Baseline: **Plus, $39/month, non-voice, 150 leads/month, Gmail only, one seat, dashboard open 8h/day
× 22 days.**

| Line | $/customer/month | Grade |
|---|---|---|
| OpenAI (`gpt-4o-mini`, all nine call paths) | **0.2150** | Measured token counts × search-sourced price |
| Vercel — invocations (15,530) | 0.0093 | Derived / assumed volume |
| Vercel — request-path compute | 0.0386 | Derived / assumed 150 ms, 30% CPU |
| Vercel — marginal cron compute | 0.0452 | Derived / assumed t_b = 2 s, c = 0.20 |
| Vercel — bandwidth | 0.0000 | Inside 1 TB until ~16,000 customers |
| Vercel — edge requests | 0.0000 | Inside 10M until ~500 customers |
| Supabase — disk | 0.0002 | Inside 8 GB for ~570 customer-years |
| Supabase — egress | 0.0000 | Inside 250 GB until ~1,250 customers |
| Gmail API | 0.0000 | Free today; see §2.4 note 3 |
| Twilio | 0.0000 | Customer's own account (§2.5) |
| **Sub-total: everything technical** | **$0.308** | |
| **Stripe (2.9% + $0.30 + 0.7% Billing)** | **$1.704** | |
| **MARGINAL COST PER CUSTOMER** | **$2.012** | |

If you grow past every included allowance, so every meter is charged from the first unit, add
$0.067 → **$2.079**. The difference is 3%. **Included allowances are not what is keeping this cheap;
the product is genuinely cheap to run.**

**Contribution margin at $39: $36.99 per customer, 94.8%.**

---

## 4. Fixed costs, and what they mean

These do not change with customer count. They set the break-even, not the unit economics.

| Item | $/month | Grade |
|---|---|---|
| **Vercel Pro**, 1 seat ($20/seat, includes $20 of usage credit) | **20.00** | Search-sourced, B– |
| **Supabase Pro** ($25 base, includes $10 compute credit ⇒ Micro instance free) | **25.00** | Search-sourced, B– |
| Domain, amortized (~$15/yr) | 1.25 | Assumed |
| Sentry | 0.00 | Developer/free plan: 5k errors/mo. `tracesSampleRate: 0.05` (`src/sentry.server.config.ts:20`) keeps span volume low. Team is $26/mo when you outgrow it. Search-sourced, B– |
| **Total fixed** | **$46.25** | |

**Vercel Pro is not optional and that is code-enforced, not a preference.** Two independent reasons:
`vercel.json` declares crons at `*/10` and `0 * * * *` — **Hobby is limited to once-per-day crons and
a sub-daily expression fails deployment outright** (search-sourced, Grade B–) — and the routes set
`maxDuration = 300`, which is **Pro's ceiling; Hobby caps at 60 s** (Grade B–). The repo cannot run
on a free plan.

**Break-even:**

```
N_breakeven = Fixed / (Price − Marginal) = $46.25 / ($39 − $2.01) = 1.25
```

**Two paying customers covers the entire platform.** Customer #2 puts you in profit.

---

## 5. Total monthly cost at 1, 10, 100 and 1,000 customers

Quota-aware — included allowances applied before overage, Vercel's $20 usage credit applied against
Vercel usage, Supabase disk costed on **12 months of accumulated** data.

| N | Fixed | OpenAI | Vercel billed | Supabase overage | Stripe | **Total cost** | Revenue | **Profit** | Margin |
|---|---|---|---|---|---|---|---|---|---|
| **1** | $46.25 | $0.22 | $0.00 (inside credit) | $0.00 | $1.70 | **$48.17** | $39 | **−$9.17** | — |
| **10** | $46.25 | $2.15 | $0.00 (inside credit) | $0.00 | $17.04 | **$65.44** | $390 | **+$324.56** | **83.2%** |
| **100** | $46.25 | $21.50 | $0.00 (inside credit) | $0.00 | $170.40 | **$238.15** | $3,900 | **+$3,661.85** | **93.9%** |
| **1,000** | $46.25 | $215.00 | $93.12 + $20.00 edge | $0.72 | $1,704.00 | **$2,059.09** | $39,000 | **+$36,940.91** | **94.7%** |

**Read the N=1,000 row with two warnings attached:**

1. **It is not reachable on this architecture.** §2.3's cron wall-clock is 667 s against a 300 s
   ceiling at that count. The fan-out rewrite both route comments describe is a prerequisite, and it
   is a `backend-ai-agent` job, not a small fix.
2. **It omits a Supabase compute upgrade, because I cannot size one honestly.** The $25 Pro plan's
   $10 credit buys a **Micro** instance (1 GB RAM). A thousand tenants each polling `/api/notifications`
   twice per 45 s is ~44 queries/second of pure background load before anyone does anything
   deliberate. Micro will not carry that; Small is $15/mo, Medium $60, Large $110, XL $210
   (search-sourced, Grade B–). **Adding, say, Large is +$110/month — which moves the N=1,000 margin
   from 94.7% to 94.4%.** It does not change the picture; I am flagging it because guessing the tier
   would be inventing a number, and even the worst case is noise.

---

## 6. The margin at $39, and what price the numbers support

### 6.1 At $39

**94.8% gross margin on marginal cost; ~94% at 100 customers with fixed costs amortized.** There is
no volume at which a non-voice Plus customer loses money. The AI document's §7.2 break-even of
~17,900 leads/month per customer stands, and `TIER_AI_LEAD_CAP` (`src/lib/pricing.ts:59`) now caps
well below it.

### 6.2 What the cost floor actually permits

| Price | Stripe's cut | Total marginal | Gross margin |
|---|---|---|---|
| $9 | $0.62 | $0.93 | 89.6% |
| $19 | $0.98 | $1.29 | 93.2% |
| $29 | $1.34 | $1.65 | 94.3% |
| **$39** | **$1.70** | **$2.01** | **94.8%** |
| $49 | $2.06 | $2.37 | 95.2% |

**Cost supports a price as low as about $9 while still clearing 89% gross margin.** The only thing
that degrades as price falls is Stripe's fixed **$0.30**, which is 3.3% of a $9 plan and 0.8% of $39
— which is an argument for annual billing (one $0.30 instead of twelve, saving **$3.30/customer/year**)
far more than it is an argument about the monthly price.

**So the honest answer to "what price do the numbers support" is: the numbers do not constrain your
price.** Anything from $9 to $99 is comfortably profitable on cost of goods. **Price on value and on
what the competitive research says the ICP will pay** — that reasoning lives in
`research/market/2026-09-11-tier-pricing-recommendation.md` and
`research/market/2026-09-08-pricing-validation-home-services-icp.md`, and nothing measured here
contradicts either.

**The one caveat that genuinely does constrain it is not in this document: support labour.** See §7.

### 6.3 Where the money actually goes — the chart worth remembering

```
Stripe                            $1.704   ████████████████████████████████████  85%
OpenAI                            $0.215   ████▌                                 11%
Vercel compute (request + cron)   $0.084   █▊                                     4%
Vercel invocations                $0.009   ▏                                    0.5%
Supabase (disk + egress)          $0.0002                                         0%
Gmail API / Twilio                $0                                              0%
```

**Every engineering optimization available in this product is competing for 15% of a $2 bill.** The
AI document's §5.3 already reached this conclusion for the AI half ("45% of $0.215 is ten cents a
month — don't"); it generalizes. **The only per-customer cost worth negotiating is Stripe's**, and
the levers there are annual billing and, at scale, Stripe's own volume pricing — not code.

---

## 7. What I could not determine — the honest list

Ordered by how much it could move the answer.

1. **Support and founder time.** Not in this model, not derivable from a repository, and almost
   certainly **larger than every line in §3 combined**. Twenty minutes of founder attention per
   customer per month at a $50/hr opportunity cost is **$16.67** — eight times the entire technical
   + Stripe cost. **If the founder wants one number to worry about, it is this one, and this
   document cannot produce it.** Only real customers can. The prior pricing doc flagged the same
   gap; it is still the gap.
2. **The founder's actual Vercel and Supabase invoices.** Not in this repo. I have not guessed
   them. Every consumption figure above is written as a formula with named unknowns
   (`t_b`, `c`, `H_open`, average function duration, average stored message body) precisely so the
   real bills drop in. **The single most useful thing he can do with this document is send me one
   month of each invoice's usage breakdown.**
3. **`t_b` — real per-business cron work.** The whole cron cost line ($0.045–$0.120) and the entire
   450-customer timeout estimate hinge on an assumed 2 seconds. Vercel's runtime logs already record
   real function durations; one look settles it. **This is the highest-value unknown that is cheap
   to close.**
4. **Vendor prices.** Every one is **search-sourced, not vendor-verified** — `vercel.com`,
   `supabase.com` and `developers.google.com` are all EGRESS_BLOCKED here. §8 grades each. The
   Stripe Billing 0.7% is the one that matters most ($0.27 of a $2.01 bill) and the one I would
   re-check first, against the founder's own Stripe dashboard, which settles it in ten seconds.
5. **Whether the Stripe Billing 0.7% has a free volume threshold.** I searched specifically and found
   nothing supporting one — but a *negative* found by search is weak evidence. Grade C.
6. **Supabase compute tier required at each scale.** A step function I will not guess at (§5).
7. **Real thread-length and lead-mix distribution.** Inherited from the AI document's own stated
   assumptions. Its §8 item 1 — logging `usage` off every completion — closes this and my §2.1
   message-size assumption at the same time.
8. **When Gmail API billing starts and at what rate.** Google has announced it is coming "later in
   2026" with 90 days' notice and has not published rates (§2.4). Today's $0 is correct; it has an
   expiry date nobody knows.

---

## 8. Sources, and what I could not verify

**Could not fetch, any of them.** `vercel.com`, `supabase.com` and `developers.google.com` all
returned a hard **EGRESS_BLOCKED** from the agent proxy on WebFetch (not a timeout — the proxy is
healthy, these hosts are not permitted). **No vendor price below was read from a page I fetched.**
All come from WebSearch result snippets, which per this repo's convention
(`design-brain/decisions/design-decisions.md` D-006) caps confidence at medium.

| Claim | Source | Checked | Grade |
|---|---|---|---|
| Vercel Pro $20/seat/mo, includes $20 usage credit, 1 TB Fast Data Transfer, 10M Edge Requests | WebSearch consensus — flexprice.io, makerkit.dev, costbench.com, axonbuild.com | 2026-09-15 | **B–** |
| Vercel function invocations $0.60/million on Pro | WebSearch — flexprice.io, makerkit.dev | 2026-09-15 | **B–** |
| Vercel Fluid: Active CPU $0.128/hr, Provisioned Memory $0.0106/GB-hr, **no included tier on Pro** | WebSearch — usagepricing.com, makerkit.dev, bex.co, Vercel changelog snippets | 2026-09-15 | **B–** |
| Vercel default function size 2 GB / 1 vCPU under Fluid | WebSearch — Vercel docs + changelog snippets, host-hunters | 2026-09-15 | **B–** |
| Vercel Fast Data Transfer overage $0.15–$0.35/GB by region | WebSearch — flexprice.io | 2026-09-15 | C |
| Vercel Edge Requests overage $2.00/million on Pro | WebSearch — schematichq, flexprice, makerkit (consistent) | 2026-09-15 | **B–** |
| Vercel crons: 100/project all plans; **Hobby daily-only, Pro 1-minute minimum**; sub-daily expression fails Hobby deploy | WebSearch — Vercel changelog snippet, steadycron, runhooks, crontap | 2026-09-15 | **B–** |
| Vercel `maxDuration`: Hobby 60 s ceiling, Pro 300 s | WebSearch — Vercel docs/changelog snippets, axonbuild | 2026-09-15 | **B–** |
| Supabase Pro $25/mo; 8 GB disk, 250 GB egress, 100 GB file storage, 100k MAU included | WebSearch — flexprice, uibakery, nocode.mba, metacto (consistent) | 2026-09-15 | **B–** |
| Supabase disk overage $0.125/GB/mo; egress overage $0.09/GB | WebSearch — schematichq, makerkit, flexprice | 2026-09-15 | **B–** |
| Supabase compute: $10 credit on paid plans; Micro $10, Small $15, Medium $60, Large $110, XL $210 | WebSearch — metacto, dev.to, flexprice | 2026-09-15 | C |
| Stripe US online card 2.9% + $0.30 | WebSearch — many, unanimous; matches this repo's 2026-09-06 and 2026-09-11 passes | 2026-09-15 | **B** |
| Stripe Billing **0.7%** of billing volume (Starter 0.5% / Scale 0.8% consolidated Jul 2024) | WebSearch — flexprice, usagebox, checkoutpage | 2026-09-15 | **B–** |
| No free-volume threshold on the Billing 0.7% | WebSearch, searched specifically, nothing found supporting one | 2026-09-15 | **C** (absence of evidence) |
| Stripe Tax adds 0.5%, opt-in via `automatic_tax` | `research/integrations/2026-09-06-stripe-billing-compliance.md`, "Sales tax (Stripe Tax)" section, line 31 | in-repo | B |
| Gmail API free; 1B quota units/day historic, 1.2M units/min/project + 6k/min/user for new projects; send = 100 units | WebSearch — Google quota page snippet, Nylas, Unipile | 2026-09-15 | **C** (vendor page unreachable) |
| Gmail send limits ~500/day consumer, ~2,000/day Workspace | WebSearch — Unipile, Nylas, Google support thread | 2026-09-15 | C |
| Gmail API charges planned "later in 2026," ≥90 days' notice; paid quota-increase option coming | WebSearch — Google quota page + release-notes snippets, Nylas 2026 guide | 2026-09-15 | C |
| Sentry Developer plan free, 5k errors/mo; Team $26/mo, 50k errors + 5M spans | WebSearch — costbench, sentrypricing, markaicode | 2026-09-15 | C |
| OpenAI `gpt-4o-mini` $0.15/1M in, $0.60/1M out; $0.215/customer/mo at 150 leads | `2026-09-15-ai-cost-per-lead.md` §0.1, §4 | in-repo | Token counts **A**, price **B–** |
| All 7 cron paths, schedules, and that each is global not per-business | `followup/vercel.json`; `cron/automation/route.ts:34`; `cron/gmail-sync/route.ts:28`; `automation.ts:748`; `gmailSync.ts:162` | 2026-09-15 | **A (Measured)** |
| `maxDuration = 300` on automation + gmail-sync + outlook-sync + office + reactivation + weekly-digest; 120 on crm-sync | each `route.ts`, line 5–12 | 2026-09-15 | **A** |
| `mapWithConcurrency(…, 3, …)` worker pool | `src/lib/concurrency.ts`; call sites above | 2026-09-15 | **A** |
| `POLL_MS = 45_000` notification poll; 2 DB queries per poll | `src/components/NotificationBell.tsx:24,56`; `src/app/api/notifications/route.ts:13-20` | 2026-09-15 | **A** |
| Gmail message bodies truncated at 5,000 chars on import | `src/lib/integrations/gmail.ts:548` | 2026-09-15 | **A** |
| Lead has 41 scalar columns and 10 btree indexes | `prisma/schema.prisma`, Lead block | 2026-09-15 | **A** |
| Audit `meta` carries "no credentials, no message bodies" | `src/lib/audit.ts:9` | 2026-09-15 | **A** |
| `AuditEvent` / `RateLimitHit` / `ProcessedWebhookEvent` have no retention policy | grep-verified; only deletion is `src/lib/businessData.ts:198-201`; `schema.prisma:978` concedes "Not pruned yet" | 2026-09-15 | **A** |
| Twilio credentials are per-`Business` ⇒ customer's own bill | `src/lib/twilio.ts:498-509`, `:563-567`; `Business.twilioAccountSid` | 2026-09-15 | **A** |
| `mode: "subscription"` + Billing Portal ⇒ Stripe Billing applies; no `automatic_tax` | `src/app/api/billing/checkout/route.ts:77-95`; `billing/portal/route.ts:30` | 2026-09-15 | **A** |
| `TRIAL_PERIOD_DAYS = 14`, `payment_method_collection: "if_required"` | `src/lib/billing.ts:21`; `checkout/route.ts:91` | 2026-09-15 | **A** |
| Tier prices $0 / $39 / $79; `TIER_AI_LEAD_CAP` now exists | `src/lib/pricing.ts:11,21,59` | 2026-09-15 | **A** |
| AI doc §5.1/§5.2 fixed by `d173a11` | `git show d173a11`; `schema.prisma:368`; `automation.ts:498-500`; `leads/cleanup/route.ts:94` | 2026-09-15 | **A** |
| Sentry wired at `tracesSampleRate: 0.05` | `src/sentry.server.config.ts:20`, `instrumentation-client.ts:19` | 2026-09-15 | **A** |

**The honest caveat about this whole document.** The *structure* of the cost — Stripe dominates, AI
is a tenth of it, infrastructure is noise, and the binding constraint is a 300-second timeout rather
than any bill — is robust to every assumption in it. Change `t_b` from 2 s to 6 s and the total goes
from $2.01 to $2.10. Change the lead mix and the AI line moves by cents. **The conclusions do not
depend on the soft numbers.** What the soft numbers do determine is the *scaling cliff* in §2.3, and
that one deserves a real measurement before anyone plans past a few hundred customers.
