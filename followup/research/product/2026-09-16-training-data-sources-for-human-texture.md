# Where FollowUp can legitimately learn "how humans talk" — and where it can't

**Date:** 2026-09-16
**Question asked:** get "all the data from anywhere, like how humans talk to each other," so FollowUp
can be trained to write human-textured messages.
**Scope:** what real-world source material is actually available and defensible; what is not; and
which of the two mechanisms (fine-tune vs. examples at inference) is right for this product.
**Code claims in this document were verified in-repo at the file:line given.** External claims are
search-sourced and graded in the source table at the end. No `src/` code was changed.

---

## The answer in one page

1. **The single best corpus for this product already exists and is already wired up: the customer's
   own sent mail.** `src/lib/voice.ts` pulls up to 5 of the business's own human-written outbound
   messages into the drafting prompt. Nothing public comes close, because the target is not "write
   like a human" — it's "write like *this* roofer." A general corpus cannot contain that.
2. **The public corpora that exist are real but a poor match**, and the most famous one (Enron) is
   2000-era internal corporate email from one bankrupt US energy company, with a licence status that
   sources actively disagree about. Details in Part 1 — read the "match" column before getting excited.
3. **Fine-tuning is the wrong mechanism here, and as of May 2026 it is also largely unavailable.**
   OpenAI began winding down its self-serve fine-tuning platform on 2026-05-07; organisations that had
   never run a fine-tuning job lost the ability to start one that day (search-sourced, Grade C — see
   Part 3, and verify with OpenAI directly before planning around it either way). Even if it were
   available, per-business fine-tunes don't work: a new customer has no data, a fine-tune is stale the
   day it ships, and the current in-context approach costs a **measured $0.000125 per draft**.
4. **A synthetic corpus buys volume and buys nothing else.** This codebase already lived the failure
   mode: the voice corpus was contaminated with FollowUp's own past output, so the account's "voice"
   drifted toward the machine. That is the same shape as training on generated text, and it has a
   name in the literature (model collapse, Nature 2024).
5. **The legal gap is not the business's consent — it's the lead's.** `Business.allowModelTraining`
   (`prisma/schema.prisma:160`) captures the *business owner's* opt-in. But the conversations contain
   the *lead's* personal information, and the lead never agreed to anything. Under PIPEDA that gap got
   materially riskier in May 2026 (Part 5).

---

## The hard constraint, stated plainly

The founder's phrasing — "all the data from anywhere" — includes, whether or not it's intended, a
category that is simply closed:

**Real private conversations between other people are not available to FollowUp and cannot be made
available.** Not scraped DMs. Not purchased inboxes. Not a competitor's exported data. Not a
"data partner" reselling somebody's CRM history. This is not a caution about optics; it's three
separate walls:

- **Platform terms.** Meta, Google and Twilio each prohibit using data obtained through their APIs
  for purposes outside what the user authorised. FollowUp needs all three of these companies to
  approve it — Meta App Review and Google OAuth verification are already the two biggest go-live
  blockers (`research/integrations/2026-09-10-meta-google-verification-playbook.md`). A training
  pipeline that repurposes API-obtained conversation data is precisely what those reviews look for.
- **Privacy law.** Lead messages are personal information about an identifiable person. Under PIPEDA
  and GDPR alike, collecting it for one purpose and using it for another needs a lawful basis for the
  new purpose. Purchased or scraped data has none, and buying it does not launder it.
- **Product positioning.** FollowUp's entire pitch is that it is not a spam tool. A company whose
  model was trained on other people's private messages cannot make that claim to a customer, an
  enterprise buyer, or a regulator.

So the rest of this document is about what IS available. That list is shorter than "anywhere" but it
is not short, and the best item on it is already half-built.

---

## Part 1 — Public, properly-licensed corpora

### Summary table

