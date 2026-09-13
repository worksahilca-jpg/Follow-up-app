# Research log

Every design research pass, dated, with its question and its conclusion.

**The log's job is to prevent two failures:** researching the same question twice, and
citing a "finding" nobody can trace back to a source.

## Format

```
## YYYY-MM-DD — [Question being answered]
**Triggered by:** [the design task or decision that needed this]
**Question:** [one specific, answerable question]
**Method:** [what was actually done — sources consulted, products examined, docs read]
**Findings:** [what was learned, with sources]
**Confidence:** [high | medium | low — and what would raise it]
**Conclusion / what changes because of this:** [the design implication, or "nothing"]
**Written up in:** [path to the detailed file, if any]
```

**"Nothing changes because of this" is a valid and honest conclusion.** Research that
confirms the current approach is useful and should be logged as such — it stops the
question being reopened.

## Rules

1. **Research answers a question.** If you can't write the question in one sentence,
   you're browsing, not researching. (`workflows/research-workflow.md`)
2. **Cite sources.** A finding with no source is an opinion with a footnote.
3. **State confidence honestly.** "Three products do X" is weak evidence. "Three products
   do X and a usability study found Y" is stronger. Say which you have.
4. **Distinguish observed from inferred.** "Linear's list has one action per row" is
   observed. "Because they found more actions confused users" is a guess — mark it.
5. **Never invent research.** No fabricated statistics, no imagined user quotes, no
   citations to studies you haven't read. A design brain that contains one fabricated
   finding cannot be trusted on any finding.
6. **Reuse the repo's existing research first.** `followup/research/` already holds real,
   dated findings on customers, competitors, and integrations — including
   `customers/2026-09-05-icp-pain-and-trust-objections.md`, which is directly relevant to
   onboarding and empty-state design. Read before researching.

---

## Log

## 2026-09-12 — What does the existing repo research imply for design?

**Triggered by:** Founder asked for the first research pass. `followup/research/` held 19
dated files (~3,800 lines) of real customer, market, and competitor findings that had never
been read through a design lens.
**Question:** What in FollowUp's existing research changes how the product should be
designed?
**Method:** Read `customers/2026-09-05-icp-pain-and-trust-objections.md` in full; scanned
the 12 `market/` files for design-relevant findings. **No new external research** — this is
a re-reading of work already in the repo.
**Findings:** Six, written up in
`ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`:

1. **Approval-first is validated** (77% of consumers want human approval before an agent
   acts; 1 in 10 accept full independence). The five-part trust checklist in that study is
   usable directly as a design checklist.
2. **The fear is "my business will feel fake", not "the AI will be wrong"** — 65.5% of
   owners worry AI makes them seem less authentic; 79% of customers prefer a human. This is
   the sharpest finding: it turns brand principle 3 from a taste position into an
   evidence-backed one.
3. **Speed is the product, and the user is on a phone** — 62% missed-call rate in home
   services, 86% of voicemail callers hang up, 391% conversion lift from a 1-minute
   callback. Settles mobile-first for the core loop.
4. **Push, not pull** — the dashboard opens on "about to be lost", each lead carrying a
   rescue score *with its reason*. Resolves the table-vs-list question in favor of a
   prioritized list.
5. **Complexity is the category's failure mode** — competitors are repeatedly marked down
   for setup burden and learning curve by exactly this ICP.
6. **SMS consent is a design surface** — TCPA liability sits with the business, so consent
   state belongs where sending happens, not only in settings.

**Confidence:** **Medium, and capped there deliberately.** The underlying customer research
states that WebFetch was blocked in its sandbox, so every figure is a search-snippet
citation rather than a fetched source; its author flagged some quotes as possibly
vendor-influenced and several percentages as third-party aggregations. Strong enough to
steer design; **not strong enough to put on a screen.** No number from this pass may appear
in product copy or marketing without a direct fetch first. Raising confidence needs primary
sources, and ideally a FollowUp user — nothing here comes from one.

**Conclusion / what changes:** Four things in the design brain now have evidence behind
them rather than conviction (principles 3, 4, 6, 7); two open questions are resolved
(mobile-first for the core loop; prioritized list over table); and the **approve-a-draft
screen is now the highest-priority screen to design**, ahead of the dashboard — it is where
the trust this research describes is either earned or lost.

**Written up in:** `ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`

---

