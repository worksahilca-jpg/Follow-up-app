# Scoring and drafting accuracy: fewer false "going cold" calls, sharper intent detection, less-edited drafts

**Date:** 2026-09-13
**Author:** product-narrative-agent (research task, no code changed)
**Scope:** Three linked questions — (1) what causes a lead scorer to falsely call a real
buyer cold or falsely call noise urgent, (2) what would make intent/urgency detection from
inbound messages more accurate, (3) what makes an AI-drafted follow-up need heavy editing
before a human approves it. Findings are grounded two ways: **code-grounded** (a direct
read of `src/lib/scoring.ts`, `src/lib/integrations/openai.ts`, `src/lib/automation.ts`,
`prisma/schema.prisma`, `src/components/ApprovalQueue.tsx`, and
`src/app/api/leads/[id]/send/route.ts` — these are objective facts about what the product
does today, not opinions, so they're marked **high confidence** regardless of the research
question) and **externally researched** (WebSearch this session — capped at **medium**
confidence per this repo's standing convention, `design-brain/decisions/design-decisions.md`
D-006, since every citation is a search-result snippet, not a page fetched and read in
full). Nothing here touches or proposes changing any file under `src/` — this is a findings
document only.

## What this builds on — read first, not duplicated here

- `followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`
  — the lead's-own-wording signal taxonomy (specificity, timeline, financing readiness
  beat length/politeness), the comparison-shopping vs. disinterest distinction, the
  terse-reply false-cold trap, and the "answer first, one question" draft-structure rule.
  This file's Part 2 and Part 3 extend those findings against the actual scoring/drafting
  code rather than restating them — read that file for the underlying lead-behavior
  evidence.
