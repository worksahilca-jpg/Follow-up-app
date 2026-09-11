# Self-hosting vs. Vercel, and build-your-own voice AI vs. OpenAI Realtime

**Checked: 2026-09-11.** Triggered by a real cost scare this week: an unexpected ~$40-60 Vercel
overage in a few days, traced mostly to voice-agent testing (long-held WebSocket connections
during calls, billed by Vercel's per-second compute model) plus PR preview builds. The founder is
now asking "what if we build our own system" — two genuinely separate questions bundled together:
should the app move off Vercel onto infrastructure we control, and should the voice AI itself move
off OpenAI's Realtime API onto a self-run speech pipeline. This document answers both, honestly,
for a solo/pre-revenue founder who just got scared by a bill and needs to see the real tradeoffs,
not just the sticker price.

**Grades follow house convention** (`2026-09-08-pentest-vendor-options.md`,
`2026-09-11-tier-pricing-recommendation.md`): **B** = vendor-published, multiple converging
snippets. **C** = third-party aggregator or estimate. **D** = not found / genuinely unverified.
Every external price is a WebSearch result-snippet, not a fetched-and-read page — same caveat the
prior pricing docs carry. Every number that's a modeling assumption (call volume, average call
length, customer counts) says so explicitly rather than being dressed up as measured.

**Read first, not repeated here:**
`research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md` (why build-it-ourselves-
bridge-plus-OpenAI-Realtime was chosen over both a third-party voice platform and a fully custom
stack — this document does not re-argue that comparison, it asks whether *this piece specifically*,
OpenAI Realtime, should now be replaced by something self-run), `voice-agent/README.md` and
`voice-agent/api/stream.js` (the actual bridge), `research/market/2026-09-11-tier-pricing-
recommendation.md` §5.1 (current infra rates: Vercel Pro $20/seat, Supabase Pro $25/mo, OpenAI
Realtime $0.02-0.11/min depending on model tier).

---

## Part 1 — Self-hosting vs. Vercel

### 1.1 What actually has to move — the real integration surface, read from the code

Two structurally different things are bundled under "the app," and they don't have the same
hosting requirements:

**A. The main Next.js app (`followup/`) — request/response, fits serverless fine.** Every one of
these completes in milliseconds to a few seconds; none of them holds a connection open:

| Surface | Routes (from `src/app/api/**`) | What breaks if the domain changes |
|---|---|---|
| Twilio (voice, SMS, WhatsApp) | `twilio/voice/[secret]`, `twilio/sms/[secret]`, `twilio/whatsapp/[secret]`, `twilio/status/[secret]`, `twilio/voice/transcription/[secret]`, `twilio/voice-agent-auth/[secret]`, `twilio/voice-agent-callback/[secret]` | Per-business webhook URLs configured in each customer's Twilio Console/subaccount need re-pointing |
| Meta (Facebook + Instagram OAuth + webhook) | `facebook/oauth/{start,callback,pending-pages,select-page}`, `instagram/oauth/{start,callback}`, `instagram/webhook` | Meta App redirect URIs (registered per-app, not per-business) need updating |
| Stripe (billing) | `billing/checkout`, `billing/portal`, `billing/webhook` | Stripe Dashboard webhook endpoint URL needs updating |
| Google OAuth (dual-purpose, one client) | `api/auth/[...nextauth]` (sign-in) **and** `integrations/gmail/{connect,callback,disconnect,...}` (Gmail data access) — two separate redirect URIs on the *same* OAuth client per `.env.example` | Both redirect URIs registered in Google Cloud Console need updating |
| Outlook OAuth | `integrations/outlook/{connect,callback,disconnect,status,sync}` | Azure App registration redirect URI needs updating |
| Generic/CRM webhooks | `webhooks/lead/[secret]`, `webhooks/outbound`, `webhooks/config`, `crm/config` | Third-party CRMs pushing into FollowUp need re-pointing |
| Embed widget | `embed/[businessId]/lead`, `embed/config` | Every customer's website has this script tag pointed at the current domain |
| Cron jobs (`vercel.json`) | `cron/automation` (hourly), `cron/gmail-sync`, `cron/outlook-sync`, `cron/crm-sync` (every 10 min), `cron/weekly-digest` (weekly) | Needs a replacement scheduler wherever this app lives |
| Gmail Pub/Sub push | `integrations/gmail/push` | Google Cloud Pub/Sub subscription push endpoint needs updating |