## 2026-09-13 — What do inbound leads actually say, and what does that mean for scoring/drafting?

**Triggered by:** product-narrative-agent's customer/copy research charter — how real leads
(real estate first, small-service-business second) phrase first contact across channels,
and what that implies for the AI classifier and `suggestedMessage` drafting quality.
**Question:** What do inbound leads actually type/say in their first message and replies,
what intent signals show up in their wording, and what causes a genuinely-still-engaged lead
to get mislabeled cold?
**Method:** Checked existing repo research first (2026-09-05 ICP/trust file, the 2026-09-12
UX-patterns file above, `PRODUCT_DIRECTION.md`) — none of it covered lead *message content*
specifically. New WebSearch research conducted; WebFetch confirmed blocked network-wide
again this session (six direct-fetch attempts, all `EGRESS_BLOCKED`), so every citation is a
search-snippet, not a fetched page.
**Findings:** Six, written up in full in
`followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`:
1. The three most common inbound DM/text questions are almost entirely factual — "is it
   still available?", "when can I see it?", "what's the price?" — message length/politeness
   is a weak intent signal on its own.
2. Real intent signals are specificity + readiness-to-act (a named address/unit/service, a
   stated timeline, financing/budget language, offering a specific time slot) — not
   enthusiasm or tone.
3. A lead going silent is more often comparison-shopping than actually disinterested;
   one source puts "lost" leads at ~70% lost purely because follow-up stopped, not because
   interest did (single-sourced, not cross-checked — treat cautiously).
4. Terse/short replies from an already-engaged lead are a documented false-cold trap,
   distinct from silence — only an explicit negative statement should score a lead down.
5. A good automated first response answers the literal question first, then asks exactly
   one qualifying question — never several stacked together. A concrete, checkable
   structural bar for draft quality.
6. Instagram DM is reportedly the top lead-generation channel for realtors — NAR's 2025
   REALTORS® Technology Survey (primary-sourced, higher confidence than the rest of this
   pass) puts social media at 39% vs. CRM 23% and MLS 17% — and the least automated at the
   contact-creation step. A real Meta 24-hour DM messaging-window constraint was also
   surfaced and flagged for independent verification against Meta's own docs.
**Confidence:** Medium overall (search-snippet sourced per this repo's standing convention,
see `decisions/design-decisions.md` D-006), except Finding 6's NAR percentages, which trace
to NAR's own survey PDF and press release and are treated as higher confidence.
**Conclusion / what changes:** Gives whoever next tunes the scoring prompt or
`suggestedMessage` drafting a concrete, sourced signal list to work from (Findings 1, 2, 4,
5) instead of intuition; reinforces the existing "false cold" design concern from the
2026-09-12 pass with a distinct second mechanism (comparison-shopping, Finding 3, vs. terse
replies, Finding 4); and adds a validated, primary-sourced case that Instagram DM is a
high-value channel worth real design/product attention, not a secondary one (Finding 6).
**Written up in:**
`followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`

---

## 2026-09-13 — What makes this ICP open FollowUp, trust it at a glance, and keep opening it?

**Triggered by:** product-narrative-agent's UX/product-narrative charter — first-time ease
(onboarding, first five minutes) and ongoing habit (why open it today, what causes a week-2
abandonment) for a solo agent/small-team owner who is phone-first, busy, and often between jobs.
**Question:** What does real evidence say about what makes small-business/solo-operator SaaS
tools easy to start vs. abandoned after a couple of weeks, and what does that mean specifically
for FollowUp?
**Method:** Read `design-brain/brand/brand-principles.md` and `decisions/rejected.md` first (both
directly constrain which "engagement" tactics are even admissible before any research starts).
Read `followup/research/product/2026-09-10-ux-simplification.md` in full to avoid duplicating its
onboarding/IA work — that file already covers first-five-minutes onboarding in depth; this pass
extends into the ongoing-habit question it left largely unanswered. New WebSearch research
conducted (14 queries); WebFetch confirmed blocked again this session (`pmc.ncbi.nlm.nih.gov`
returned `EGRESS_BLOCKED`), so every citation is a search-result synopsis, graded A-D using the
scale the sister file in the same folder already established.
**Findings:** Full detail in
`followup/research/product/2026-09-13-usability-and-engagement.md`. Headlines:
1. Missing a real first-value moment in the first week is repeatedly (if inconsistently, on the
   exact numbers) linked to much higher later churn — reinforces, doesn't newly justify, the
   sister file's proof-screen onboarding fix as the top-priority open item.
