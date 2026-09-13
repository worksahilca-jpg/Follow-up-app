# Landing page research: what makes one effective, and how FollowUp's current page compares

**Date:** 2026-09-13
**Author:** product-narrative-agent
**Scope:** A founder-requested research report answering six specific questions about landing-page
effectiveness in general, then applying the findings to FollowUp's actual, shipped landing page
(`followup/src/app/page.tsx` + `followup/src/app/landing-award.module.css`). Research and writing
only — no code touched, nothing redesigned, no tokens proposed.

## What was read before researching (per the design brain's own rule — don't research what's
already on file)

- `design-brain/README.md`, `design-brain/brand/brand-principles.md` — the eight standing
  principles and which ones already carry external evidence.
- `design-brain/decisions/approved.md` — **A-002** (2026-09-13): the whole app, including the
  landing page, converges on the navy `#0b1f33` / blue `#2a5cdb` "Award Direction" system
  (Bricolage Grotesque + Public Sans + IBM Plex Mono). This report treats that as settled and
  does not revisit it.
- `design-brain/decisions/rejected.md` — the sixteen standing rejections (S-01–S-16). Nothing in
  this report proposes anything on that list; where relevant, I note that the current page already
  respects a specific one.
- `design-brain/decisions/design-decisions.md` D-008–D-011 — the reasoning trail for why the
  landing page is a page-scoped visual exception, what was deliberately cut from the design
  exploration it's based on (frost particles, cursor-glow, glassmorphism, a spinning
  conic-gradient pricing border), and why `page.tsx` itself was left untouched during the D-010
  app-wide reskin.
- `design-brain/references/landing-pages/README.md` and `reference-index.md` — the reference
  library is **empty** (confirmed again this session); nothing here is drawn from a stored,
  approved reference. Where I invoke Stripe/Linear, it is as an uncited-but-named principle per
  that folder's own rule ("references are principles, never screens to copy"), not from a stored
  file.
- `followup/PRODUCT_DIRECTION.md` in full — the canonical statement of what FollowUp is, used
  directly in Section 4 below.
- `followup/src/app/page.tsx` (539 lines) and `landing-award.module.css` (477 lines) — the actual,
  currently-shipping landing page, read in full, not from memory or a prior summary.
- `followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md` and
  `design-brain/research/research-log.md` — for the confidence-labeling convention this file
  follows, and to avoid re-researching ICP/trust findings already on file (that file's Finding 6
  on Instagram DM volume and Finding 3 on comparison-shopping vs. disinterest are relevant
  background for Section 4 and are not re-derived here).

## Sourcing caveat — read before trusting any number below

**WebFetch is confirmed blocked network-wide again this session** — tested directly against
`www.nngroup.com` and `stripe.com`, both returned `EGRESS_BLOCKED`, consistent with every prior
research pass logged in this repo. Every citation in this report is therefore a **WebSearch
result-snippet**, not a page I fetched and read in full. Per this repo's standing convention
(`design-brain/decisions/design-decisions.md` D-006), that caps most findings at **medium
confidence** — solid enough to steer a design/copy pass, not solid enough to quote verbatim in
FollowUp's own marketing copy without a direct-source check first. Two exceptions, called out
individually below, are peer-reviewed or clearly attributable to a named, specific study rather
than an aggregator blog, so I've marked those higher.