| Corpus | What it is | Size (search-sourced) | Licence | Match to "tradesperson replying to a lead, 2026" |
|---|---|---|---|---|
| **Enron Email (CMU/CALO)** | Internal email of ~150 Enron managers/executives, released by FERC during the investigation | 517,431 emails, 151 employees (CMU version); one source says 619,446 / 158 for the raw FERC set | **Disputed — see below** | **Poor.** Wrong era, wrong register, wrong relationship |
| **Avocado Research Email Collection (LDC2015T03)** | Email + attachments from 279 accounts of a defunct IT company | 279 accounts | Two signed agreements required (Organizational + End User); LDC membership/fee — **price unverified** | **Poor.** Internal corporate email again, plus a licence that forbids casual use |
| **Customer Support on Twitter (Kaggle, "thoughtvector")** | Inbound customer tweets + brand support replies | >3M tweets | `cc-by-nc-sa-4.0` — **NonCommercial** | Register is closer (short, public-facing, service-oriented) but **NC kills it for a paid SaaS** |
| **MultiWOZ 2.2** | Task-oriented human-human dialogue, Wizard-of-Oz collected | >10,000 dialogues | Apache-2.0 (one source says MIT; discrepancy noted) | **Poor for voice.** Booking-slot dialogue, written to be annotatable, not to sound like a person |
| **Schema-Guided Dialogue (SGD)** | Multi-domain task dialogue | >16k conversations | **Unverified** | Same as MultiWOZ: structure research, not prose style |
| **Bitext customer-support datasets (Hugging Face)** | Support intents/utterances for chatbot fine-tuning | Multiple domain sets | `cdla-sharing-1.0` (attribution + share-alike on derivatives) | **Poor, and it's synthetic** — see Part 4 |

### Enron, specifically — because it's the one everyone reaches for