2. Nir Eyal's Hook Model is useful as an audit lens (trigger/action/reward/investment) but two of
   its four stages — variable reward and investment — are conventionally implemented in ways
   brand principles 2, 3, and 7 already rule out; the file maps an honest, non-manufactured
   equivalent of each stage instead.
3. Five evidence-graded abandonment modes are named for "why someone quits after week 2":
   never seeing real value, the tool becoming an unremembered inbox, alerts training the owner to
   stop looking (badge-avoidance research plus a security-alert-fatigue analogy), a single
   unsupervised AI mistake breaking a specific, already-primed authenticity fear, and the product
   never visibly getting easier/more autonomous over time.
4. Gamification mechanics (streaks, points, badges-as-reward) are explicitly ruled out with
   external evidence that they backfire specifically in professional B2B contexts — recorded so a
   future session doesn't have to re-run this research to rule them back out.
5. A genuinely new opportunity, tied to `PRODUCT_DIRECTION.md` Rule 5 (rising autonomy): surface
   a business's own demonstrated AI-accuracy track record as the honest reason to invite more
   autonomy, rather than leaving the review burden flat over time.
6. One open, unverified question flagged rather than assumed: whether the "needs your OK" signal
   reaches this phone-first ICP on a channel they actually check mid-workday (current signals
   appear to be a weekly email digest and in-app notifications; not exhaustively audited in this
   research-only pass).
**Confidence:** Medium at best, and several individual findings capped at Grade D (direction only,
no citable number) — consistent with every prior pass in this repo hitting the same
WebFetch-blocked limitation. Two findings are stronger than most of this repo's UX research to
date: the badge/notification-avoidance finding cites a real paper abstract (ResearchGate) rather
than only marketing content, and the trust-calibration finding cites real academic venues (PMC,
Frontiers in Robotics and AI, arXiv) — though none were fetched, so treat as "real field of study
exists and points this way," not as verified statistics.
**Conclusion / what changes:** Adds five concrete, prioritized recommendations (problem +
principle, not mockups) to the design brain's live research for the next session that touches
onboarding, notifications, or the approval queue — most notably, an explicit design-principle
justification for why gamification tactics are inadmissible here (extending, not just restating,
existing brand principles), and a new, moat-relevant idea (a visible AI-accuracy track record
driving autonomy invitations) that no prior pass had surfaced.
**Written up in:** `followup/research/product/2026-09-13-usability-and-engagement.md`

---

## 2026-09-13 — What makes a landing page effective, and how does FollowUp's current one compare?