- `followup/research/product/2026-09-10-instant-ack-safety-gate.md` — the risk-gate
  architecture and the "reasoning field before verdict" structured-output principle
  (its §3.4, citing OpenAI's own Structured Outputs guide). Finding 4 below applies the
  same principle to a different function (`scoreLead`) that file didn't examine, and found
  a fresh, independent citation for the mechanism this session (see Finding 4).
- `followup/research/product/2026-09-09-followup-cadence-best-practices.md` — the
  escalating-cadence and dead-lead-reactivation research. Not duplicated; this file is
  about classification/drafting accuracy, not cadence timing.

## Sourcing caveat — carry this wherever these findings go

**WebFetch is blocked network-wide in this sandbox** — confirmed again this session against
`en.wikipedia.org` (`EGRESS_BLOCKED`), consistent with every prior research pass in this
repo. **WebSearch was available and used for every external finding below.** Per this
repo's convention, that caps external findings at **medium confidence** — strong enough to
justify a prompt or product change, not strong enough to quote verbatim in customer-facing
copy without a direct fetch first. Two findings (8's clinical study, citing PMC/Frontiers,
and the Meta/Twilio platform mechanics in Finding 1/7) are flagged individually as somewhat
stronger than a typical vendor-blog snippet, for the reasons stated inline. Findings marked
**[code fact]** are not subject to this cap — they were read directly from the files named
above, not sourced externally.

---

## Part 1 — Scoring accuracy: what causes a false "going cold" or a false "urgent"

### Finding 1 — [code fact, high confidence] Delivery-failure data already exists in the schema but is never used to gate "going cold" detection

`Message.deliveryStatus` (`prisma/schema.prisma` line 395, comment at lines 387–394)
captures Twilio's real delivery callback for every outbound SMS/WhatsApp send —
`queued | sent | delivered | undelivered | failed`. But `findUnansweredLeads` and the
`silent` branch in `src/lib/automation.ts` (lines 130–290) query only on `lastContacted`/
time elapsed — nothing in that file reads `deliveryStatus`. **A lead whose outbound
follow-up texts are all coming back `undelivered` (bad number, carrier-blocked, opted out
of SMS) is treated identically to a lead who received every message and simply didn't
reply.** These are not the same lead: one needs a different contact method or a flag that
the phone number itself is bad; the other is a genuine silence case the existing cadence
research already covers. Today both get the same escalating-cadence treatment, and the
"going cold" read on the undelivered-number lead is not just inaccurate, it's a symptom
FollowUp already has the data to detect and currently discards.

**Actionable:** before enrolling a silent lead into a cadence step or a dead-lead
reactivation campaign, check whether the *previous* automated send to that lead actually
had `deliveryStatus: "delivered"` (or no undelivered/failed sends on record). A lead whose
last N outbound attempts all failed at the carrier level should be flagged for a different
resolution ("this phone number may be wrong" / try email instead) rather than silently
counted toward the same "cold" clock as a lead who's actually seeing the messages.

### Finding 2 — [code fact, high confidence] Gmail hard-bounce notifications are filtered out as noise instead of read as "this lead's contact info is broken"

`src/lib/integrations/gmail.ts` line 53 filters senders matching `/mailer-daemon/i` (and
`postmaster@`) out of the classifier pipeline entirely, alongside no-reply/notification
addresses — reasonable, since a bounce notification is not a sales conversation. But that
also means the *signal* a bounce carries — "the email FollowUp just sent to this lead did
not arrive" — is thrown away rather than captured anywhere, including on the very lead
whose outbound message triggered it. Combined with Finding 1: FollowUp currently has **no
path, on either its two synchronous outbound channels (email or SMS/WhatsApp), for a
delivery failure to change how a lead's silence is interpreted.**

This is a well-documented category of CRM error independent of FollowUp's specific code —
hard bounces (invalid/deleted mailbox, non-existent domain) are described industry-wide as
something that should immediately change how a contact is treated, not be treated as
ordinary unresponsiveness. *(Aggregated via WebSearch 2026-09-13 across
`help.brevo.com`, `massmailer.io`, `fluentcrm.com`, `help.zoho.com` — all vendor/help-center
content describing the same standard practice: mark hard-bounced contacts distinctly and
exclude them from normal follow-up sequencing rather than re-attempting the same channel.
Consistent, unsurprising, practitioner-standard information; medium confidence per the
snippet-sourcing cap, but this is closer to "documented common practice" than to a
contested claim.)*

**Actionable:** route a mailer-daemon bounce for a business's own domain back to the
specific `Lead` it was replying about (matching on the original `Message.externalId`/
thread, which Gmail sync already tracks for idempotency) and record it — even a boolean
`hasBounced` or a `deliveryStatus`-style field on the lead's email channel — rather than
discarding the notification. A lead flagged this way should never silently ride the normal
silence-cadence clock next to leads who are actually receiving the messages.

### Finding 3 — [external, medium confidence] Apple Mail Privacy Protection makes "opened email" a corrupted buying signal for a large and growing share of leads — and it's named as a weighted-up factor in the scoring prompt today

`src/lib/integrations/openai.ts`'s `scoreLead` system prompt (line 156) instructs the model
to "Weigh buying signals (pricing/timeline questions, **opened emails**, requests for a
call)…" — i.e., `Message.opened` (schema line 383) is treated as positive evidence of
engagement. Apple Mail Privacy Protection (enabled by default on iOS/macOS Mail since 2021,
and it applies to *any* email address — Gmail, Yahoo, a business's own domain — the moment
it's read through Apple's own Mail app) pre-fetches the tracking pixel on Apple's own
servers at delivery time, independent of whether a human ever opens the message. *(WebSearch
2026-09-13, aggregated across `gmass.co`, `postmarkapp.com`, `mailchimp.com`,
`twilio.com`, `emailtooltester.com`, `beehiiv.com`, `aurorasendcloud.com`, `gblock.app` —
eight independent vendor/ESP sources describing the same underlying Apple mechanism, which
is itself a documented, undisputed platform behavior, not a contested claim; the specific
magnitude figures below are less certain than the mechanism itself.)* One aggregated figure
worth flagging specifically, at lower confidence since it's a single vendor's number
(`gblock.app`, title "Apple Mail Fakes Half of All Email Opens in 2026"): **Apple MPP opens
are reported as ~49% of all tracked email opens**, and a separate pairing (`emailtooltester.com`/
`beehiiv.com`) claims true human B2B open rates run 15–25% against dashboards reporting
35–55% — i.e., roughly half of what a system logs as "this lead opened the email" may not
reflect a human action at all.

