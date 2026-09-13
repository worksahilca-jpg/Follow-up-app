# What leads actually say: first-contact patterns for scoring and drafting

**Date:** 2026-09-13
**Author:** product-narrative-agent
**Scope:** What inbound leads (real estate first, small-service-business second) actually
type/say in their first message across channels, what distinguishes hot from cold intent in
their own wording, what a "good fast response" needs to contain, and what causes a real,
still-engaged lead to get mislabeled cold. Written to be directly useful to whoever next
tunes the AI classifier/drafting prompt (`src/lib/scoring.ts`, `src/lib/integrations/openai.ts`)
— this file does not read or reference that code, it's a content/behavior brief for it.

## What already exists — read first, not duplicated here

- `research/customers/2026-09-05-icp-pain-and-trust-objections.md` — ICP, pain points in
  the business owner's own words, trust objections to auto-send. This file is complementary:
  that one is about the *owner's* psychology; this one is about the *lead's* language.
- `design-brain/research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`
  — design implications drawn from the above. Findings 3 and 4 here (false-cold, response
  content) extend Findings 3 and 4 there rather than repeating them.
- `PRODUCT_DIRECTION.md` — confirms the score-with-a-reason and approval-first defaults this
  file's findings should sharpen, not redefine.

Nothing in the repo before this file addressed lead *message content* specifically — every
prior pass covered the business owner's pain, pricing, or trust, not what a lead actually
types.

## Sourcing caveat — carry this wherever these findings go

**WebFetch is blocked network-wide in this sandbox** — confirmed again this session against
`en.wikipedia.org`, `theclose.com`, `www.zillow.com`, `www.sierrainteractive.com`,
`callaction.co`, and `academy.realscout.com` (all returned `EGRESS_BLOCKED`), matching the
2026-09-05 customer-research pass's finding. Every citation below is a **WebSearch
result-snippet**, not a page I fetched and read in full. Per this repo's convention
(`design-brain/decisions/design-decisions.md` D-006), that caps confidence at **medium** —
strong enough to guide a scoring-prompt or draft-quality change, not strong enough to be
quoted verbatim as a stat on a landing page or in a sales deck without a direct fetch/primary
check first. One exception: the NAR 2025 Technology Survey figures (Finding 6) are traceable
to NAR's own PDF and press release via the search snippet, so I'm treating that one figure —
and only that one — as higher confidence than the rest.

---

## Finding 1 — The three canonical DM/inbound questions are narrower than expected, and they're the same three across channels

Across Instagram/Facebook DM automation vendors describing what agents actually get asked,
the same three questions recur almost verbatim: **"Is it still available?", "When can I
tour?", "What's the price?"** — described as questions "agents answer... dozens of times
daily." *(creatorflow.so and plugdialog.com, both via WebSearch 2026-09-13, cross-checked
against each other since both are DM-automation vendor blogs, not primary data — treat the
exact wording as vendor-paraphrased, but the three-question clustering as a real, consistent
pattern across independent sources.)*

**Why this matters for scoring/drafting:** these three questions are almost entirely
*factual* (availability, timing, price) rather than emotional or exploratory. A classifier
that treats "is this still available?" as a low-effort/low-intent message (it's short, it's
templated-sounding) would be wrong — this is reportedly the single most common *high-value*
first message shape in the category. The action item isn't "score short messages low" or
"score short messages high" — it's that **message length is a weak/misleading intent
signal on its own**; question *type* (does it reference a specific unit/property/service,
does it ask about timing) matters more than length or elaborateness. A one-line "still
available?" from a lead who found one specific listing is a stronger buy signal than a long,
generic "tell me about your services" message.

**Actionable for `suggestedMessage` drafting:** because these three questions are so
predictable and factual, the single highest-leverage thing a drafted reply can do is *answer
the specific factual question asked* (confirm availability/price/timing explicitly, by name)
before anything else — not open with rapport-building copy. This maps to a concrete,
testable draft-quality bar: does the first sentence of the draft answer the literal question
in the lead's message.