**The good news buried in that table: almost none of this is actually painful if the custom domain
(`followupbase.io`) moves with the app rather than the app moving to a new domain.** OAuth redirect
URIs, Twilio webhook URLs, Stripe's endpoint, and the embed widget are all anchored to the
*domain*, not to "Vercel" specifically — repoint DNS at the new host, keep TLS working on that
domain, and most of this integration surface doesn't need to be touched at all. The real work is
elsewhere: replacing Vercel's zero-config cron, TLS, atomic deploys, and preview environments with
something that does the same job on infrastructure the founder now has to run.

**B. The voice-agent bridge (`voice-agent/`) — structurally mismatched with serverless billing,
already known and stated in its own README.** It holds one WebSocket to Twilio and one to OpenAI
open for an entire call's duration — this is the literal opposite of what serverless compute is
priced for. Vercel's current Fluid Compute model bills **Provisioned Memory for the full lifetime
a function instance is alive, including I/O wait** — i.e., exactly the time spent holding a call
open waiting for the next audio frame — while Active CPU billing pauses only during that wait
(Grade B, vercel.com/docs/functions/usage-and-pricing, cross-checked against
flexprice.io/blog/vercel-pricing-breakdown, checked 2026-09-11). **This is the literal mechanism
behind this week's bill spike** — testing calls that held connections open racked up
Provisioned-Memory GB-hours regardless of how little CPU work was actually happening inside them.
This is true regardless of self-hosting: it's a property of what the bridge *does* (hold a
connection open), not of where OpenAI's Realtime API is called from.

### 1.2 Realistic self-hosted options and real 2026 cost, at both scales

Two important scoping notes before the numbers: (1) **the Postgres database (Supabase) does not
need to move** — it's already a separate vendor from Vercel, unaffected by this decision either
way, so self-hosting doesn't add a database-ops burden on top of everything else unless the founder
separately decides to self-host Postgres too (not suggested here). (2) At 100 real paying
customers, per `2026-09-11-tier-pricing-recommendation.md`'s modeled mix (~73% Plus / ~27% Pro of
paid accounts, ~20% voice attach), that's roughly 40,000+ leads/mo processed and a live automation
cron touching all 100 businesses every 10 minutes — real, not trivial, background load.

| Option | Tiny scale (handful of test businesses) | 100 paying customers | Confidence |
|---|---|---|---|
| **Vercel (current)** | Pro plan required for sub-daily crons (Hobby caps cron to once/day — Grade B, vercel.com/docs/limits, checked 2026-09-11) → **$20/mo seat** + usage, normally near $0 extra at this volume unless something (like held-open WebSockets or preview builds) spikes it | $20/mo seat + metered usage, scales with real traffic — no separate ops hire needed | B |
| **Hetzner Cloud VPS** (CPX21/CPX31, Germany/Finland/US) | **~$6-18/mo** for one small box running the Next.js app; CPX21-class shared vCPU is plenty at this volume (Grade B, hetzner.com; note a June 2026 price adjustment moved some tiers up, e.g. CPX31 4vCPU/8GB now ~$18-25/mo depending on when priced — Grade B/C, northflank.com/blog/hetzner-cloud-server-price-increases, checked 2026-09-11) | **~$25-50/mo** for a larger box (CPX31/CPX41) or two boxes behind a load balancer for redundancy — real revenue at this point means a single VPS as sole point of failure is a bad trade | B |
| **DigitalOcean Droplet** | **$6-12/mo** (1-2GB basic droplet; moved to per-second billing Jan 2026, capped at the flat monthly rate — Grade B, digitalocean.com/pricing/droplets, checked 2026-09-11) | **$24-48/mo** (4GB/2vCPU ~$24/mo, or two droplets + managed load balancer ~$12/mo extra) | B |
| **AWS Lightsail** | **$5-12/mo** (bundled compute+storage+transfer; new accounts get 3 months free on some bundles — Grade B, aws.amazon.com/lightsail, checked 2026-09-11) | **$24-40/mo** (4GB tier, or scale to Lightsail Containers/EC2 for redundancy) | B |
| **Fly.io** | **~$6-12/mo** for a small always-on shared-CPU Machine, billed per-second with no seat minimum (Grade B, fly.io/docs/about/billing, checked 2026-09-11) | **$30-80/mo**, scaling with multiple Machines/regions — genuinely usage-metered like Vercel, just a different meter and provider, so it does not eliminate metered-billing risk the way a flat VPS does | B |
| **Railway** | **$5/mo Hobby** (flat fee, includes $5 usage credit) — realistic for the app alone at this volume | **$20/mo Pro seat + usage** (~$10/GB-mo RAM, ~$20/vCPU-mo, ~$0.05/GB egress — Grade B/C, docs.railway.com/pricing/plans, checked 2026-09-11) — also usage-metered, same caveat as Fly.io | B/C |