**Why this matters for FollowUp specifically:** `Message.opened` has no way today to
distinguish a real open from an Apple-prefetched false one — the field is a plain boolean
set (presumably) by tracking-pixel hit, same as most ESPs. If so, **every lead reading
FollowUp-tracked business emails through Apple Mail (a large, non-trivial share of any US
consumer-facing business's leads) is contributing a coin-flip-reliable signal to the exact
"buying signal" the scoring prompt is told to weigh up** — which cuts against real intent
detection in both directions: a genuinely disengaged Apple Mail user can register as
"opened" (false positive on interest), and there's no way to tell that open apart from a
real one to catch the false positive.

**Actionable:** this needs a direct verification pass (does `opened` get set from a tracking
pixel, and does FollowUp's tracking domain/method get MPP-prefetched the same way — worth
checking against FollowUp's own send infrastructure specifically, not assumed from generic
ESP behavior) before deciding how much to discount it. If confirmed, the practical fix
options documented industry-wide are the same ones ESPs converged on: de-weight `opened` as
a scoring signal generally (treat *clicks*, not opens, as the reliable proxy, since Apple's
prefetch does not follow links) and/or detect the specific signature of a prefetched open
(Apple's proxy IPs, near-instant open time after send, opens with no corresponding later
activity) to flag suspect opens rather than trusting the boolean uniformly.

### Finding 4 — [external mechanism, medium; code fact on current state, high] `scoreLead`'s JSON schema asks for the score before the reasoning — the literature says this ordering measurably lowers accuracy

`SCORE_JSON_SCHEMA` (`openai.ts` lines 106–137) declares its fields in this order:
`score`, then `reason`, then `factors`. Structured-output APIs (including OpenAI's) fill a
JSON schema's fields in declaration order, and because the underlying model is
autoregressive (each token can only condition on tokens already generated), **a field
declared before another becomes usable "scratchpad" the later field can build on; a field
declared after has zero causal effect on what came before it.** Put plainly: today's schema
asks the model to commit to a 0–100 score *before* it has articulated why, which structurally
forces a verdict-first, rationalize-after generation order — the `reason` and `factors` the
model then writes are justifying a number it already output, not informing it. *(WebSearch
2026-09-13: `dev.to/ji_ai`'s "Why JSON Schema Field Order Breaks Structured Output Accuracy"
and Dylan Castillo's "Structured outputs: don't put the cart before the horse"
(`dylancastillo.co`) both describe this exact mechanism and both report a measured accuracy
gain from reordering fields — the `dev.to` piece cites "+8 percentage points on aggregation
accuracy" from doing exactly this reorder on one pipeline. Both are independent practitioner
write-ups, not peer-reviewed papers, so treat the specific percentage as anecdotal-but-
plausible rather than settled; the underlying mechanism (autoregressive left-to-right
generation, chain-of-thought must precede the answer to influence it) is well-established
and independently corroborated by OpenAI's own Structured Outputs guide, already cited in
this repo's `research/product/2026-09-10-instant-ack-safety-gate.md` §3.4 for the same
reason in a different function.)*

**Actionable, concrete and cheap:** reorder `SCORE_JSON_SCHEMA`'s properties to
`factors` (or a dedicated reasoning field) → `reason` → `score`, so the model has to lay out
the evidence and the plain-language reason before it's asked to commit to a number — the
same fix the instant-ack research already proposed for a sibling function
(`assessAckRisk`) but did not apply here, since that document didn't examine `scoreLead`.
This is a prompt/schema-only change with no architecture impact, and it directly targets
one plausible mechanism behind an inconsistent-feeling score: the model isn't reasoning its
way to the number, it's inventing a justification for one it already picked.

### Finding 5 — [external, medium confidence] The prompt states "long silence after a strong signal is still warm" as one abstract sentence, with no worked example — few-shot examples are a documented lever for exactly this shape of rare, asymmetric misclassification

The scoring prompt's only defense against the false-cold trap is one clause: "a long
silence after a strong signal is often still warm, not cold" (line 157) — a correct
instruction, but delivered as an abstract rule with zero concrete example for the model to
pattern-match against. Few-shot prompting (including few worked examples of exactly the
edge case a rule targets) is a well-documented lever for improving small-model accuracy on
tasks with a rare-but-costly failure mode, though the research also flags a real trade-off:
too few examples (fewer than ~4) can *increase* miscalibration before more examples (~8+)
or a larger model fixes it. *(WebSearch 2026-09-13, aggregated across `tetrate.io`,
`prompthub.us`, `learnprompting.org`, and one arXiv abstract on few-shot calibration,
`arxiv.org/pdf/2212.02216` — the calibration trade-off specifically traces to that paper's
abstract via snippet, not the full text, so treat the exact shot-count thresholds as
directional, not precise.)*

**Actionable:** add 2–4 short worked examples directly in the `scoreLead` user or system
message — specifically the two edge cases this repo's own research has already identified
as high-value and currently under-supported: (a) a lead silent for weeks after asking a
specific, high-intent question (should stay warm/medium, not decay to cold), and (b) a
terse one-word reply from an already-engaged lead ("k", "maybe") that should not itself
lower the score absent an explicit negative statement — per
`2026-09-13-what-leads-actually-say-first-contact-patterns.md` Finding 4. Given the
calibration trade-off above, 2–4 examples covering exactly these two named failure modes is
likely the right size — not a large generic example bank, which the same research suggests
could just as easily hurt calibration as help it.

---

## Part 2 — Intent/urgency detection from inbound messages

### Finding 6 — [code fact, high confidence] `scoreLead` has no equivalent of `classifyAsProspect`'s concrete signal checklist — it runs on one generic sentence

`classifyAsProspect` (openai.ts lines 247–330-ish) is written with a detailed, concrete
checklist of what counts and doesn't (existing client vs. intermediary vs. vendor vs.
recruiter, with named examples for each) — the comment at lines 258–264 explicitly says
this was rewritten after **real production failures** ("threw away 7 of his real deals")
once the classifier was given a concrete rubric instead of a vague instruction.
`scoreLead`, by contrast, still runs on one generic sentence: "Weigh buying signals
(pricing/timeline questions, opened emails, requests for a call), deal value, and days
since last contact" (line 156) — no equivalent concrete checklist for what actually signals
buyer intent in the message content itself. This is a direct, internal precedent inside
FollowUp's own codebase that giving a scoring/classification prompt a concrete rubric,
instead of an abstract instruction, measurably fixed real misses — and `scoreLead` hasn't
had the same treatment yet.

**Actionable:** `2026-09-13-what-leads-actually-say-first-contact-patterns.md` Findings 1–2
already assembled the concrete signal list this prompt is missing — a named specific
address/unit/service, a stated or implied timeline, financing/budget-readiness language,
and offering a specific time slot — explicitly *not* message length or politeness. Porting
that checklist into `scoreLead`'s system prompt (the same move `classifyAsProspect` already
made, successfully, for a different judgment) is a low-effort, high-precedent change with
FollowUp's own shipped code as the existence proof that it works.