---

## Finding 2 — Real intent signals are about specificity and readiness-to-act, not enthusiasm or politeness

A cluster of B2B/real-estate lead-scoring sources converges on the same distinguishing
signals between high- and low-intent inbound leads:

- **High-intent:** a **specific property address, unit, or loan amount** named in the
  message; mention of a **recent credit pull or pre-approval attempt**; direct questions
  about **closing costs, rate locks, or documentation**; a **stated timeline** ("moving in
  the next 90 days" vs. "just curious" or "eventually"); willingness to **give up a specific
  calendar slot** rather than "sometime this week." *(realscout academy and aisdr.com blog
  summaries, WebSearch 2026-09-13 — realscout is a real-estate-specific search/CRM vendor, so
  this is closer to primary practitioner knowledge than a generic marketing blog, but still
  vendor content, not an independent study.)*
- **Low-intent / early-awareness:** generic browsing language, no timeline stated, no
  financing readiness mentioned, engagement with content (a blog post, a general listing
  alert) rather than a specific transaction question.
- A parallel, independently-worded qualification framework names the same four axes:
  **timeline, financing reality, agent status (already working with someone or not), and
  search specificity** as the actual determinants of whether a buyer inquiry deserves
  priority handling. *(highnote.io buyer-questions roundup, WebSearch 2026-09-13.)*

**Actionable for the scoring prompt:** the signal set to weight up is concrete and
short-listable — (1) a named specific address/unit/property/service, (2) a stated or
implied timeline ("this weekend," "before school starts," "need it fixed today" for a
service business), (3) financing/budget-readiness language ("pre-approved," "I have cash,"
"what's the deposit"), (4) offering a specific time slot rather than vague availability.
None of these require sentiment analysis or politeness-detection — they're closer to
named-entity/keyword-pattern detection than tone analysis, which should make them more
reliable to detect than "how enthusiastic does this sound," and less prone to
misreading terse-but-serious leads (see Finding 4).

---

## Finding 3 — Comparison-shopping, not disinterest, is the single biggest cause of leads that look cold but aren't

This is the most load-bearing finding for FollowUp's specific thesis (lead conversion, not
lead generation — leads shouldn't go cold from silence):

- **"Online buyers rarely contact just one agent — they fill out forms on several sites at
  once and start a conversation with whoever replies first, often regardless of who's the
  better fit."** *(sierrainteractive.com, via WebSearch 2026-09-13 snippet — direct fetch
  blocked, see caveat above.)*
- A separate source states the mechanism directly: **roughly 40% of internet leads
  transact within 24 months of their original inquiry, and an estimated 70% of "lost" leads
  are lost only because the agent stopped following up — not because the lead lost
  interest.** *(automatebusiness.com, via WebSearch 2026-09-13 — same fetch-blocked caveat;
  this specific 40%/70% pairing did not independently cross-check against a second source in
  this pass, so treat it as single-sourced and medium-to-low confidence on the exact
  numbers, though directionally consistent with the sierrainteractive finding and with NAR's
  independently-sourced "48% of agents never follow up after initial contact" stat found in
  the same session — see below.)*
- Independently, from the 2024 NAR Member Profile (cited via agentzap.ai's aggregation, not
  fetched from NAR directly): **48% of agents never follow up with a lead after the initial
  contact attempt.** This is a supply-side (agent behavior) stat, not a lead-behavior stat,
  but it's the mechanism that turns a "still comparing agents" lead into a permanently lost
  one — if nobody on the other end follows up a second time, the lead has no reason to come
  back regardless of their actual intent.

**Actionable — this directly validates and sharpens FollowUp's existing "false cold"
concern from the design-brain UX-patterns file:** a lead who goes silent should default to
"comparing options, not gone" rather than "cold," specifically:
- **The silence-triggered rescue message should not read as a last resort or a guilt-trip.**
  It should read as a normal, low-pressure check-in appropriate for someone who's likely
  mid-comparison with other providers — not "did we do something wrong?" framing.