**Triggered by:** Founder's direct request for a dedicated landing-page research report (not a
design task — research and writing only, no code touched, nothing redesigned, no tokens
proposed).
**Question:** What are the real mechanics of an effective/"catchy" landing page, what belongs on
one and why, what makes visitors understand a product fast and keep reading, what is FollowUp
actually about for a first-time visitor (grounded in `PRODUCT_DIRECTION.md`), how does premium-SaaS
visual restraint (Stripe/Linear as principles, never screens) apply to FollowUp's already-approved
navy/blue Award Direction system, and where does FollowUp's current page (`src/app/page.tsx`)
fall short against all of the above?
**Method:** Read `brand-principles.md`, `decisions/approved.md` (A-002, the navy/blue Award
Direction unification), `decisions/rejected.md` (all sixteen standing rejections), D-008–D-011 in
`design-decisions.md`, the (empty) `references/landing-pages/` folder, `PRODUCT_DIRECTION.md` in
full, and the live `page.tsx` + `landing-award.module.css` in full — not from memory. New WebSearch
research conducted (Nielsen Norman Group's own eye-tracking/scrolling-attention/F-pattern studies,
a peer-reviewed 50ms-first-impression study, SaaS-landing-page-convention aggregators, and
Stripe/Linear design-restraint characterizations). **WebFetch confirmed blocked again this
session** (tested directly against `nngroup.com` and `stripe.com`, both `EGRESS_BLOCKED`) — every
citation is a WebSearch snippet, not a fetched page.
**Findings:** Full six-question report written up in
`followup/research/product/2026-09-13-landing-page-research.md`. Headlines: (1) effectiveness is a
50ms visual-complexity judgment, then an F-pattern scan concentrated in the top ~75% of attention —
not a vague "hook"; (2) FollowUp's page already has every canonical section except proof/social
proof, which is a deliberate, honest omission (no fabricated testimonials) rather than an oversight;
(3) clarity/jargon-avoidance and self-selecting personas are the concrete "get it fast" levers, and
FollowUp's page mostly follows them; (4) a tight, accurate first-time-visitor summary of FollowUp
was written directly from `PRODUCT_DIRECTION.md`'s own canonical wording; (5) FollowUp's shipped
`--accent` usage and three-role typography already match the Stripe/Linear *restraint principle*
verified directly in code, not just aspired to — though this also surfaced that brand principle 8
("one typeface," written 2026-09-12) is now stale against the three-typeface Award Direction system
approved one day later (A-002); (6) a nine-item gap list, headlined by two real findings: the live
AI voice agent (a shipped, hard-to-copy capability) is entirely absent from the page's copy, and the
core "lead conversion, not lead generation" thesis doesn't reach a visitor until the third section.
**Confidence:** Medium overall (WebSearch-snippet sourced, per this repo's standing convention),
except the Lindgaard et al. 2006 50ms study (peer-reviewed, named, higher confidence) and the direct
code-verification claims in Section 5/6 (verified against the actual repo, not sourced externally
at all — highest confidence in the report).
**Conclusion / what changes:** Nothing was changed in this pass (research-only, as scoped) — the
report hands a future copy/design pass two significant, concrete leads (the missing voice-agent
narrative; the buried core thesis) plus seven smaller, named items, and flags one stale brand-doc
line (principle 8) and one possible routing-copy overclaim (the FAQ's "route to the right person"
line) for a founder/copy review rather than resolving them unilaterally.
**Written up in:** `followup/research/product/2026-09-13-landing-page-research.md`

---

**Known, already-available inputs that have not yet been mined for design implications:**
- `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md` — ICP pain
  and, importantly, **trust objections**, which are a design problem as much as a copy one
- `followup/research/market/2026-09-05-competitor-feature-gaps.md`
- `followup/research/market/2026-09-07-lead-rescue-gap-and-strategy.md`
- `followup/research/market/2026-09-06-realtor-tool-landscape.md` — names real competitors
  (Structurely, Ylopo) worth examining as UX references
- `followup/PRODUCT_DIRECTION.md` — the canonical product statement

A first useful research pass would be reading these through a design lens and extracting
the UX implications. That has not been done; don't cite it as though it has.

---

## 2026-09-13 — How can FollowUp make scoring and drafting more accurate (fewer false-colds, sharper intent detection, less-edited drafts)?

**Triggered by:** product-narrative-agent's research charter — concrete, actionable ways to
reduce false "going cold" calls, improve intent/urgency detection from inbound messages, and
reduce how much an AI-drafted follow-up needs editing before human approval.
**Question:** What in FollowUp's current scoring/drafting code, plus external research,
points to specific, buildable accuracy improvements — not general AI-quality platitudes?
**Method:** Read `src/lib/scoring.ts`, `src/lib/integrations/openai.ts` (`scoreLead`,
`classifyAsProspect`, `assessSendRisk`, `generateFollowUpMessage`), `src/lib/automation.ts`,
`prisma/schema.prisma` (`Message`/`Lead`), `src/components/ApprovalQueue.tsx`, and
`src/app/api/leads/[id]/send/route.ts` directly (code facts, high confidence, not subject to
the sourcing cap below). New WebSearch research conducted for everything external; WebFetch
confirmed blocked network-wide again this session (`en.wikipedia.org`, `EGRESS_BLOCKED`), so
every external citation is a search-snippet, not a fetched page.
**Findings:** Eleven, written up in full in
`followup/research/product/2026-09-13-scoring-and-drafting-accuracy.md`:
1. `Message.deliveryStatus` (Twilio delivery callback) is captured in the schema but never
   checked before treating a silent lead as "going cold" — a bad phone number and a real
   silent lead look identical to the automation today. (Code fact, high confidence.)
2. Gmail hard-bounce notifications (`mailer-daemon@`) are filtered out as classifier noise
   with no path back to the lead whose message bounced — the signal "this contact info is
   broken" is discarded rather than captured. (Code fact + standard CRM practice, medium.)
3. Apple Mail Privacy Protection pre-fetches tracking pixels on Apple's own servers
   regardless of human action, corrupting "opened email" — which `scoreLead`'s prompt names
   as a weighted-up buying signal — for a large, unquantified share of leads. Needs a direct
   check against FollowUp's own tracking implementation before acting on it. (External,
   medium; mechanism itself is undisputed platform behavior.)