### Finding 7 — [external, medium confidence] WhatsApp/Messenger "read" receipts are a real, mostly-unused signal that survives the Apple-MPP problem — because they measure the lead's read state, not email's

Distinct from Finding 1 (which is about a *failed delivery*), this is about the case where a
message *is* delivered and the question is whether the lead has actually seen it. Meta's
WhatsApp Business Cloud API delivers a three-stage webhook status per outbound message —
`sent` → `delivered` → `read` — the `read` state fires specifically when the recipient's
device confirms the message was opened (subject to the recipient not having disabled read
receipts, in which case it's a floor, not an exact measurement). *(WebSearch 2026-09-13,
`blueticks.co`'s "How to Track WhatsApp Message Delivery Status with Webhooks" — a
vendor blog, Grade C by this repo's own established grading convention from
`research/product/2026-09-10-instant-ack-safety-gate.md`, but describing a mechanic
(`messages.statuses[]` webhook events) that is a real, documented feature of Meta's own
Cloud API, not a vendor claim about their own product.)* `prisma/schema.prisma`'s
`Message.deliveryStatus` comment (lines 387–394) explicitly lists only
`queued/sent/delivered/undelivered/failed` for Twilio's callback — **`read` is not named as
a captured value**, meaning this specific, available, per-message signal for WhatsApp sends
is not currently distinguished from a plain "delivered."