I did not describe any competitor's or reference company's live interface from memory as though
I'd seen it rendered this session — Stripe and Linear are invoked only as named, general design
*principles* (per this repo's own reference-library rule), and I say explicitly where that's
recalled/uncited rather than sourced from a fetched page.

---

## 1. What makes a landing page effective / "catchy"? The real mechanics

Not vague adjectives — three measurable mechanisms, in the order a visitor actually experiences
them.

**a) The first-impression window is shorter than any copy can be read.** The foundational study
here is Lindgaard et al., *"Attention web designers: you have 50 milliseconds to make a good first
impression!"* (*Behaviour & Information Technology*, 2006) — participants rated the visual appeal
of homepages shown for only 50ms and 500ms, and their ratings correlated highly with each other and
with longer exposure. **Confidence: medium-high** — this is a specific, peer-reviewed, named study
(traceable via its own DOI/Tandfonline listing), not an aggregator paraphrase, even though I only
have it via a WebSearch snippet this session. A related, frequently-cited follow-on line of
research (Google/University of Basel) found the two things visitors judge in that first instant are
**visual complexity** and **prototypicality** (does it look like the kind of thing I expect) —
lower visual complexity read as more appealing at 50ms. **Confidence: medium** (aggregator-sourced
this session, not the primary paper itself).
**What this means concretely:** the visitor has formed an opinion about whether your product looks
competent *before they've read a single word* — off Bricolage Grotesque headline weight, contrast,
and whitespace discipline are doing real work before the H1's text does.

**b) Most of a visitor's attention never leaves the top of the page.** Nielsen Norman Group's own
scrolling-and-attention eye-tracking research (their original 2010 study found 80% of viewing time
above the fold; a repeat in 2018 found viewing time above the fold had dropped to ~57%, with 74% of
total viewing time spent within the first two screenfuls). **Confidence: medium** (WebSearch
snippet of NN/G's own published research, not the article itself, but a specific, named,
repeated study rather than a vague claim). **What this means concretely:** the hero section plus
the section immediately below it are not "one part of ten" — they carry roughly three-quarters of
the page's actual attention budget. Anything below the third or fourth section is read by a
minority of visitors, by design of how people browse, not because of any flaw in that content.

**c) People scan in a predictable shape, not top-to-bottom evenly.** NN/G's F-pattern eye-tracking
research (first published 2006, replicated 2017 across a larger sample) found users read two
horizontal sweeps near the top of the content area, then scan vertically down the left edge —
an F shape. **Confidence: medium** (same sourcing caveat as above; this is a well-established,
widely-cited NN/G finding, not a fringe claim). **What this means concretely:** headline → subhead
→ primary CTA should sit stacked at the *top-left* of the content area, and the left edge of the
page (where icon labels, section eyebrows, and card titles live) is read more reliably than
right-aligned or center-buried text.

**The "hook":** put together, "catchy" isn't a feeling — it's (a) a layout simple enough to read as
competent in 50ms, (b) the single most important sentence positioned inside the ~75% of attention
that above-the-fold content receives, and (c) that sentence sitting where an F-pattern scan
actually lands (top-left, short, first). A landing page that nails the mechanics and still doesn't
convert usually fails on the *content* of that sentence (Section 3), not the mechanics.

---

## 2. What should be on a landing page, and why? Section by section

Justification, not just a list — and cross-checked against what FollowUp's page already has.