**Voice-agent bridge specifically, moved off Vercel to a persistent process (the one piece that
structurally needs this):** a small always-on VM is enough — it's I/O-bound (relaying audio frames),
not CPU-bound. **$6-12/mo (DigitalOcean/Hetzner/Lightsail) or a single always-on Fly.io Machine at
roughly the same price** covers this at both tiny scale and 100 customers' worth of voice-agent
call volume (per the tier-pricing doc's own modeling, ~20% attach rate × 100 = ~20 voice-enabled
accounts, nowhere near enough concurrent-call volume to need more than one small box) — cost here
barely changes between the two scales because it's compute-per-call, not compute-per-customer, and
call concurrency (not customer count) is what would ever force scaling this up.

**Bottom line on dollars alone: self-hosting the whole thing is cheaper at both scales — by
$10-40/mo at tiny scale, more once support/failover work is counted at 100 customers — but the
delta is small enough that it should not be the deciding factor.** Section 1.3 explains why.

### 1.3 The real non-dollar costs — what breaks, and who fixes it at 2am

This is the part a solo founder who just got scared by a bill needs to hear plainly: **an
unmonitored outage is a worse surprise than a bill.** A bill is recoverable — you pay it, you set a
spend cap, you move on. A missed-call/missed-lead outage on a lead-recovery product, during
business hours, for a customer whose whole reason for paying is "never miss a lead again," is a
trust failure that can lose the customer outright, and there's no invoice for it — it just quietly
costs revenue.

What Vercel is currently absorbing for free that a self-hosted setup makes the founder's job,
concretely:

- **OS/runtime patching.** Someone has to run `apt update && apt upgrade` (or automate it) on a
  schedule, and actually notice when a security patch needs a reboot. On Vercel this doesn't exist
  as a task at all — there is no OS to patch.
- **TLS certificate renewal.** Let's Encrypt via Caddy or certbot mostly auto-renews, but "mostly"
  is the operative word — a renewal that silently fails (DNS change, a rate limit, a misconfigured
  cron) means the site starts serving a certificate error to every visitor, including every Twilio/
  Stripe/Meta webhook call, with no warning until someone (a customer, or the founder checking the
  site) notices. Vercel does this invisibly today.
- **Zero-downtime deploys.** Vercel's default behavior — build in a new deployment slot, then swap
  atomically — means a `git push` never drops a live request. A naive self-hosted deploy (`git pull
  && pm2 restart`) has a multi-second window where the process is down; for a service fielding
  inbound Twilio webhooks and Stripe events 24/7, that window can silently drop a real call or
  event. Avoiding this requires either hand-rolled blue/green scripting or adopting a self-hosted
  deploy tool built for it (Coolify, Dokku, Kamal are the common 2026 answers — worth naming as the
  actual mitigation if this path is taken, not a reason to avoid it, but real setup work regardless).