**Actionable:** for WhatsApp specifically (and confirm whether Twilio's own WhatsApp
integration surfaces Meta's `read` status through its own callback — this needs a direct
check against Twilio's API docs before building, not assumed), capturing `read` as a
distinct `deliveryStatus` value would let FollowUp distinguish two very different "silent"
leads: one whose last outbound message was delivered but never opened (could be a device/
notification issue, or the lead genuinely hasn't looked yet — a different, gentler read than
disengagement) versus one who opened the message and still hasn't replied (a stronger signal
that the lead saw the ask and chose not to respond yet — closer to the comparison-shopping
read from the 2026-09-13 file's Finding 3 than to true silence). This is exactly the kind of
signal the false-cold research calls for and, unlike email opens (Finding 3), isn't
corrupted by a platform-side prefetch problem.

---

## Part 3 — AI-drafted follow-ups: what would need less editing before approval

### Finding 8 — [external; one source higher-confidence, see below] An edit-rate threshold exists in comparable AI-drafting contexts, and draft-quality effects on editing effort are reported as a threshold, not a gradient

Two separate pieces of evidence converge on the same shape:

- Vendor/practitioner guidance on AI-drafted sales emails states that **if more than ~30%
  of drafts get edited before approval, that's the trigger to revise the prompt** — framed
  as an operational diagnostic metric, not a target to hit exactly. Also reports
  human-reviewed AI drafts outperforming fully-automated sends by 15–30% in reply rate, and
  a ~45–90 second human review pass vs. 8–12 minutes writing from scratch. *(WebSearch
  2026-09-13, aggregated across `lowcode.agency`, `pipeline.zoominfo.com`,
  `firstsales.io`, `syncgtm.com` — vendor/practitioner content, medium confidence; the exact
  30% figure and the specific percentage ranges are not independently cross-verified beyond
  this aggregated snippet set, so treat the number as a reasonable diagnostic starting point,
  not a precisely-derived target.)*
- **Higher confidence, different domain:** a peer-reviewed observational study (Frontiers in
  Digital Health, 2025, via PMC — `pmc.ncbi.nlm.nih.gov/articles/PMC12198195`) on AI-drafted
  replies to patient portal messages in a real hospital deployment (919 messages, 100
  physicians) found clinicians used the AI draft in 58% of replies, and — critically — among
  the subset who used more than 10% of a given draft, the overlap with their own final
  message (ROUGE-1) was 0.86, i.e. **when a draft cleared a low usability bar, the physician
  kept the great majority of it; drafts that didn't clear that bar were apparently
  discarded/rewritten rather than lightly trimmed.** This is a different domain (clinical
  messaging, not sales), so treat it as a directional analogy, not a sales-specific number
  — but the shape (draft adoption behaves as roughly bimodal — "good enough to keep mostly
  as-is" vs. "not worth editing, write fresh" — rather than a smooth quality gradient) is a
  genuinely useful framing for what "less editing" should optimize for: **not shaving a few
  words off every draft, but moving more drafts across the "worth keeping" line at all.**

**Actionable, tying the two together:** treat "fraction of AI drafts sent completely
unedited" as the metric to track (see Finding 9 — FollowUp cannot currently measure this at
all), expect it to behave more like a threshold effect than a smooth curve per the clinical
study, and use ~30% edited (i.e., ~70%+ sent verbatim) as a starting diagnostic line for
"the prompt needs work" per the sales-specific vendor guidance, revisited once real
FollowUp data exists rather than treated as a validated target from day one.

### Finding 9 — [code fact, high confidence] FollowUp cannot currently measure how often an AI draft is edited before sending — this is buildable today with data already on hand

`POST /api/leads/[id]/send` (`src/app/api/leads/[id]/send/route.ts` lines 35–41) accepts
whatever `message`/`subject` text the client submits and records an audit event
(`recordAudit(ctx, "lead.send", { targetType: "lead", targetId: id, meta: { length:
message.length } })`) — **the audit meta captures only the sent message's character
length, never whether it matches `lead.suggestedMessage`/`suggestedSubject`**, which are
already stored on the `Lead` row (`scoring.ts` line 95, "the AI's own draft") before the
human ever sees the composer. `ApprovalQueue.tsx`'s "Approve and send" path (lines 42–58)
happens to always send `item.draftMessage` verbatim, so an edit can only happen via the
full lead-page composer today — but neither path logs the comparison. This means Finding
8's actionable metric — the AI-SDR literature's own "track your edit rate" recommendation —
**is not something FollowUp can report on today, for any business, at all.**

**Actionable, cheap and specific:** at the point `POST /api/leads/[id]/send` receives
`message`/`subject`, compare against the lead's stored `suggestedMessage`/`suggestedSubject`
(exact match, or a cheap normalized/whitespace-insensitive match) and record a boolean —
`meta: { length, editedFromDraft: boolean }` — in the existing audit event. This requires no
new table, no new UI, and turns an currently-invisible product-quality question ("are our
drafts good enough that people mostly just hit send?") into a queryable number per business
and, in aggregate, per prompt version — the same kind of weekly query the instant-ack
research already proposed for a different signal
(`research/product/2026-09-10-instant-ack-safety-gate.md` §4.6).

### Finding 10 — [code fact, high confidence; extends 2026-09-13 file Finding 5] `generateFollowUpMessage`'s prompt has no structural rule against stacking multiple questions or failing to answer the lead's literal question first

The current draft prompt (`openai.ts` lines 459–495) constrains tone, language-matching,
factual honesty, and length ("2-4 complete sentences") in real depth — but contains **no
instruction about question count or about answering the lead's specific question before
anything else.** The prior research pass already established, from independent
practitioner sources, that a good automated first response "answers the literal question
first, then asks exactly one qualifying question — never several stacked together," and
that multiple stacked questions are reported to reduce reply rates
(`2026-09-13-what-leads-actually-say-first-contact-patterns.md` Finding 5, sourced from
`messageiq.io`/`marqeable.com`/`plugdialog.com`, WebSearch, medium confidence). That finding
was written as a content brief; this file adds the specific, current gap in the prompt text
it should land in — nothing in `generateFollowUpMessage`'s system prompt today would stop
the model from asking two or three questions in one draft, or from opening with rapport
language instead of the answer to what was actually asked.

**Actionable:** add an explicit structural constraint to the system prompt — answer or
acknowledge the lead's specific question first, ask at most one question of your own — as a
testable, checkable rule (the existing test suite already pins other sentence-level prompt
constraints per `prompts.test.ts`, per the instant-ack research; the same pinning technique
applies directly here).

### Finding 11 — [internal reasoning, not externally sourced] A visible "generic draft" signal, distinct from the lead score, would let a human's editing effort go where it's actually needed

This is inference, not a sourced finding: Finding 8's bimodal-adoption pattern (a draft
either clears a usability bar and gets used mostly as-is, or doesn't and gets rewritten)
suggests the current approval experience — every draft presented with the same visual
weight regardless of how specific or generic it actually is — asks a human to spend the same
reading effort on a strong, specific draft as on a weak, generic one, when the actual
editing burden is concentrated in the weak minority. A cheap, deterministic proxy already
exists inside the data FollowUp has: whether the draft references anything specific from the
lead's own message (a named detail, a number, a date) versus reading as boilerplate that
could apply to any lead. This is a **product/content observation, not a UI spec** — it
doesn't prescribe a visual treatment (that's `frontend-3d-agent`/design-brain territory, and
brand principle 6, "show the reasoning, not just the verdict," already argues for something
in this direction) — but it's worth flagging because it follows directly from Finding 8's
evidence and nothing here required inventing a new external claim to support it.

---

## Summary: the most actionable findings, restated plainly

1. **Delivery failures (bad phone number, hard-bounced email) are already captured in the
   database via `deliveryStatus` but are never checked before a lead is treated as "going
   cold"** — a technical failure to reach the lead and a lead's genuine silence currently
   look identical to the automation system. (Findings 1, 2 — code-grounded, high confidence)
2. **"Opened email" is named as a positive scoring signal, but Apple Mail Privacy
   Protection makes a large share of tracked opens fake** (pre-fetched by Apple's own
   servers, not a human action) — this is a real, documented platform behavior worth a
   direct verification pass against FollowUp's own tracking setup. (Finding 3 — external,
   medium confidence, but the underlying mechanism is undisputed)