- **A lead re-engaging after days or weeks of silence is the expected case, not a surprising
  one** — this is exactly the "rescued lead comes back" event FollowUp already tracks and
  notifies on (per `PRODUCT_DIRECTION.md`), and the numbers here (40% transact within 24
  months) argue that window should stay open far longer than an initial instinct might
  suggest, rather than a cold lead being written off after one unanswered follow-up.
- **This is also a copy opportunity, not just a scoring one**: FollowUp's own messaging
  about *why* rescue follow-up matters could cite this mechanism ("most leads don't go cold
  because they lost interest — they go cold because nobody followed up a second time") as
  the plain-language version of the thesis, once verified against a primary source.

---

## Finding 4 — Terse, short replies are a real false-cold trap distinct from Finding 3

A short or informal-sounding reply ("k," "maybe," "still thinking") is repeatedly flagged in
vendor guidance as easy to misread as disinterest when it's actually a busy person giving a
normal-length text reply. *(Aggregated across multiple real-estate-texting-script blogs —
theclose.com, followupboss.com's texting guide, nurturebeast.com — via WebSearch 2026-09-13;
this is a consistent practitioner-advice pattern across several independent vendor sources
rather than a single study, which is a different and slightly stronger evidence shape than a
single-sourced stat, even though none of the individual sources is a primary study.)**

**Actionable for the classifier:** brevity/informality of a *reply* (as opposed to a first
inbound message, Finding 1) should not by itself downgrade a lead's score — especially over
SMS, where short replies are the channel norm, not a signal of low effort. The thing that
should downgrade a lead is an *explicit* negative signal (an explicit "not interested,"
"went with someone else," "no longer looking") — not the absence of enthusiasm in the
wording. This is a distinct trap from Finding 3 (silence) — this one is about
*misclassifying an actual reply*, not a lack of one.

---

## Finding 5 — What a "good fast response" needs to contain, beyond speed

Speed is already well-documented in the repo (77% of buyers work with whoever responds
first per the 2026-09-05 pass; 21x conversion lift responding within 5 minutes vs. 30,
independently re-confirmed this session via sierrainteractive.com and hyperleap.ai
snippets, WebSearch 2026-09-13). The new, content-specific finding this pass adds:

- Automated first-response examples that convert reportedly do two things in order: (1)
  **answer the literal question or confirm receipt of the specific inquiry** ("Got your
  request for [property/service] — can we get you scheduled this week?"), then (2) **ask
  one qualifying question**, not several. *(messageiq.io and marqeable.com home-services
  SMS guidance, WebSearch 2026-09-13.)* Multiple qualifying questions in one message is
  described as reducing reply rates.
- Instagram DM automation examples reportedly answer with price, address, and
  square-footage/specifics *in the same message*, then ask one qualifying question
  ("are you pre-approved, would Saturday or Sunday work better?"). *(plugdialog.com,
  WebSearch 2026-09-13.)*

**Actionable for `suggestedMessage` drafting quality:** the draft's shape should be
answer-first, then exactly one next-step question — not a longer, friendlier-sounding
message with multiple questions stacked in it. This is a concrete, testable structural rule
for draft quality review, distinct from tone/voice-matching (already covered in the
2026-09-05 pass).

---

## Finding 6 — Social media (DM) is now the top lead-generation channel for realtors, and almost nobody has automated the DM-to-contact step

**Primary-sourced, higher confidence than the rest of this file:** NAR's 2025 REALTORS®
Technology Survey (fielded July 2025, 49,233 invited, 1,241 usable responses) found **social
media the top lead-generating technology at 39%, ahead of CRM (23%) and the local MLS
(17%)**, with brokerage website at 13% and digital ad campaigns at 12%. Separately (via
creatorflow.so's summary of the same or an adjacent NAR finding, not independently verified
against the NAR PDF directly, so treat this second figure as the lower-confidence half):
three-quarters of agents are on social media, two-fifths call it their single best lead
source, but **fewer than one in fourteen has automated the step where a social lead becomes
a contact record.** *(NAR figures: cms.nar.realtor PDF and housingwire.com's coverage, cross-
checked against each other, WebSearch 2026-09-13. The "1 in 14" figure: creatorflow.so,
single-sourced, not cross-checked.)*

A concrete, real technical constraint worth flagging for whoever tunes Instagram DM handling
specifically: **Meta's standard Instagram messaging window closes 24 hours after the lead's
last message** — a reply sent even slightly outside that window can't be delivered as a
normal message. A `HUMAN_AGENT` tag extends this to 7 days but explicitly excludes automated/
bot messages and requires separate app permission. *(creatorflow.so, WebSearch 2026-09-13 —
this is a Meta platform policy claim from a vendor blog, not verified against Meta's own
developer docs directly in this pass; flagging as worth an independent-agent policy check
before being treated as settled, since it directly affects how FollowUp's Instagram DM
auto-reply/rescue timing should be designed.)*

**Actionable:** this is the single strongest evidence found in this pass that Instagram DM
is not a niche channel for FollowUp's ICP — it's reportedly the *top* lead source for
realtors, and the automation gap on that specific channel (contact-record creation) is
reportedly the widest of any channel. It also means DM-channel automation may have a real,
hard platform-imposed timing constraint (the 24-hour window) that other channels (SMS,
email) don't have — worth a follow-up integrations-research pass to verify against Meta's
own developer documentation before any scoring/drafting timing logic assumes DM behaves like
SMS.

---

## Summary: the 4-6 most actionable findings, restated plainly

1. **The three most common inbound DM/text questions are almost entirely factual**
   ("still available?", "when can I see it?", "what's the price?") — a good draft answers
   the literal question first, before anything else. (Finding 1, 5)
2. **Message length/politeness is a weak intent signal; specificity and readiness-to-act are
   the real signals** — a named address/unit/service, a stated timeline, financing/budget
   language, or offering a specific time slot. Score these up; don't score short messages
   down. (Finding 2)
3. **A lead going silent is far more likely to be comparison-shopping than actually
   disinterested** — reportedly a large share of "lost" leads are lost purely because
   follow-up stopped, not because interest did. Rescue messaging should read as a normal
   low-pressure check-in, not a last resort, and the re-engagement window should stay open
   longer than instinct suggests. (Finding 3)
4. **A short or terse reply from an already-engaged lead should not be scored down** — only
   an explicit negative statement should lower a score; brevity is normal texting behavior,
   especially on SMS. (Finding 4)
5. **A good automated first response answers the question, then asks exactly one qualifying
   question — never several stacked together.** This is a concrete, checkable structural
   rule for `suggestedMessage` quality review. (Finding 5)
6. **Instagram DM is reportedly the top lead-generation channel for realtors (NAR, 2025,
   primary-sourced) and the least automated at the contact-creation step** — validates
   FollowUp's existing Instagram DM channel as high-value, not a nice-to-have, and flags a
   real Meta platform timing constraint (24-hour messaging window) that needs an
   independent verification pass before any DM-specific timing logic is built on top of it.
   (Finding 6)

## What this does not answer

- Nothing here comes from an actual FollowUp customer's lead inbox — every finding is
  category-level, sourced from vendor blogs and one NAR primary survey.
- No figure here (except the NAR 2025 Technology Survey numbers) is fetch-verified; all are
  WebSearch snippets per the sandbox's network restriction. None should be quoted verbatim
  in product copy without a direct-source check first.
- The Meta 24-hour DM window claim specifically needs an independent check against Meta's
  own developer documentation before any code assumes it's exactly right.
- This pass did not find home-services- or med-spa-specific first-message-content data
  (as opposed to the real-estate-specific findings above) — the 2026-09-05 pass found strong
  pain/response-time data for home services, but this pass's *message content* findings are
  real-estate-only. Extending Findings 1, 2, 4, 5 to home services/other verticals is a
  reasonable inference (the underlying behavior — factual first questions, comparison
  shopping, terse replies — is not realtor-specific) but hasn't been separately verified.