- **DDoS / traffic-spike absorption.** Vercel's edge network absorbs volumetric spikes and basic
  abuse automatically, invisibly, as part of the platform. A single small VPS has a hard capacity
  ceiling — a traffic spike, a misbehaving integration partner, or a deliberate flood against a
  public webhook route (`/api/twilio/**`, `/api/instagram/webhook`, `/api/embed/**` are all
  unauthenticated-by-design, since that's how a webhook has to work) can take the box down instead
  of just costing more money. That is a fundamentally different kind of "surprise" than a bill —
  one this founder has less warning of and less ability to instantly fix (a bill you can pay
  immediately; a downed VPS at 2am needs someone awake and skilled enough to fix it).
- **Backups.** Stays a non-issue either way — Supabase (already a separate managed Postgres
  vendor) keeps handling this regardless of where the Next.js app itself runs.
- **On-call, full stop.** Vercel has an SRE team whose job is keeping the platform up. A self-hosted
  solo founder *is* that team, with no rotation, no backup, and (per the founder's own stated
  situation) no revenue yet to justify hiring one.

None of this is a reason self-hosting is impossible or even unwise later — it's a real, named list
of what "we own it now" actually means, stated as plainly as the pricing tables above, because the
founder asking this question has already shown they react badly to being surprised by an
operational cost they didn't see coming, and an outage is exactly that kind of cost, just paid in
trust instead of dollars.

### 1.4 Recommendation

**Don't fully self-host the main app right now. Move only the voice-agent bridge — the one piece
structurally mismatched with serverless billing — off Vercel, and fix the actual root cause of this
week's bill first, because it's cheaper and faster than any re-platforming:**

1. **Immediately, before anything else: turn on Vercel's own Spend Management** (real-time
   usage alerts at 50/75/100% of a set spend cap, with an option to auto-pause production
   deployments at the limit — Grade B, vercel.com/docs/spend-management, checked 2026-09-11). This
   is a five-minute setting that directly prevents a repeat of exactly this week's scare, on the
   platform already in use, at zero migration cost.
2. **Also immediately: cut preview-deployment cost specifically**, since it was named as a real
   contributor this week — either disable preview deployments on branches that don't need them
   (`Ignored Build Step`, or `deploymentEnabled: false` per branch in `vercel.json`) or disable
   on-demand concurrent builds for the voice-agent project, which doesn't need PR previews the way
   a UI-heavy Next.js app might (Grade B/C, community.vercel.com, lucaberton.com/blog/reduce-vercel-
   build-costs-2026, checked 2026-09-11).
3. **Move the voice-agent bridge to a small always-on VM** ($6-12/mo, DigitalOcean/Hetzner/
   Lightsail — any of them work equally well for this) **and leave the main Next.js app on Vercel.**
   This is the one place the founder's instinct — "the current billing model doesn't fit what this
   thing actually does" — is correct: a persistent WebSocket-holding process billed by a metered
   compute model that specifically charges for connection-held-open time is a genuine architectural
   mismatch, confirmed directly by Vercel's own pricing docs (§1.1). Everything else in the app —
   webhooks, OAuth callbacks, cron jobs — is short-lived request/response work that Vercel's model
   was built for and prices cheaply at this volume.
4. **Revisit full self-hosting of the main app only if/when 100+ paying customers is a reality, not
   before.** At that scale the dollar savings become more material ($20-60/mo) and there's likely
   real revenue to justify either a part-time ops contractor or a tool like Coolify that
   productizes most of §1.3's concerns on top of a plain VPS. Before then, the founder's actual
   scarce resource is attention on getting the first paying customers — not becoming a systems
   administrator for a $20-40/mo saving.

---

## Part 2 — Build-your-own voice AI vs. OpenAI Realtime

### 2.1 What "build our own" actually requires

A phone call that feels natural (not obviously robotic or laggy) needs three models chained
together with tight latency, not one:

| Piece | Realistic self-hosted option | Notes |
|---|---|---|
| **Speech-to-text** | `faster-whisper` (CTranslate2-optimized Whisper), specifically the `large-v3-turbo` variant | MIT-licensed, commercially safe. Int8-quantized Turbo needs as little as ~1.6-2.5GB VRAM and runs well above real-time speed on a consumer GPU (Grade B/C, multiple converging sources incl. localaimaster.com, gigagpu.com, checked 2026-09-11). Genuinely the strongest, least-risky piece of a self-hosted stack. |
| **LLM (the conversation itself)** | Llama 3.1/3.3 8B (or similarly-sized open model) | Meta's Llama Community License permits commercial use (up to 700M MAU, far above FollowUp's scale) — no licensing landmine here. **Multilingual coverage is the real catch: Llama 3.1 officially lists 8 supported languages (English, German, French, Italian, Portuguese, Hindi, Spanish, Thai) vs. OpenAI's own claim of 50+ languages / 97% of global speakers for the GPT-4o family** the Realtime API is built on (Grade B/C, meta's own model card language, cross-checked against ucstrategies.com's GPT-4o benchmark review; checked 2026-09-11) — a real, material narrowing of language coverage, not a marketing nuance. |
| **Text-to-speech** | Coqui XTTS-v2, or Piper | **XTTS-v2 is licensed under the Coqui Public Model License, which is non-commercial-only** (Grade B, sourceforge.net/projects/xtts-v2, cross-checked, checked 2026-09-11) — using it in a paid SaaS product is a real legal problem, not a detail to fix later. Piper (MIT-licensed, commercially safe) is the fallback, but it's a much smaller, more "robotic-sounding" single-voice model designed to run on a Raspberry Pi with no GPU — a genuine quality downgrade for a customer-facing phone voice, not a wash. |
| **Real-time audio plumbing** | Custom streaming glue (VAD/turn-detection, barge-in handling, chunked audio between Twilio and each model) | This is exactly what `voice-agent/api/stream.js` already does for the OpenAI leg today — replacing OpenAI's single Realtime WebSocket with three separate models means building and maintaining that same chaining logic three times over, plus the queueing/back-pressure logic between them that a single speech-to-speech API handles internally. |