| Section | Why it belongs | FollowUp has it? |
|---|---|---|
| **Hero** (headline, subhead, primary CTA, a visual) | This *is* the 50ms/F-pattern window from Section 1 — it has to work standing completely alone, because a meaningful share of visitors never scroll past it. | Yes. |
| **Problem / agitation** | A visitor who doesn't yet feel the pain won't value the solution. This is the classic Problem-Agitate-Solve copywriting shape (a landing-page copywriting framework referenced across multiple copywriting-guide sources this session, e.g. VWO's and Thinkshaw's landing-page-copy guides — **confidence: medium**, aggregator-sourced): state the problem in the visitor's own terms *before* pitching the mechanism, or the mechanism has nothing to be a relief from. | Yes — "The gap" section, with three disclosed industry stats. |
| **Positioning / differentiation** | Almost every visitor already has a mental model ("this is like a CRM," "this is like Follow Up Boss") — a page that doesn't explicitly say what's different gets silently filed under the nearest existing category and loses on features it was never trying to win on. | Yes — the "lead generation vs. lead conversion" comparison table. This is the single most important section on the page relative to FollowUp's actual thesis; see the gap flagged in Section 6 about *where* it sits. |
| **How it works** | Reduces perceived setup effort and gives the visitor a mental model of the product before asking for commitment. Vendor-guide convergence this session (cortes.design, lollypop.design) describes a 3–5 step pattern with verb-led step titles as the common, working shape. **Confidence: medium.** | Yes — 4 steps, verb-led ("Connect," "It scores," "You get," "It drafts"). |
| **Who it's for** | Lets a mismatched visitor self-select out fast (good — a wasted trial signup is not a win) and lets a matched visitor see themselves immediately, which is a stronger trust signal than an abstract feature list. | Yes — three named personas (realtor, freelance consultant, 4-person agency). |
| **Proof / social proof** | 92% of consumers report reading reviews/testimonials before a purchase decision per one aggregator's citation of a Trustpilot/-style consumer survey (**confidence: low-medium**, single-aggregator sourced, not independently cross-checked this session); logo walls and quantified case studies are described as the highest-performing B2B-specific formats. | **No** — and deliberately so; see Section 6, Gap 5. This is the one canonical section genuinely missing, for an honest reason on file in the code's own comments (no real customers yet). |
| **Pricing** | Hidden pricing is a trust cost for a self-serve SaaS buyer, especially one who has been burned by "contact sales" gatekeeping elsewhere in this exact category (per this repo's own market research on HubSpot/Follow Up Boss/Podium pricing opacity). | Yes — one flat number, visible, no gate. |
| **FAQ** | Doubles as objection-handling, which matters more than usual here: this product auto-drafts and can auto-send on a business's behalf, and this repo's own prior research (`design-brain/research/ux-patterns/2026-09-12-…`) found 77% of consumers want human approval before an agent acts on their behalf. An FAQ that answers "will this send without my permission?" *first* is directly addressing the sharpest trust objection this product category has. | Yes, and it leads with exactly that question. |
| **Closing CTA** | One more chance to convert a visitor who read the whole page but didn't act at the top — should restate the single sharpest idea once, not manufacture urgency (ties directly to brand principle 2: "urgency is stated once, precisely, where it's actionable"). | Yes — "Your next lost sale is sitting in your inbox right now," said once. |
| **Footer** | Legitimacy signal (privacy/terms exist, someone stands behind this) more than a functional section. | Yes, minimal, correctly so. |

**Section-by-section verdict:** every canonical section that should exist, exists, except proof —
and that's a deliberate, honest omission rather than an oversight (see Section 6).

---

## 3. What makes visitors "get it" fast and stay hooked? Concrete techniques

- **Clarity is the actual conversion lever, not persuasion technique.** Multiple copywriting-guide
  sources converge on the same instruction this session: avoid corporate jargon, and "if a customer
  wouldn't say it in a conversation, don't use it in your copy." **Confidence: medium**
  (aggregator-sourced, but a consistent, unsurprising convergence, and directly consistent with
  FollowUp's own brand principle 4, which predates this research and was arrived at independently).
- **Progressive disclosure**, meaning value proposition first, mechanism second, proof third, fine
  detail last — reduces the cognitive load of a first-time visitor who is deciding, in seconds,
  whether to keep reading at all. **Confidence: medium**, and directly matches the page's actual
  structure already (hero → problem → positioning → mechanism → proof-equivalent → detail).
- **Benefit-first headlines beat mechanism-first ones.** One aggregator's synthesis this session
  claims headlines under ~8 words naming the visitor's outcome (not the technology) can lift
  conversion by roughly 28%. **Confidence: low-medium** — a single, round, marketing-blog-style
  number I could not independently cross-check this session; treat the *direction* (name the
  outcome, not the mechanism) as more trustworthy than the specific 28% figure.
- **Jargon that isn't recognizable to the visitor breaks trust rather than building it**, especially
  when it sits next to jargon that *is* recognizable (a consumer brand name) — an unfamiliar term in
  that company puts more, not less, cognitive load on a reader trying to self-identify with the
  product. (Direct application to FollowUp in Section 6, Gap 3.)
- **Repetition of the same CTA, not escalating asks.** A visitor who is asked to "Get started" at
  the top, in pricing, and at the close, and never asked for anything different in between, doesn't
  have to re-decide what committing means each time. FollowUp's page already does this consistently
  — one verb, "Get started," at all three CTA moments.
- **Self-selection beats persuasion for ICP fit.** A visitor reading a persona description that
  matches their own situation ("Five open houses on Saturday...") experiences recognition, which is
  a faster and more durable trust signal than being told the product is good.
- **Honest, disclosed limitations build more trust than a stronger unqualified claim would.**
  FollowUp's own page already does this (the industry-stat disclaimer: "not FollowUp's own
  results") — this isn't from an external source, it's a direct application of brand principle 1
  ("trust is the product") and is worth naming as something the page already gets right, not a
  gap.

---

## 4. What FollowUp is about, framed for a first-time visitor

Grounded directly in `PRODUCT_DIRECTION.md`'s own canonical wording (the CEO's 2026-09-07 framing,
plus the 2026-09-06 voice-agent update) — not invented, not softened into generic SaaS copy:

> FollowUp is not a lead-generation tool, and it doesn't claim to get a business more leads. It
> exists because the leads a business already has often go cold — not because the owner doesn't
> care, but because following up is the first thing that gets dropped when they're busy, and it
> keeps getting dropped. FollowUp reads the conversations a business is already having — its
> Gmail or Outlook inbox, its texts, its Instagram and WhatsApp messages, its missed calls — in one
> place, without asking anyone to log or re-enter anything into a new system. It watches for the
> exact moment a lead is at risk of being lost to silence — no reply sent, a stalled back-and-forth,
> a call that went unanswered — and either drafts what to say next for a human to approve, or, for
> the safe, low-risk cases, sends it on its own, with a visible reason for every decision it makes
> and a record of exactly what it did. A live AI agent already answers phone calls directly and
> speaks back to the caller in their own language, not just a voicemail transcript. The stated end
> state, in the founder's own words, is that no human should have to do this specific job at all —
> the owner still closes the deal, but stops losing it to a message that just never got answered.

This deliberately omits anything not yet true (full skill-based routing, every channel unblocked at
scale, non-English capture verified end-to-end) — consistent with the instruction not to oversell
past what's shipped.

---

## 5. Visual/UI/UX design research: what makes a landing page read as premium, modern SaaS — applied to FollowUp's own Award Direction system

**Grounding, not invention:** FollowUp's landing page already has an approved, shipped visual
system (`landing-award.module.css`, ratified system-wide by A-002/D-010) — this section applies
research to *that* system, and does not propose a new one, per the task's own constraint.

**The two most-cited, most defensible principles behind "premium SaaS," named explicitly as
principles rather than screens (per this repo's own reference-library rule, and because the
reference library itself is empty — nothing here carries the authority of an APPROVED reference,
it's uncited general design knowledge cross-checked against this session's WebSearch results,
flagged as such):**

1. **Color is rationed, not decorative.** A description of Stripe's site design surfaced this
   session frames it directly: the accent color is spent on primary actions, focus states, and
   occasional highlights, "rather than drowning users in indicators" — a restrained, mostly
   monochrome base with one color meaning "this is interactive/important." **Confidence: low**
   (a single aggregator's characterization of Stripe's design, not a fetched, verified look at the
   live site this session — flagged as recalled/uncited per the task's instruction). Applied to
   FollowUp: checked directly against the actual CSS, `--accent` (`#2a5cdb`) is used for exactly
   the roles this principle predicts — primary CTA fills, active/hover state on the orbit-diagram
   labels, the accent-gradient headline word, checkmarks in the comparison table, and the pricing
   card's border. It is not used decoratively elsewhere on the page. **This is a genuine, verified
   match, not an aspiration** — worth stating as a strength, not just a principle to aim for.
2. **Typography carries the hierarchy that color and imagery aren't allowed to.** The same
   reasoning applies to Linear's "crisp typography, dark-first, low-contrast borders" reputation.
   **Confidence: low** (same caveat — recalled/aggregator-sourced, not fetched live this session).
   Applied to FollowUp: the three-typeface system (Bricolage Grotesque for headings with tight
   `-0.02em` tracking, Public Sans for body, IBM Plex Mono for eyebrow labels and orbit-node
   captions) gives each face exactly one job, which is the same *principle* Stripe/Linear are
   praised for even though the specific faces differ — restraint through role-separation, not
   through using only one face. **Worth flagging honestly:** this is in tension with the *literal*
   wording of brand principle 8 ("one typeface"), written 2026-09-12, one day before Award
   Direction's three-typeface system was approved (A-002, 2026-09-13). The design brain's own
   README says a file that's "wrong, out of date, or contradicted by what actually ships" should
   be fixed and flagged — this is that situation, for whoever next edits `brand-principles.md`, not
   something this research-only pass is resolving unilaterally.

**Whitespace and restraint, verified in the actual code, not just claimed:** `page.tsx` uses a
single `max-w-6xl` container consistently, `py-20`/`py-24` vertical section rhythm throughout, and
the `.card` treatment (white fill, one border, one shadow, a hover lift) is not nested inside
another card anywhere on the page — a direct, verifiable adherence to the standing rejection on
"card-in-card soup" (S-09).

**Motion, checked against the standing rule ("motion must explain change or not exist," S-08):**
the hero's word-by-word reveal, the scroll-triggered section reveals, and the orbit diagram are all
justified in the CSS file's own comments as either sequence-explaining or a direct, named CEO
request (D-009) — not ambient decoration. This is a genuine strength worth naming, not just an
absence of violation: the page's own code comments show the restraint was actively reasoned about
(frost particles, cursor-follow glow, and a spinning gradient pricing border were all explicitly
cut), not merely avoided by accident.

**One real opportunity, flagged not decided (a content/asset question, not a token question):**
of the two dominant patterns for showing "the product" on a SaaS landing page — a real product
screenshot vs. an abstracted illustration — one aggregator's count this session claims screenshots
are the majority pattern (roughly 40% of a sampled set of SaaS pages) and are framed as the
"strongest default" for credibility. **Confidence: low** (single aggregator, small unclear sample,
not cross-checked). FollowUp's hero mockup (`HeroMockupAward.tsx`) is a fully custom-built
illustration of an app window — well-executed, and explicitly *not* glassy/blurred per the
standing rejection on glassmorphism — but it is not a screenshot of the real, shipped dashboard.
Whether a real (even cropped/staged) screenshot would read as more credible than the current
illustration is a genuine open question worth testing, not something this pass is deciding — it's
squarely a `frontend-3d-agent` build question once/if it's prioritized, not a copy or token change.

---

## 6. Gap list — what's missing or weak on FollowUp's current landing page

Ordered roughly by size of the gap, each checked directly against the live code, not assumed.

1. **The live AI voice agent — a real, shipped, hard-to-copy capability — is entirely absent from
   the page.** Verified by direct grep: zero occurrences of "voice," "speaks," or "multilingual"
   anywhere in `page.tsx`; "call"/"phone" only appear in unrelated contexts (a stat about missed
   calls, scheduling a human sales call, informal phrasing like "call first"). The page uses "62%
   of calls to small businesses go unanswered entirely" purely as a *problem* statistic and never
   connects it to the fact that FollowUp itself now answers those calls with a live, speaking,
   in-language AI agent (`PRODUCT_DIRECTION.md`'s Phase 1, shipped). This is the single highest-
   leverage gap on the page: it's a real capability, it's the hardest of everything shipped for a
   platform like Google/Meta to casually give away for free (Rule 4), and it's currently invisible
   to every visitor.
2. **The core thesis doesn't reach a first-time visitor until the third section of the page.**
   Given Section 1's finding that a majority of attention concentrates in the hero and the section
   immediately below it, the fact that "you don't have a lead-generation problem, you have a
   lead-conversion problem" — the one sentence this entire product's positioning depends on — only
   appears in the third section ("Why FollowUp exists") rather than the hero is worth naming
   plainly. The hero's actual headline is a metaphor ("the one that went quiet") rather than the
   thesis stated directly; the subhead does clarify quickly, so this is a real but moderate gap,
   not a failure — flagged as a question for a future copy pass, not a rewrite recommendation from
   this research-only report.
3. **"Twilio" as a channel-logo label is backend/vendor jargon next to four consumer-recognizable
   brand names.** Verified directly in the code: the "Reads what you already use" row lists
   "Gmail, Outlook, Twilio, Instagram, WhatsApp." A realtor or small-team owner recognizes the
   other four as things they personally use; "Twilio" is the name of FollowUp's own SMS/voice
   vendor, not a brand the visitor has any relationship with, and sitting inside a row otherwise
   designed to trigger recognition ("oh, I use that") undercuts its own device. A concrete,
   contained wording fix (e.g., "Texting & calls" in that slot) rather than a design change.
4. **The hero's supporting stat sentence conflates two unrelated claims.** Direct quote from the
   code: *"21× higher qualification rate when a lead is contacted within 5 minutes instead of after
   30 — no credit card required to see it for yourself."* The 21x figure is an industry benchmark
   claim; "no credit card required" is a trial-friction reassurance. Joined by an em dash in one
   sentence, they read as one idea when they're two, and the "to see it for yourself" phrasing
   implies the *stat itself* is something a visitor can go verify by trying FollowUp, which isn't
   quite what's being said. Small, contained, easy to isolate as two separate lines.
5. **No proof section, and the honest reason why is worth stating plainly rather than treating as
   solved.** The code's own header comment confirms this was a deliberate choice ("FollowUp has no
   real customers yet and it was never real content to begin with" — a placeholder testimonial was
   removed rather than kept). That's the right call per brand principle 1, and better than a fake
   testimonial. But per Section 2's findings, proof is one of the highest-leverage sections a
   landing page can have, and FollowUp currently substitutes only disclosed industry stats for it.
   Worth a future pass considering a substitute that doesn't require fabricating customers: the
   specific, real guarantees already true (the reply-stops-the-sequence guarantee, the visible
   consent/audit trail per lead) could themselves be the proof mechanism, framed as "here's exactly
   what we promise, in writing, not a testimonial" — consistent with "trust outranks sophistication"
   without inventing anything.
6. **The hero mockup is an illustration, not a real product screenshot** — see Section 5's flagged
   opportunity. Not re-listing the reasoning here, just noting it as an open item for a future pass,
   explicitly a `frontend-3d-agent` build decision rather than a copy one.
7. **"Route new leads to the right person" (FAQ, "Does this work for a team, or just one person?")
   risks overclaiming FollowUp's actual routing capability.** Verified against this agent's own
   standing brief and the repo: real routing today is Ponds (an unclaimed shared pool anyone on a
   team can claim) plus per-source workflow/tier assignment (Settings → Lead routing) — neither is
   true skill-based matching to "the right" specific person. The FAQ's phrasing is a defensible
   one-line simplification for a non-technical reader, but it's close enough to the line on
   overclaiming skill-based routing that it's worth a founder/copy review, not a silent pass.
8. **`brand-principles.md`'s "one typeface" wording (principle 8) is stale against what's actually
   shipped and approved** — see Section 5. Flagged for whoever next touches that file; not resolved
   here, since this pass's scope was the landing page's content and positioning, not a brand-doc
   edit.
9. **Trust/data-handling content is accurate but positioned late.** The FAQ's answer on data
   export/deletion and no-training-without-stripping-identifiers is specific and good — but it's
   FAQ item 5 of 6, deep in the page, for a product whose central risk objection (per this repo's
   own prior UX-patterns research: 77% want approval before an agent acts) is trust in automated
   sending. The strongest trust content (the "will this send without my permission?" FAQ item,
   correctly placed first) already leads; the data-handling answer is a secondary trust question
   that could plausibly move earlier. Flagged as a placement question, not a content gap — the
   words themselves don't need to change.

**What this report is not:** a redesign, a rewrite, or a set of finished copy. Every gap above is
named as a question for a future, scoped pass — several (1, 2, 5, 6) are genuinely significant;
others (3, 4) are small, contained wording fixes; two (7, 8) are accuracy/documentation flags
outside the landing page itself, surfaced here because this research touched them directly.