**What's true:** it is the only substantial collection of real business email that is publicly
downloadable. It exists because the Federal Energy Regulatory Commission subpoenaed and published
Enron's mail during the investigation; CMU (William Cohen, via the CALO project) cleaned it into
per-mailbox form and that version is the one research uses. ~517k messages, ~150 people.
(Search-sourced, corroborated across Internet Archive's copy of the CMU dataset page, enrondata.org,
SNAP, and Wikipedia's Enron Corpus entry; checked 2026-09-16, Grade B.)

**What's not settled — and this is the part that matters legally:** sources disagree about whether
commercial use is permitted. Some describe the material as public domain by virtue of the FERC
release; at least one summary describes it as **"openly available for non-commercial research use."**
I could not reach `cs.cmu.edu` to read the canonical page (egress blocked by the proxy on this
machine), so **I cannot confirm what licence text, if any, the distributor actually publishes.**

> **Do not treat "Enron is public domain" as established.** It is repeated constantly and I could not
> verify it at source. If FollowUp ever wants to use it in a commercial product, that is a
> ten-minute question for counsel with the actual CMU page in hand, not a thing to assume.

**Why it's a poor fit even if the licence clears.** Every one of these is disqualifying on its own,
and they stack:

- **Era.** The mail is from roughly 1999–2002. No smartphones, no SMS register, no WhatsApp, no
  "sorry — just seeing this." An industry analysis published 2025-08 argues explicitly that the
  corpus should be retired as a benchmark because it no longer resembles modern communication
  ("Still on Dial-Up: Why It's Time to Retire the Enron Email Corpus", EDRM/Craig Ball, Grade C —
  it's an opinion piece, but the era argument is self-evidently correct).
- **Relationship.** It is colleague-to-colleague internal mail inside a large corporation. FollowUp's
  target text is a *business owner replying to a stranger who wants something quoted*. Different
  power dynamic, different length, different goal, different politeness.
- **Register.** Senior managers at an energy company in 2001 do not write like a plumber texting back
  about a burst pipe.
- **Ethics.** The people in that corpus never consented; it exists because of a subpoena. That's a
  documented and ongoing concern in the research community (Grade C). Even where legal, "we trained
  on the Enron leak" is a sentence that will appear in a security questionnaire someday.

**Verdict: not worth using for voice.** There is one narrow thing it could be honestly useful for:
as an *evaluation* set of human-written (not model-written) business email, to sanity-check whether a
classifier can tell human text from generated text. That is a research nicety, not a priority.

### What about the big general corpora (BNC, COCA, etc.)?

I did not verify licences for these and am not recommending them, so I am not going to list sizes I
haven't checked. The reasoning that makes them moot is structural, not legal: a balanced corpus of
general English tells a model about English. Modern base models already know English better than any
corpus you could assemble. **FollowUp's deficit is not English. It's this-person-ness.**

### The honest summary of Part 1

There is **no public corpus of a small-business owner replying to inbound leads in 2026.** It does not
exist, because that data is private by nature — which is the same reason FollowUp can't buy it. Every
public option is either the wrong era, the wrong relationship, non-commercially licensed, or
synthetic. Spending engineering weeks on any of them is spending them on the wrong problem.

---

## Part 2 — FollowUp's own data (verified in-repo)

### What's built

**`src/lib/voice.ts` — the voice corpus.** `getVoiceSamples(businessId)` (line 158) returns up to
**5** (`MAX_SAMPLES`, line 44) of the business's own outbound messages, newest-first, 40–500
characters each (lines 45–46), at most 2 from any one lead (line 52, `MAX_SAMPLES_PER_LEAD`), scanning
back up to 1,000 messages in pages of 200 (lines 59–60) to find human ones under a pile of automated
sends.

The corpus is filtered to **human-written** text by four structural exclusions, not by judging the
prose:

- `source: null` (line 171) excludes third-party echoes captured from Meta — often Meta's own Business
  AI answering a DM;
- `channel: { notIn: NON_WRITTEN_CHANNELS }` (line 173, list at line 65: `voice-agent`, `call`)
  excludes spoken turns, which say nothing about how someone writes;
- `isMachineSent()` (lines 107–118) excludes anything matching a `FollowUp` row for that lead, either
  by exact body match or by a ±5-minute `sentAt` window (line 73) that catches the provider's
  re-ingested copy of a FollowUp send;
- the query is scoped by `lead: { businessId }` (line 174), so one account never sees another's mail.

That last exclusion — FollowUp's own sends — is the one that was fixed this cycle, and it is the most
important line in this entire report. Before it, the "how this business writes" corpus contained the
model's own prior output. See Part 4.

`src/lib/__tests__/voice.test.ts` covers this with 14 tests, including
`"returns nothing at all when every outbound message was sent by FollowUp"` (line 215) and
`"scopes every follow-up lookup to leads from this business's own messages"` (line 130).

**Consumption is at inference time, not training time.** `generateFollowUpMessage` takes
`voiceSamples: string[] = []` (`src/lib/integrations/openai.ts:847`) and builds a `voiceBlock`
(line 866) instructing the model to copy *manner only* — "Never reuse a sample's sentences, subject
lines, prices, names or any other specific detail — only the manner" (line 879) — with an explicit
no-samples fallback that states a plain default style (line 883). Callers:
`src/lib/scoring.ts`, `src/lib/automation.ts`, `src/lib/sequences.ts`,
`src/app/api/leads/[id]/regenerate/route.ts`.

**`src/lib/deidentify.ts` — the training boundary (task #74).**
`buildDeidentifiedTrainingSet(businessId)` (line 138) is gated on
`business.allowModelTraining` and returns `[]` before reading a single lead if it's off (lines 139–143).
Every message body passes through `deidentifyText()` (line 105): targeted substitution of the lead's
name/email/phone/company and the assigned agent's name/email with role placeholders
(`leadIdentifiers`, line 50; `agentIdentifiers`, line 64), including digit-level phone matching that
survives reformatting (`phoneDigitsPattern`, line 83), then a generic
`EMAIL_RE`/`PHONE_RE`/`ADDRESS_RE` backstop (line 110).

Two limits the file states about itself and which I confirm: it covers **`Message.body` only** —
`Lead.notes`, `scoreReason` and `AIInsight.summary` are free text and are not covered (header, lines
26–30) — and **nothing is wired into a training job, because FollowUp doesn't have one** (lines 30–32).
`docs/security-roadmap.md` rule 3 ("Separate store") is unchecked for the same reason.

**`prisma/schema.prisma:160`** — `allowModelTraining Boolean @default(false)`, documented in the
schema as opt-in. It is read in exactly two places in `src/`: `deidentify.ts:141` and
`businessData.ts:115`. **There is no UI that sets it** — `grep` across `src/app` and `src/components`
returns no writes. Today it is a field that is always `false` in practice.

### So what does the product already have permission to learn from?

| Data | Permission today | Notes |
|---|---|---|
| The business's own sent mail, **used inside that same business's prompt** | **Yes, and it's the right answer.** This is the customer's own data used to serve the customer, which is what they connected their mailbox for | This is what `voice.ts` does |
| The business's conversations, **used to train a cross-customer FollowUp model** | **No — not yet.** Needs `allowModelTraining` on (never settable today), and even then see Part 5: the *lead's* consent is missing | `deidentify.ts` is the boundary that would have to exist first; it does |
| Another business's mail as a style source | **Never.** Scoped out at the query (`voice.ts:174`) | |
| Public corpora | Per-corpus; see Part 1 | Enron's licence is unverified |

### The honest ceiling on a new account

**Day-zero with no connected mailbox: zero samples, and the code is right to say so.** `getVoiceSamples`
returns `[]` and the prompt falls back to a stated default style (`openai.ts:883`). The file header
puts it correctly: "no samples beats misleading samples" (lines 155–156).

**Day-zero with Gmail connected: usually better than zero, capped at 90 days.** Gmail sync queries
`newer_than:90d` (`src/lib/integrations/gmail.ts:851`) and marks a message `outbound` when the sender
is the connected account (`gmail.ts:547`). So a new account can have real human samples within minutes
of connecting — but only from mail on threads that became *leads*. A business whose last 90 days of
human email was mostly with suppliers, staff and its accountant will surface very little, because
`voice.ts` only reads messages on lead conversations.

**The remaining structural ceiling: 5 samples, 500 characters each.** That is roughly 832 input tokens
(measured — see Part 3). It is a style hint, not a corpus. It cannot teach the model the owner's
pricing habits, their trade vocabulary or their scheduling norms; it teaches sentence length,
punctuation, greeting/sign-off habits, formality. That is genuinely most of what "sounds human"
means in a three-sentence follow-up, which is why it works — but it is worth being clear about what
it is, because "train on our customers' voices" sounds much bigger than what is actually happening
and what actually needs to happen.

---

## Part 3 — Fine-tune vs. examples at inference

**Recommendation: keep doing what the code does now (examples at inference). Do not build a
fine-tuning pipeline.** Five reasons, strongest first.

### 1. The target makes fine-tuning the wrong shape

The goal is not "write like a human in general" — a modern base model already does that adequately —
it's "write like **this** business owner." That is a per-customer target, and a fine-tune is a
per-model artifact. One fine-tune per business means one model per business: training cost per
customer, a cold-start problem for every new signup, and a staleness problem the moment the owner's
style shifts or they hire someone. The literature agrees with the codebase here: research on
personalising LLM writing style notes that real users supply too few samples for effective
fine-tuning and that maintaining a separate fine-tuned model per user is costly and impractical at
scale, while few-shot in-context exemplars are a single API call
(search-sourced, arXiv:2509.14543 "Catch Me If You Can? Not Yet: LLMs Still Struggle to Imitate the
Implicit Writing Styles of Everyday Authors" and related work, Grade C — I read search summaries, not
the full papers). One summary puts the useful exemplar count at 2–5 for style imitation, which is
exactly `MAX_SAMPLES = 5`. That alignment is a coincidence worth keeping.

The same body of work carries a caveat FollowUp should hold honestly: even with exemplars, current
models **still** struggle to reproduce nuanced personal style, especially in informal registers. The
in-context approach isn't a solved problem — it's the better of two imperfect options, and it's the
one that costs almost nothing.

### 2. A single shared fine-tune would train the wrong thing

The alternative to per-business fine-tunes is one shared "FollowUp model" trained on de-identified
conversations across customers. That model would learn the **average** of all customers' voices —
which is a generic voice, which is precisely the thing the founder is trying to escape. Averaging
1,000 tradespeople does not produce a human-sounding tradesperson; it produces the median, which reads
like a template. In-context samples work *because* they are not averaged.

There is a narrower thing a shared fine-tune could legitimately buy — better *structure* (when to ask
one question vs. two, when to offer a time slot) rather than better voice. That is a real research
question, and it is not what was asked for here, and it is not worth opening while the legal
prerequisites in Part 5 are unmet.

### 3. It may not even be purchasable anymore

**OpenAI began winding down its self-serve fine-tuning platform on 2026-05-07.** Per multiple
secondary sources: organisations that had never run a fine-tuning job lost the ability to start one
that day; from 2026-07-02 organisations with no fine-tuned-model inference in the prior 60 days can't
start new jobs; on 2027-01-06 remaining customers lose the ability to create new jobs. Inference on
already-trained models continues until the base model is deprecated. OpenAI's stated rationale is
that newer base models follow instructions well enough that prompt-based approaches are cheaper and
faster.

**Grade C — search-sourced from secondary blogs/analyses, not read off OpenAI's own deprecations page
(I could not verify at source from this machine).** But note the direction of the risk: if this is
true, FollowUp — which has never run a fine-tuning job — **cannot start one at all**, and planning
around fine-tuning would be planning around a capability it doesn't have. If someone wants to pursue
fine-tuning anyway, step one is confirming access on OpenAI's own console before any other work.

### 4. The cost comparison isn't close

From `research/product/2026-09-15-ai-cost-per-lead.md` (measured token counts, Grade A for that file
revision; `gpt-4o-mini` prices Grade B–):

- Draft prompt **without** voice samples: 1,274 input tokens → **$0.000282** per draft
- Draft prompt **with 5 voice samples**: 2,106 input tokens → **$0.000407** per draft
- **The entire cost of voice, therefore, is 832 input tokens = $0.000125 per draft** — about 6% of the
  $0.00217 all-in per-lead AI cost.

Against that: fine-tuned inference carries a standing premium — a fine-tuned `gpt-4o-mini` is cited at
$0.30/1M inference tokens, **2× the base model**, and fine-tuned `gpt-4o` at $3.75/$15 per 1M
in/out with $25/1M training tokens (search-sourced, Grade C — pricing aggregator sites, vendor page
not reachable). Doubling inference price to *remove* a $0.000125 line item is a straight loss, before
counting training cost, pipeline engineering, per-customer retraining, and the staleness problem.

**A fine-tune's cost is permanent and its knowledge is frozen. An in-context sample costs a fraction
of a cent and is always current** — `voice.ts` reads newest-first (line 177) precisely so the samples
reflect how the owner writes *now*, a change the file header documents as deliberate (lines 27–33).

### 5. The cheap wins are in the prompt, not the weights

If drafts still don't sound human enough, the levers that cost days rather than quarters:
raise `MAX_SAMPLES` (5 → 8) and measure the quality delta against the ~166 extra tokens per sample;
widen `MAX_SAMPLE_LENGTH` past 500; loosen the 90-day Gmail window for the initial backfill only, so
new accounts start with a deeper voice corpus; extend voice sampling to SMS/DM outbound so the short-
form register is represented, not just email. Each is a contained change to existing code with a
measurable cost, and each should be A/B'd against draft-approval rate before the next one.

---

## Part 4 — What a synthetic corpus buys (and what it costs)

**It buys volume, coverage of rare scenarios, and clean labels. It does not buy human texture,
because it does not contain any.**

Generated dialogue is a model's idea of how people talk. Training a model on it teaches the model to
agree with itself. This is documented: Shumailov et al., *"AI models collapse when trained on
recursively generated data"*, Nature 631:755–759 (2024) — indiscriminate training on model-generated
content causes irreversible defects, with the tails of the original distribution disappearing first
and output converging toward a low-variance point estimate (search-sourced, Grade B: real paper, real
journal, real DOI path on nature.com, plus a published author correction; I read summaries, not the
paper). The tails are exactly where human texture lives — the typo left in, the abrupt sign-off, the
"give me a shout when you're free."

**This codebase already ran the experiment in miniature.** Before the current filtering, `voice.ts`'s
corpus of "how this business writes" could contain messages FollowUp itself had drafted and sent. The
file header describes the consequence precisely (lines 21–25): *"the model reads its own previous
output, matches it, and the account's voice drifts toward the machine — the exact opposite of what
this feature exists to do."* One loop iteration, at one account, with five samples — and it was
already degrading the thing it was built to protect. A synthetic training corpus is the same loop
run deliberately, at scale, with no filter at the end.

Worth noting for realism: the Bitext support datasets in Part 1 are exactly this — generated/templated
support utterances. They're fine for intent classification. They are not a source of human voice.

**Where synthetic data IS legitimately useful for FollowUp**, and the distinction is sharp:

- **Evaluation and red-teaming.** Generated adversarial lead messages to test prompt-injection
  resistance, generated edge-case leads to test scoring. Nobody's voice is being learned.
- **Structural test fixtures** — already how the test suite works.
- **Never as voice signal.** The moment generated text enters a style corpus, the loop is back.

---

## Part 5 — Legal: PIPEDA and GDPR

### The gap that matters: the business consented, the lead didn't

`Business.allowModelTraining` records the **business owner's** opt-in. But the conversations contain
the **lead's** personal information — their name, their number, what they want done to their house —
and the lead has no relationship with FollowUp at all. They messaged a plumber.

`docs/security-roadmap.md` already states the right instinct ("Lead content is personal information
under PIPEDA; the business is the custodian, not us"), but that framing cuts against the training
plan rather than for it. Under GDPR terms: FollowUp acts as a **processor** for the business
(controller) when it handles lead conversations to deliver the service. **A processor that uses that
data to train its own AI model becomes a controller for that processing** — and is exposed to
sanction for going beyond the controller's instructions (search-sourced across EDPB Opinion 28/2024
commentary from Osborne Clarke, Browne Jacobson, IAPP; checked 2026-09-16, Grade B — multiple
independent law-firm summaries of a real, citable EDPB opinion adopted 2024-12-17). As controller,
FollowUp needs its own lawful basis toward the *lead*, not a checkbox from the business.

EDPB Opinion 28/2024 also holds that **a model trained on personal data is not automatically
anonymous** — anonymity requires that both direct extraction and extraction-by-querying be
insignificant, assessed case by case. De-identifying the training set (which `deidentify.ts` does
well) is necessary and is not by itself sufficient to put the resulting model outside GDPR.

### PIPEDA got sharper in May 2026

The Office of the Privacy Commissioner of Canada, jointly with Alberta and BC, published
**PIPEDA Findings #2026-002** (joint investigation of OpenAI OpCo, LLC): OpenAI argued it could rely on
**implied** consent to use personal information in user interactions for model training; the
regulators found it **should have obtained express consent** (search-sourced from the OPC's own domain,
`priv.gc.ca`, checked 2026-09-16, Grade B — I did not fetch the full findings text, and anyone
relying on this should read it directly).

The practical reading for FollowUp:

- A buried "we may use your data to improve our services" clause is **not** meaningful consent for
  model training. OPC's meaningful-consent standard requires a reasonable person to understand the
  nature, purpose and consequences of the specific use.
- Express, specific, separately-obtained consent is the safe posture for training use.
- FollowUp's structural problem remains that the person whose consent matters most — the lead — is
  reachable only through the business, and asking a lead "may we train an AI on your plumbing
  enquiry?" is a product experience nobody wants to ship.

### Is `allowModelTraining` sufficient?

**No — but it is the right first brick, and the code around it is unusually disciplined.**

| | Status |
|---|---|
| Opt-in default `false`, checked before any read | **Yes** — `deidentify.ts:139–143`, `schema.prisma:160` |
| De-identification before data leaves the DB | **Yes** — `deidentifyText()`, `deidentify.ts:105`, two layers, 10+ tests |
| Covers all free text | **No** — `Message.body` only; `Lead.notes`, `scoreReason`, `AIInsight.summary` excluded (file header, lines 26–30) |
| Separate training store with retention + access log | **No** — `security-roadmap.md` rule 3 unchecked |
| A way for the business to actually set the flag | **No** — no writer in `src/`; it is permanently `false` today |
| Consent from the **lead** (the actual data subject) | **No** — and this is the real blocker |
| Privacy policy / DPA language covering training use | **No** — `security-roadmap.md` Level 3 items unchecked |

**Verdict: the flag is a good boundary and a bad basis.** It would let FollowUp honestly say "we only
touch data from businesses that opted in." It would not answer "what lawful basis do you have toward
the lead?", which under both PIPEDA post-2026-002 and GDPR post-Opinion-28/2024 is the question that
gets asked. Before any cross-customer training happens, the missing pieces are: express, specific
business consent through real UI; a disclosure path to leads (likely via the business's own privacy
notice, since the business is the controller); privacy-policy and DPA text; and the separate store
with retention. That's a legal project, not an engineering sprint.

---

## Ranked recommendation

### Do these

1. **Keep the in-context voice approach and invest in it.** It is already built, already correct,
   already tested, costs $0.000125 per draft, is always current, needs no fresh consent (it's the
   customer's own data serving the customer), and targets the thing that actually matters —
   *this* business's voice, not humans in general.
2. **Deepen the voice corpus with contained, measurable changes.** In rough order of expected value
   per day of work: extend voice sampling to SMS/DM outbound (short-form register is missing entirely
   and is closest to how a tradesperson actually replies); raise `MAX_SAMPLES` 5→8 and
   `MAX_SAMPLE_LENGTH` past 500, measuring the ~166-token-per-sample cost against draft-approval rate;
   deepen the Gmail backfill window beyond `newer_than:90d` for the initial connect only, so new
   accounts start with more voice. Hand to `backend-ai-agent`; each is a small diff with a number
   attached.
3. **Fix the day-zero gap at onboarding, not with a corpus.** The honest ceiling on a brand-new
   account with no sent history is zero samples. The product answer is to *ask* — a short onboarding
   step where the owner pastes or writes two or three replies in their own words is worth more than
   any public dataset, arrives instantly, and carries no consent problem because they typed it for
   this purpose. This is the highest-value item on the list for new customers and it is a design
   question, not a data question.
4. **Before any cross-customer training: build the consent, not the pipeline.** Express opt-in UI for
   `allowModelTraining` with specific plain-language purpose text; privacy-policy and DPA language;
   the separate training store with retention and access log (`security-roadmap.md` rule 3);
   extend `deidentify.ts` to `Lead.notes`, `scoreReason` and `AIInsight.summary`; and a legal answer
   on the lead-consent question. Until those exist there is nothing safe to train on, so building a
   trainer first would be building the second half of a bridge.

### Don't bother with these

5. **Public corpora as a voice source.** Enron is 25 years old, from one bankrupt US energy company,
   internal-colleague register, with a licence that sources actively disagree about and that I could
   not verify. The customer-support Twitter corpus is NonCommercial. Task-oriented dialogue sets
   teach structure, not prose. None of them contains a 2026 tradesperson replying to a lead, because
   no public dataset does.
6. **Fine-tuning, in any form.** Wrong shape for a per-business target; a shared fine-tune would
   learn the generic average that the founder is trying to escape; standing inference premium
   (~2× for `gpt-4o-mini`, search-sourced); and OpenAI appears to have closed self-serve fine-tuning
   to organisations like FollowUp that never ran a job before 2026-05-07. Confirm that last point on
   OpenAI's console before spending an hour on this either way.
7. **A synthetic conversation corpus.** It contains no human texture by construction, and this
   codebase already watched a five-sample version of this loop pull an account's voice toward the
   machine. Use generated text for evaluation and adversarial testing; never as voice signal.
8. **Anything involving conversation data FollowUp didn't collect for this purpose.** Scraped,
   purchased, partner-supplied, competitor-derived. Closed on platform terms, closed on privacy law,
   and fatal to the product's positioning.

**One-line version for the founder:** the data you want doesn't exist publicly and can't be bought,
but you already have something better — your customers' own mail, in their own words, already in the
prompt for a hundredth of a cent. Make that corpus deeper and make day one not start empty.

---

## Source table

Code claims were read directly in this repo at the revision checked out on 2026-09-16 (branch
`claude/followup-demo-to-production-4k39hr`). External claims are **search-sourced** — `WebFetch` is
blocked by the network egress proxy on this machine, so **no external page was read at source.**
Grades: **A** = verified in-repo / measured; **B** = multiple independent secondary sources agreeing,
or a primary-domain search result; **C** = single or weak secondary sourcing, treat as a lead to
verify, not as fact.

| Claim | Source | Checked | Grade |
|---|---|---|---|
| All `file:line` code references in Parts 2–4 | Read in-repo | 2026-09-16 | **A** |
| Draft prompt token counts and per-call costs | `research/product/2026-09-15-ai-cost-per-lead.md` (measured there) | 2026-09-16 | **A** for tokens, B– for prices (inherited) |
| Enron corpus: 517,431 emails, 151 employees, CALO/CMU prep, FERC origin | WebSearch: Internet Archive copy of CMU dataset page, enrondata.readthedocs.io, SNAP, Wikipedia | 2026-09-16 | **B** |
| Enron licence status **disputed** (public domain vs. non-commercial research use); CMU page unreachable | WebSearch, conflicting summaries; `cs.cmu.edu` EGRESS_BLOCKED | 2026-09-16 | **C — explicitly unverified, do not rely on** |
| Enron lack-of-informed-consent concern | WebSearch summaries of research commentary | 2026-09-16 | C |
| "Retire the Enron corpus" argument | EDRM / Craig Ball, published 2025-08 (opinion) | 2026-09-16 | C |
| Avocado (LDC2015T03): 279 accounts, two signed agreements required | WebSearch: LDC catalog, OLAC, NYU guide | 2026-09-16 | B |
| Avocado price | **Not found — unverified** | 2026-09-16 | — |
| Customer Support on Twitter: >3M tweets, `cc-by-nc-sa-4.0` | WebSearch: Kaggle listing, HF mirror | 2026-09-16 | B |
| MultiWOZ 2.2: >10k dialogues, Apache-2.0 (one source says MIT) | WebSearch; sources conflict | 2026-09-16 | C |
| SGD: >16k conversations; licence not found | WebSearch | 2026-09-16 | C / unverified licence |
| Bitext support datasets: `cdla-sharing-1.0`, synthetic | WebSearch: Hugging Face dataset cards | 2026-09-16 | B |
| OpenAI fine-tuning wind-down: 2026-05-07 / 2026-07-02 / 2027-01-06 stages | WebSearch: multiple secondary blogs/analyses; OpenAI deprecations page not read at source | 2026-09-16 | **C — confirm on OpenAI's console before relying on it** |
| Fine-tuned `gpt-4o-mini` at $0.30/1M inference (2× base); `gpt-4o` $25/1M training, $3.75/$15 inference | WebSearch: pricing aggregators (pricepertoken, cloudzero, aicostcheck) | 2026-09-16 | C |
| Few-shot exemplars beat fine-tuning for per-user style; 2–5 exemplars typical; models still struggle with nuanced personal style | WebSearch: arXiv:2509.14543 and related personalisation papers (summaries only) | 2026-09-16 | C |
| Model collapse on recursively generated data | Shumailov et al., Nature 631:755–759 (2024), + author correction | 2026-09-16 | **B** |
| EDPB Opinion 28/2024 (adopted 2024-12-17): AI models not automatically anonymous; case-by-case; legitimate interest available but must be specific | WebSearch: EDPB PDF listing plus Osborne Clarke, Browne Jacobson, IAPP, Paul Weiss, HSF Kramer summaries | 2026-09-16 | **B** |
| A processor training its own AI model on customer data becomes a controller for that processing | WebSearch: law-firm summaries + IAPP piece on processor status | 2026-09-16 | B |
| PIPEDA Findings #2026-002 (OPC/AB/BC, joint OpenAI investigation): express consent required for training on user interactions | WebSearch result on `priv.gc.ca`; full findings text not read | 2026-09-16 | **B — read the findings directly before acting** |
| OPC meaningful-consent standard (nature/purpose/consequences understood) | WebSearch: `priv.gc.ca` consent guidance pages | 2026-09-16 | B |

**Links for the graded claims above:**
[Enron dataset (Internet Archive copy of the CMU page)](https://archive.org/details/2011_04_02_enron_email_dataset) ·
[CALO Enron Email Dataset (enrondata)](https://enrondata.readthedocs.io/en/latest/data/calo-enron-email-dataset/) ·
[SNAP Enron network](https://snap.stanford.edu/data/email-Enron.html) ·
[Enron Corpus (Wikipedia)](https://en.wikipedia.org/wiki/Enron_Corpus) ·
[Still on Dial-Up: Why It's Time to Retire the Enron Email Corpus (EDRM)](https://edrm.net/2025/08/still-on-dial-up-why-its-time-to-retire-the-enron-email-corpus/) ·
[Avocado Research Email Collection (LDC2015T03)](https://catalog.ldc.upenn.edu/LDC2015T03) ·
[Avocado Organizational License Agreement (PDF)](https://catalog.ldc.upenn.edu/license/avocado-collection-organization-agreement.pdf) ·
[Customer Support on Twitter (Kaggle)](https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter) ·
[MultiWOZ 2.2 paper](https://arxiv.org/pdf/2007.12720) ·
[Bitext customer-support dataset (Hugging Face)](https://huggingface.co/datasets/bitext/Bitext-customer-support-llm-chatbot-training-dataset) ·
[OpenAI API deprecations](https://developers.openai.com/api/docs/deprecations) ·
[OpenAI fine-tuning wind-down analysis (tessl.io)](https://tessl.io/blog/openai-shutting-fine-tuning-signals-for-enterprise-ai) ·
[LLM fine-tuning pricing comparison](https://pricepertoken.com/fine-tuning) ·
[Catch Me If You Can? Not Yet (arXiv:2509.14543)](https://arxiv.org/html/2509.14543v1) ·
[AI models collapse when trained on recursively generated data (Nature)](https://www.nature.com/articles/s41586-024-07566-y) ·
[EDPB Opinion 28/2024 (PDF)](https://www.edpb.europa.eu/system/files/2024-12/edpb_opinion_202428_ai-models_en.pdf) ·
[EDPB weighs in on personal data in AI models (IAPP)](https://iapp.org/news/a/edpb-weighs-in-on-key-questions-on-personal-data-in-ai-models) ·
[Can processors use data to train AI while remaining a processor? (IAPP)](https://iapp.org/news/a/can-processors-use-data-to-train-ai-improve-products-while-remaining-a-processor-) ·
[PIPEDA Findings #2026-002 — joint investigation of OpenAI (OPC)](https://www.priv.gc.ca/en/opc-actions-and-decisions/investigations/investigations-into-businesses/2026/pipeda-2026-002-overview/) ·
[OPC: Consent (PIPEDA Principle 3)](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/p_principle/principles/p_consent/)