**GPU requirement:** running all three concurrently for one call needs roughly a single
24GB-class consumer GPU (RTX 4090-tier) if the LLM is quantized tightly, or a 48GB-class card
(L40S/A6000) for comfortable headroom — and **each additional simultaneous call needs proportionally
more GPU capacity.** This is a structurally different cost shape than OpenAI's Realtime API: OpenAI
scales automatically and bills strictly per active minute regardless of how many calls happen at
once; a self-hosted GPU has a hard concurrency ceiling, and two calls arriving at the same moment
either queue (unacceptable — a caller can't be told to wait for a GPU slot) or require paying for
a second always-on GPU that sits idle the rest of the time.

**Real current GPU rental prices (2026, Grade B, cross-checked across sources, checked
2026-09-11):**

| Provider/GPU | On-demand $/hr | Always-on monthly (24/7) |
|---|---|---|
| Vast.ai RTX 4090 (marketplace, median) | ~$0.29-0.42/hr | **~$210-300/mo** |
| RunPod RTX 4090 (Community Cloud) | $0.34/hr | **~$245/mo** |
| RunPod RTX 4090 (Secure Cloud) | $0.69/hr | **~$497/mo** |
| RunPod A100 (on-demand) | $1.39/hr | **~$1,000/mo** |

A rented GPU bills for the whole time it's reserved, whether or not a call is actually in progress
— this is the crux of the cost comparison in §2.2.

### 2.2 Honest total cost comparison — at what volume does self-hosting break even?

OpenAI's Realtime API is genuinely metered per minute of actual call time (already researched:
`gpt-realtime-mini` ≈ $0.02-0.05/min, full `gpt-realtime` ≈ $0.06-0.11/min, per the tier-pricing
doc). A self-hosted GPU, run always-on to avoid multi-second cold-start latency on an inbound call
(the realistic requirement — a caller cannot be put on hold while a GPU pod spins up), bills the
same flat amount every month **regardless of call volume.** That makes this strictly a fixed-cost-
vs-variable-cost breakeven question:

**Breakeven minutes/month = (fixed GPU cost) ÷ (OpenAI $/min avoided)**

| Self-hosted GPU (fixed, single box, no redundancy) | vs. `gpt-realtime-mini` (~$0.03/min) | vs. full `gpt-realtime` (~$0.085/min) |
|---|---|---|
| RunPod Community RTX 4090, ~$245/mo | **~8,200 min/mo** (~137 hrs) | **~2,900 min/mo** (~48 hrs) |
| Vast.ai median RTX 4090, ~$252/mo | **~8,400 min/mo** (~140 hrs) | **~2,965 min/mo** (~49 hrs) |

**These are single-GPU, zero-redundancy numbers.** Add a second GPU for concurrency/failover (a
real requirement once this is customer-facing, not optional) and the breakeven volume roughly
doubles — **5,900-16,800 minutes/month** depending on model tier.

**What that means in customer terms (explicit modeling assumption, not measured data — flagged as
such):** at 100 paying customers with the tier-pricing doc's own modeled ~20% voice attach rate
(~20 voice-enabled accounts) and a generous 40 min/customer/mo average, that's **~800 minutes/month
total** — roughly one-tenth to one-thirtieth of the volume needed for self-hosting to even match
OpenAI's mini tier on cost, before accounting for the redundancy this analysis hasn't even charged
for. **Self-hosting the voice AI does not pay off at 100 customers under any plausible assumption
checked here.** It starts to look interesting only somewhere in the range of several hundred to
low thousands of *voice-enabled* accounts sustaining real call volume — which, at a ~20% attach
rate, implies a total paying customer base well into four figures, not the "100 real paying
customers" scale this task asked about.