3. **`scoreLead`'s JSON schema asks for the numeric score before the reasoning that's
   supposed to justify it** — the literature on structured-output field order says this
   ordering forces a verdict-first, rationalize-after generation pattern and that reordering
   is a measurable, nearly-free accuracy fix; FollowUp's own prior research already applied
   this exact fix to a sibling function and this one was missed. (Finding 4)
4. **`scoreLead` runs on one generic sentence of guidance, while `classifyAsProspect` — a
   sibling function in the same file — was rewritten with a concrete checklist after real
   production misses, and that rewrite is documented as having fixed them.** Porting the
   lead-message signal checklist this repo's own prior research already assembled (named
   specifics, timelines, financing language, offered time slots) into `scoreLead` is a
   low-risk, high-precedent change. (Findings 5, 6)
5. **FollowUp cannot currently measure how often a human edits an AI draft before sending
   it** — the one metric every comparable AI-drafting context (sales-email vendors, a
   peer-reviewed clinical-messaging study) treats as the core quality signal is invisible
   today, despite the data needed to compute it (`lead.suggestedMessage` vs. the sent
   message) already existing on the row. (Finding 9 — code-grounded, cheap to fix)
6. **The draft-generation prompt has no rule against asking multiple stacked questions or
   failing to answer the lead's literal question first** — a concrete, previously-identified
   content gap (2026-09-13 file, Finding 5) that maps onto a specific, unaddressed spot in
   the current prompt text. (Finding 10)