4. `scoreLead`'s JSON schema orders `score` before `reason`/`factors`, forcing a
   verdict-first, rationalize-after generation pattern — structured-output field-order
   research says reasoning fields must precede the answer to causally influence it. This
   repo's own prior research (2026-09-10 instant-ack file) already applied this fix to a
   sibling function; `scoreLead` was missed. (External mechanism, medium; code fact, high.)
5. The "long silence after a strong signal is still warm" rule ships as one abstract
   sentence with zero worked examples; few-shot examples are a documented lever for exactly
   this kind of rare, asymmetric misclassification, with a real calibration trade-off at
   very low example counts. (External, medium.)
6. `classifyAsProspect` runs on a concrete signal checklist (rewritten after real production
   misses, per its own code comment) while its sibling `scoreLead` runs on one generic
   sentence — the concrete lead-message signal list the 2026-09-13 customer-research pass
   already assembled (named specifics, timelines, financing language, offered time slots)
   hasn't been ported over. (Code fact, high confidence.)
7. WhatsApp's Cloud API exposes a three-stage `sent`/`delivered`/`read` webhook status, but
   FollowUp's `deliveryStatus` field only names `queued/sent/delivered/undelivered/failed` —
   `read` isn't captured, losing a signal that (unlike email opens) isn't corrupted by
   Apple's prefetch problem. Needs verification against Twilio's own WhatsApp callback
   docs before building. (External, medium.)
8. Comparable AI-drafting contexts converge on tracking "fraction of drafts sent unedited"
   as the core quality metric (~30% edited is a cited diagnostic threshold in sales-email
   vendor guidance), and a peer-reviewed clinical-messaging study (Frontiers in Digital
   Health / PMC, 919 messages, 100 physicians) found draft adoption behaves as roughly
   bimodal — a draft that clears a usability bar gets kept almost entirely (0.86 ROUGE-1),
   one that doesn't gets rewritten — rather than a smooth editing gradient. Different domain
   from sales, but a useful framing for what "less editing" should optimize for. (External;
   one source — the clinical study — higher confidence than typical vendor content.)
9. FollowUp cannot currently measure its own draft-edit rate at all — `POST
   /api/leads/[id]/send`'s audit log records only message length, never whether the sent
   text matches `lead.suggestedMessage`, despite that comparison being nearly free to add.
   (Code fact, high confidence — the single cheapest fix in this pass.)
10. `generateFollowUpMessage`'s prompt constrains tone, language, and factual honesty in
    real depth but has no rule against stacking multiple questions or failing to answer the
    lead's literal question first — a specific, previously-identified content gap (2026-09-13
    customer-research file, Finding 5) mapped onto the exact unaddressed prompt text. (Code
    fact, high confidence.)
11. A visible "generic vs. specific" draft signal, distinct from the lead score, follows as
    inference from Finding 8's bimodal-adoption pattern — flagged explicitly as internal
    reasoning, not externally sourced.
**Confidence:** High for every code-grounded finding (1, 2 partially, 4's code half, 6, 9,
10 — direct reads of the current codebase, not opinion). Medium for every externally
researched finding, per this repo's standing convention (search-snippet sourced), except
Finding 8's clinical-study half, which is peer-reviewed and treated as somewhat stronger
despite being a different domain (healthcare messaging, not sales).
**Conclusion / what changes:** Gives whoever next tunes `scoreLead`/`generateFollowUpMessage`
five concrete, low-effort prompt/schema changes (reorder the score schema, port the intent
checklist from the customer-research pass, add two worked few-shot examples, add an
answer-first/one-question structural rule) and two concrete, low-effort code changes (wire
`deliveryStatus`/bounce data into the silence/cold-lead logic; log whether a sent message
matches the stored AI draft) — all traceable to a specific line of the current codebase, not
a general "make the AI better" directive. Two findings (Apple MPP's actual effect on
FollowUp's own tracking; whether Twilio's WhatsApp callback surfaces Meta's `read` status)
are explicitly flagged as needing a direct verification pass before acting on them.
**Written up in:**
`followup/research/product/2026-09-13-scoring-and-drafting-accuracy.md`