**And this cost comparison, even where it eventually favors self-hosting on paper, doesn't count:**
the engineering time to build and maintain the three-model chain and its plumbing (real, ongoing
work, not a one-time cost); the TTS licensing problem (§2.1) that has to be solved with either a
quality downgrade to Piper or a separate commercial TTS vendor, which reintroduces a per-word/
per-character cost that erodes the "just GPU rental" cost picture; and monitoring/scaling a GPU
fleet, which is a genuinely different and harder skill than anything else in this Next.js/Prisma
codebase — the same caveat the original voice-AI scoping doc already raised about the *WebSocket
bridge* being a different skillset than the rest of the app; a full custom speech pipeline is a
larger step again in that same direction.

### 2.3 The quality/latency tradeoff — a real product downgrade today, not a wash

- **Latency:** OpenAI's Realtime API reports P90 time-to-first-audio under 130-250ms depending on
  tier (Grade B/C, multiple converging sources, checked 2026-09-11) — this matches the ~200ms
  figure the existing voice-AI scoping doc already found. A self-hosted cascaded
  STT→LLM→TTS pipeline, even a well-optimized one (Deepgram-class streaming STT + vLLM-served LLM +
  streaming TTS), is reported at **~730-1,000ms time-to-first-audio in the best documented
  production examples found** (Grade C, single detailed source, checked 2026-09-11) — roughly
  **3-5× slower** than the integrated speech-to-speech model. Industry guidance converges on
  "keep the whole pipeline under ~1-2 seconds for a call to feel natural" — a self-hosted stack
  built well can land inside that bar, but it is a genuinely, measurably slower conversational
  experience than what's shipping today, not an invisible implementation detail.