## What this does not answer

- No finding here comes from FollowUp's own production data — no real lead was scored or
  re-scored as part of this research, and the edit-rate/false-cold problems are diagnosed
  from code review plus category-level external research, not from a query against
  FollowUp's own database. Finding 9's whole point is that this data isn't queryable yet.
- Whether `Message.opened` is actually vulnerable to Apple MPP the way Finding 3 assumes
  (i.e., whether FollowUp's own tracking-pixel implementation, if any, behaves like a
  typical ESP's) was **not verified against FollowUp's own sending code this session** —
  flagged explicitly as needing a direct check before acting on Finding 3.
- Whether Twilio's own WhatsApp integration actually surfaces Meta's `read` webhook status
  through Twilio's callback API (as opposed to only `sent/delivered/failed`) was **not
  verified against Twilio's own API documentation this session** — flagged in Finding 7 as
  needing a direct check before building anything on it.
- This pass did not examine `assessSendRisk`'s or `generateFollowUpMessage`'s few-shot
  examples (there are none in either), only `scoreLead`'s single abstract sentence — a
  parallel gap may exist in the other prompts and wasn't separately assessed here.
- No claim in this file should be treated as validated enough to quote in customer-facing
  copy, per the standing sourcing convention — every external finding is WebSearch-snippet
  sourced, and the one higher-confidence source (the PMC/Frontiers clinical study) is from a
  different domain (healthcare messaging, not sales lead follow-up).

## Sources checked (WebSearch, 2026-09-13; WebFetch confirmed blocked, see caveat above)

Scoring / false-cold / delivery signals:
- https://www.gmass.co/blog/apple-mail-privacy-protection/
- https://postmarkapp.com/blog/how-apples-mail-privacy-changes-affect-email-open-tracking
- https://mailchimp.com/help/apple-privacy-faq/
- https://www.twilio.com/en-us/resource-center/apple-mail-privacy-protection-email-senders-adapt
- https://www.emailtooltester.com/en/blog/apple-mpp-open-rate/
- https://www.beehiiv.com/blog/apple-mpp-open-rate
- https://www.aurorasendcloud.com/blog/apple-mail-privacy-protection
- https://www.gblock.app/articles/apple-mail-privacy-protection-fake-email-opens-2026
- https://help.brevo.com/hc/en-us/articles/209435165-What-are-soft-bounces-and-hard-bounces-in-email
- https://massmailer.io/blog/salesforce-email-bounce-management-guide/
- https://fluentcrm.com/blog/hard-bounce-vs-soft-bounce/
- https://help.zoho.com/portal/en/kb/crm/connect-with-customers/email/email-capabilities/articles/email-bounce-management
- https://blueticks.co/blog/whatsapp-api-delivery-status-webhooks
- https://www.leadangel.com/blog/operations/lead-response-time/
- https://www.leandata.com/blog/lead-response-time/
- https://credofy.com/slow-lead-response-time-costing-78-percent-of-sales/

Structured-output / classification accuracy:
- https://dev.to/ji_ai/why-json-schema-field-order-breaks-structured-output-accuracy-2985
- https://dev.to/ji_ai/json-mode-makes-your-llm-dumber-the-constrained-decoding-trap-cp
- https://dylancastillo.co/posts/llm-pydantic-order-matters.html
- https://arxiv.org/pdf/2502.18878
- https://arxiv.org/pdf/2606.09410
- https://tetrate.io/learn/ai/few-shot-learning-llms
- https://www.prompthub.us/blog/the-few-shot-prompting-guide
- https://learnprompting.org/docs/basics/few_shot
- https://arxiv.org/pdf/2212.02216

AI-draft editing burden:
- https://www.lowcode.agency/blog/ai-personalized-sales-email-automation
- https://pipeline.zoominfo.com/sales/ai-sales-email-generators
- https://firstsales.io/blog/ai-vs-human-cold-email-reply-rates/
- https://syncgtm.com/blog/ai-sales-emails
- https://instantly.ai/blog/ai-sdr-limitations-honest-assessment/
- https://instantly.ai/blog/ai-sdr-reduce-ramp-time/
- https://skaled.com/insights/ai-for-sdrs/
- https://www.amplemarket.com/blog/best-ai-sales-agents
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12198195/ (Frontiers in Digital Health, 2025 — AI-generated draft replies to patient messages)
- https://arxiv.org/pdf/2605.05348

Codebase files read to ground this research (not web sources): `src/lib/scoring.ts`,
`src/lib/integrations/openai.ts`, `src/lib/automation.ts`, `prisma/schema.prisma`
(`Message`, `Lead` models), `src/components/ApprovalQueue.tsx`,
`src/app/api/leads/[id]/send/route.ts`, `src/lib/integrations/gmail.ts`.