- **Multilingual coverage:** the product's own research already establishes multilingual support as
  a deliberate design goal (`2026-09-06-voice-ai-and-multilingual-scoping.md`). Open LLMs like
  Llama officially cover a small, named list of languages (8, per Meta's own model documentation)
  versus OpenAI's much broader claimed coverage — this is the single clearest place where "build
  our own" is not a cost optimization, it is a real, stated capability downgrade for exactly the
  feature this product has already invested research into supporting.
- **Voice naturalness:** Piper (the commercially-safe TTS option) is explicitly designed to run
  with almost no compute, including on a Raspberry Pi — it is not competitive with OpenAI's
  Realtime voice output on naturalness, and the higher-quality open option (XTTS-v2) can't be used
  commercially at all (§2.1).

**Honest conclusion: today, a realistic self-hosted stack is a genuine downgrade on latency,
multilingual coverage, and voice quality simultaneously — not a hidden cost saving with no
tradeoff.** This is worth stating as plainly as the cost numbers, because "build it ourselves =
same thing but free" is the exact temptation this task was written to check, and it isn't true.

### 2.4 Recommendation

**Do not pursue building a self-hosted voice AI pipeline now, and don't plan to reconsider it
based on cost alone — reconsider it only if all three of these hold at once:** (1) real, sustained
call volume well past the low-thousands-of-minutes/month breakeven threshold in §2.2 — meaning
real product-market fit for the voice feature specifically, not just the product overall; (2) an
engineer (or the founder personally, if that's the team) with real ML/infra ops experience,
because this is a materially different skillset than the rest of the codebase; and (3) the
multilingual/latency/quality downgrade in §2.3 is either acceptable for the product's actual
customer base at that point, or the open-model landscape has genuinely closed that gap by then
(plausible over a multi-year horizon; not true today). None of those three conditions currently
hold for a solo/pre-revenue founder with a handful of test businesses.

---

## Part 3 — Synthesis: if I were advising this founder

Both questions the founder is asking share the same underlying instinct — "the bill scared me,
so let's own the infrastructure and pay a flat, predictable cost instead" — and in both cases the
instinct is understandable but points at the wrong lever for where this business actually is
right now: **pre-revenue, solo, still trying to land the first paying customers.**

- **The self-hosting question has a cheap, fast, correct answer that isn't "move everything off
  Vercel."** The bill scare had two identifiable, fixable causes (WebSocket-holding compute
  billing, and preview-build cost) and Vercel already ships a direct fix for both (spend caps,
  per-branch preview controls) that takes minutes to turn on. The one piece of the architecture
  that's a genuine structural mismatch — the voice-agent bridge holding calls open — is worth
  moving to a $6-12/mo persistent VM, because that's a real fix to a real problem, not a reaction
  to a scare. Moving the whole app off Vercel today would trade a $20-40/mo saving for taking on
  being the sole on-call sysadmin, TLS renewal, and deploy-safety engineer for a product that
  doesn't have revenue yet to justify that time cost — and an unmonitored outage during a live
  sales pitch to a first customer is a worse story than any Vercel invoice.
- **The build-your-own-voice-AI question is not close.** It is not just more expensive at this
  scale (it plainly is, per §2.2's breakeven math) — it is also, right now, a real downgrade on
  latency, multilingual coverage, and voice quality, three things this product has explicitly
  chosen to compete on. Pursuing it now would spend scarce founder time on infrastructure that
  makes the actual product worse, in service of a cost saving that doesn't materialize until call
  volume the business doesn't have yet.
- **The shared lesson underneath both:** the founder's stated fear — "I don't want another billing
  surprise" — is legitimate and worth acting on directly (spend caps, usage alerts, the 200-minute
  hard-stop on the voice add-on already designed into the pricing model), not by taking on a
  categorically different kind of operational risk (self-managed infra, self-run ML pipelines)
  that trades a dollar-shaped surprise for an uptime-and-trust-shaped one — which, for a company
  whose entire pitch is "never miss a lead again," is the more expensive failure mode to risk
  before there's a team to absorb it.

**If this founder does only three things after reading this:** turn on Vercel Spend Management
today; move the voice-agent bridge to a small always-on VM when there's a spare afternoon, not
urgently; and don't build a custom speech pipeline until call volume alone — not cost anxiety —
makes the case.

---

## Sources checked (WebSearch, 2026-09-11)

- https://vercel.com/docs/functions/usage-and-pricing
- https://flexprice.io/blog/vercel-pricing-breakdown
- https://vercel.com/docs/limits
- https://vercel.com/docs/spend-management
- https://vercel.com/blog/introducing-spend-management-realtime-usage-alerts-sms-notifications
- https://community.vercel.com/t/how-to-disable-every-branch-deployment-on-preview-env-in-vercel/7210
- https://lucaberton.com/blog/reduce-vercel-build-costs-2026/
- https://www.hetzner.com/cloud/regular-performance/
- https://northflank.com/blog/hetzner-cloud-server-price-increases
- https://www.digitalocean.com/pricing/droplets
- https://aws.amazon.com/lightsail (via search snippets, cloudburn.io, kuberns.com)
- https://fly.io/pricing/ , https://fly.io/docs/about/billing/
- https://docs.railway.com/pricing/plans
- https://www.runpod.io/pricing , https://www.runpod.io/gpu-models/rtx-4090
- https://vast.ai/pricing/gpu/RTX-4090
- https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks
- https://www.spheron.network/blog/faster-whisper-gpu-cloud-production-deployment-guide/
- https://sourceforge.net/projects/xtts-v2/ (Coqui Public Model License terms)
- https://www.pistack.xyz/posts/coqui-tts-vs-piper-vs-openvoice-self-hosted-tts-engines-guide-2026/
- https://inworld.ai/resources/openai-realtime-api-alternatives
- https://www.dograh.com/feeds/blog/self-hosted-voice-ai
- https://ucstrategies.com/news/gpt-4o-complete-guide-benchmarks-review-2026/ (carried forward from
  the prior multilingual scoping doc)
- Meta's own Llama 3.1/3.3 model documentation (officially listed supported languages)

**Internal files read:** `research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md`,
`voice-agent/README.md`, `voice-agent/api/stream.js`, `followup/vercel.json`,
`voice-agent/vercel.json`, `followup/.env.example`, `research/market/2026-09-11-tier-pricing-
recommendation.md`, `research/market/2026-09-10-pentest-engagement-scope.md`, full
`src/app/api/**` route tree (for the integration-surface enumeration in §1.1).
