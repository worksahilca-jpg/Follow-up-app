# Reaching back out to someone your business ignored

**Date:** 2026-09-15
**Commissioned by:** the founder, in his words — *"when a business has ignored someone, the person
asked, nobody ever answered, weeks passed, how do you reach back out strategically? What are the
ways we can reach out such that they may qualify for something else, maybe a different service than
the one they originally asked about?"*
**Scope:** the `COLD_UNANSWERED` bucket in `src/lib/reactivation.ts` — the lead wrote, nobody here
came back to them. Not `COLD` (they stopped replying to us), which this file argues needs the
*opposite* treatment.
**No code was changed by this pass.** §7 lists code-verified observations and what I'd propose;
each would need its own change with the design-brain loop applied (message hints steer what a real
person receives — that is copy carrying UX weight).

**Which PRODUCT_DIRECTION rule this serves:** Rule 1 (depth on the one job — this is mission point
2, "rescuing cold, dead, or never-reached leads") and Rule 3 (trust is a feature — the decision
*not* to send, and the decision not to bolt an offer onto an apology, are both guarantees).
**Moat or table stakes:** moat-leaning. Anyone can send a reactivation blast. Knowing which quiet
lead is owed an apology, which is owed silence, and which may be offered something else is the part
a bulk-email tool cannot do, because it never classified the thread in the first place.

---

## Evidence quality — read this before quoting any number below

**`WebFetch` is egress-blocked in this sandbox.** Confirmed this session against `www.msi.org`
(`EGRESS_BLOCKED`), consistent with the same finding recorded in
`research/product/2026-09-09-followup-cadence-best-practices.md`. **Every finding below is
search-snippet-sourced: I read abstracts, publisher summaries and press write-ups, not full
texts.** I have not read a single one of these papers end to end. Study titles, authors, journals
and years are as reported by the publishers' own pages and are reliable; the *interpretation* of
each finding is at abstract level and could be wrong about boundary conditions.

Confidence grades used throughout:

| Grade | Means |
|---|---|
| **A** | Meta-analysis or large field experiment, identified by title/journal/year, summary consistent across independent pages. Abstract-level reading only. |
| **B** | Single peer-reviewed study or a regulator's own guidance page, snippet-sourced. |
| **C** | Practitioner / vendor claim with no stated methodology. Directional at best. |
| **Inference** | My reasoning from the graded evidence, not a finding. Marked inline. Never quote as research. |
| **Unverified** | A number I saw but could not trace to a methodology. Recorded so nobody re-finds it and believes it. Do not use. |

**Nothing in this file is a statistic I generated, and no company example, interview or quote here
is invented.** Where I wanted a number and could not get a trustworthy one, it says so.

---

## The recommendation, up front

**Send a belated *answer*, not a check-in and not an offer.** For a lead who wrote and was ignored,
the message that works is, in order:

1. One line that makes it unmistakable **they** contacted us, in their own terms — removes the
   "who is this?" moment entirely.
2. **One** short, warm, unhedged apology sentence. Not a paragraph.
3. **The actual answer to the question they asked**, as far as it can be given. This is the whole
   message. Everything else is packaging.
4. One easy question, and a clean way to say "no longer needed."

**Do not put a different service in that message.** The cross-sell, where it is legitimate at all,
is a *second-exchange* move that happens after they reply — with exactly one exception (§3c: when
the different service is the honest answer to the original question, because the original request
cannot be fulfilled as asked).

The three things the evidence is clearest about:

- **An apology helps when the recipient already knows they were failed, and backfires when they
  don't.** (Grade A.) An ignored inquirer knows. A lead who ghosted *us* does not — and FollowUp
  currently sends the apology-shaped hint to something closer to the second group (§7).
- **Words alone are weak; the apology has to arrive attached to something of value.** (Grade A.)
  FollowUp's version of "something of value" is not a discount — it's the answer they asked for,
  finally delivered.
- **Recovery reliably restores *satisfaction* and does not reliably restore *behaviour*.** (Grade
  A.) Expect "no longer annoyed," not "buys now." Anyone promising a conversion lift from this
  bucket is selling something.

---

## 1. What actually works when you re-contact someone you ignored

### 1.1 Set the expectation honestly: recovery repairs feelings, not necessarily behaviour

**Matos, Henrique & Rossi (2007), "Service Recovery Paradox: A Meta-Analysis," *Journal of Service
Research*** — the cumulative mean effect of the service recovery paradox is **significant and
positive on satisfaction, but non-significant on repurchase intentions, word-of-mouth and corporate
image**. Moderated by study design, subject type and service category; more likely to show up in
high-contact industries like hospitality. **Grade A.**
<https://journals.sagepub.com/doi/10.1177/1094670507303012> (checked 2026-09-15)

So the popular version of the "service recovery paradox" — fix it well and they'll love you *more*
than if you'd never failed — does not survive meta-analysis on the outcomes a business actually
cares about. **Product implication:** whatever FollowUp ships for this bucket should be measured on
*replies and resolved threads*, not on closed deals, and should not be marketed on a conversion
promise. That is a positioning constraint as much as a product one.

### 1.2 The single most useful finding: apologies work only when the failure is already known

**"Are Apologies Always the Best Policy? Apologies for Service Failures Backfire When Consumers Are
Not Aware of the Failure," *Journal of Consumer Research*** (advance article, doi
10.1093/jcr/ucaf064) — five experiments including a large-scale field experiment. Apologies
**decrease** satisfaction, trust, recommendation intention and repatronage **when the consumer was
not aware a failure occurred**, because the apology itself creates the awareness, and additionally
lowers perceived service quality and competence. **When the customer already knew a mistake had
been made — a cancelled delivery, an already-filed complaint — apologies increased satisfaction.**
**Grade A** (field experiment + four lab studies; abstract/press-summary level only).
<https://academic.oup.com/jcr/advance-article-abstract/doi/10.1093/jcr/ucaf064/8364031> ·
<https://phys.org/news/2026-03-customer-backfire.html> (both checked 2026-09-15)

The precursor working paper is **MSI Report 21-130, "An Argument for Withholding an Apology After
Service Failure"** — in a restaurant-delivery field experiment on *marginally* late orders (up to
15 minutes), customers who received an apology were **less likely to reorder within 90 days**, and
among those who did reorder, placed fewer orders, waited longer, and spent less. **Grade B**
(fetch blocked; read via the MSI research recap and search summary).
<https://www.msi.org/research-recaps/when-should-you-apologize-for-a-service-failure/> (checked
2026-09-15; PDF at msi.org egress-blocked from this sandbox)

**This is the cleanest available justification for the `COLD` / `COLD_UNANSWERED` split that
`reactivation.ts` already makes on other grounds.** A lead who was ignored for six weeks is
squarely in the "already aware" condition where apology helps. A lead who stopped replying to *us*
is in the "not aware of any failure" condition where an apology manufactures a grievance that
wasn't there and lowers perceived competence.

### 1.3 Words alone are weak — attach the apology to something

**Halperin, Ho, List & Muir, "Toward an Understanding of the Economics of Apologies: Evidence from
a Large-Scale Natural Field Experiment"** — NBER WP 25676 (2019), published in *The Economic
Journal* 132(641), 2022. **1.5 million Uber riders** who experienced late rides. Findings: apologies
are not a panacea and whether one backfires depends on how it is made; **money speaks louder than
words — the most effective apology included a coupon for a future trip; and in some cases sending
an apology is worse than sending nothing at all, particularly for repeated apologies.** **Grade A.**
<https://www.nber.org/papers/w25676> · <https://academic.oup.com/ej/article-abstract/132/641/273/6325164>
(checked 2026-09-15)

Counterweight, and I'm reporting it because it cuts the other way: **Abeler, Calaki, Andree & Basek
(2010), "The Power of Apology," *Economics Letters*** — an eBay field experiment where a firm
either apologised or offered small/large monetary compensation in exchange for withdrawing a
negative rating. **45% withdrew in response to the apology vs. 23% in response to compensation.**
**Grade B** (real field experiment, but one firm, one platform, one narrowly-defined ask).
<https://www.sciencedirect.com/science/article/abs/pii/S0165176510000340> (checked 2026-09-15)

**Honest reading of the tension:** these two are not actually contradictory in a way that matters
here. In the eBay study the apology came **attached to a specific, concrete request the recipient
could act on**; in the Uber study a bare apology at scale did badly and an apology plus something
of value did well. The common structure is *apology + a concrete thing*. **Inference:** FollowUp's
"concrete thing" is not a discount — it is the answer to the question they asked, which is the
exact item the business failed to deliver, and which costs the owner nothing but the reply. Two
further points from §1.5 support routing the remedy at the failure rather than at the wallet.

### 1.4 How an apology should be constructed

**Roschk & Kaiser (2013), "The nature of an apology: an experimental study on how to apologize
after a service failure," *Marketing Letters*** — an apology has three components: **empathy,
intensity and timing**. All three separately affect recovery satisfaction; more empathic and more
intense apologies raise satisfaction; **a late apology lowers satisfaction ratings.** Effect-size
ordering: **empathy > intensity > timing**, with empathy mattering more for process failures than
outcome failures. **Grade B.**
<https://link.springer.com/article/10.1007/s11002-012-9218-x> (checked 2026-09-15)

Being ignored is a **process** failure — nothing was delivered badly, the process of responding
simply didn't happen — which is the failure type where empathy's effect is strongest. That is the
evidence behind "one warm line, not one formal line."

**Gelbrich & Roschk (2011), "A Meta-Analysis of Organizational Complaint Handling and Customer
Responses," *Journal of Service Research*** — organizational responses (compensation, favourable
employee behaviour, organizational procedures) → justice perceptions (distributive, interactional,
procedural) → post-complaint satisfaction → loyalty and WOM. **Apology has a positive effect on
satisfaction**; distributive justice (compensation) is the salient driver only for
transaction-specific satisfaction. **Grade A.**
<https://journals.sagepub.com/doi/10.1177/1094670510387914> (checked 2026-09-15)

The justice framing is the load-bearing idea for §3. A recovery act has to land on one of three
axes: **distributive** (you gave me something), **procedural** (you fixed how this works), or
**interactional** (you treated me with respect). *A different service offered to someone you
ignored lands on none of them.*

### 1.5 An explanation, not an excuse — and it should be about process

Two snippet-level findings, both **Grade B/C**, consistent with each other:

- **Compensation offered without an explanation reads as an admission of guilt and produces more
  negative evaluations** — explanations matter independently of remedy. (Reported in the service
  recovery literature summary around Bitner-lineage attribution work; I could not pin this to a
  single primary study at snippet level, so **Grade C** and flagged as such.)
- **"Alleviating the negative impact of delayed recovery: process- versus outcome-focused
  explanations," *Journal of Services Marketing*** — when recovery is immediate, an
  outcome-focused explanation beats a process-focused one; **when recovery is delayed, a
  process-focused explanation produces higher post-failure satisfaction.** **Grade B.**
  <https://www.emerald.com/insight/content/doi/10.1108/jsm-06-2012-0097/full/html> (checked 2026-09-15)

**Everything in this bucket is by definition a delayed recovery.** That is direct support for one
short *process* clause — "this got buried in our inbox" — rather than an outcome claim ("we've
fixed our systems") or, worse, an excuse. One clause. It explains without asking to be forgiven.

### 1.6 Motive inference is the switch that decides how the message is read

**Joireman, Grégoire, Devezer & Tripp (2013), "When do customers offer firms a 'second chance'
following a double deviation? The impact of inferred firm motives on customer revenge and
reconciliation," *Journal of Retailing* 89(3), 315–337** — the key determinant of whether a
customer wants revenge or reconciliation after a failed recovery is **the valence of their inferred
firm motives**. When the inferred motive is positive, reconciliation overwhelms revenge; firms that
both compensate and apologise can flip inferred motive from negative to positive. **Grade B.**
<https://www.sciencedirect.com/science/article/abs/pii/S0022435913000237> (checked 2026-09-15)

**Becker, Spann & Barrot (2020), "Impact of Proactive Postsales Service and Cross-Selling
Activities on Customer Churn and Service Calls," *Journal of Service Research* 23(1), 53–69** —
large-scale field experiment in telecoms plus a lab experiment. Proactive post-sales service
reduces churn and inbound service calls; **the effect of adding cross-selling runs through
customers' *uncertainty about the company's motives*,** and the effect of the contact medium runs
through perceived privacy invasion. **Grade A.**
<https://journals.sagepub.com/doi/abs/10.1177/1094670519883347> (checked 2026-09-15)

Together these are the mechanism for §3: **cross-selling does its damage by making the recipient
unsure why you are really contacting them.** Someone who has just been ignored for six weeks is
*already* running that inference ("was I too small to bother with?"). Adding an offer answers the
question in the worst possible way.

### 1.7 Failing twice is categorically worse than failing once

The double-deviation literature (Bitner-lineage; systematic review: Suresh et al., 2022,
*International Journal of Consumer Studies*, <https://onlinelibrary.wiley.com/doi/10.1111/ijcs.12836>,
checked 2026-09-15) is consistent that a failed recovery on top of the original failure produces
**anger, desire for revenge and retaliatory behaviour**, not mere disappointment. **Grade B.**

This is the risk register for this whole feature. A reactivation message that is wrong — apologises
to someone who wasn't wronged, pitches someone who asked a question, arrives on a channel they
didn't choose, or arrives for a third time — isn't a neutral non-event. It is the second deviation,
and the documented response to it is anger.

### 1.8 Practitioner claims I deliberately did **not** use

For the record, so nobody re-finds them and treats them as evidence:

- "Breakup emails get 76% reply rates" / "33% response rate" / "standard follow-ups hover at 5–10%"
  — vendor blog claims with no methodology, no sample, no source study
  (<https://growleads.io/blog/breakup-email-templates-outbound-email-outreach/>,
  <https://www.mixmax.com/blog/breakup-email-templates-that-get-replies>, checked 2026-09-15).
  **Unverified. Do not use, in product copy or anywhere else.**
- "78% of consumers abandon a business after an unanswered call," "89% more likely to choose a
  competitor that responds," "64% jumped to a competitor after a poor experience" — PR-released
  vendor surveys; the 64% figure is a 2022 BusinessWire release
  (<https://www.businesswire.com/news/home/20220610005375/en/>, checked 2026-09-15). **Grade C at
  best. Directionally fine as motivation, not quotable as fact.**
- "More than 50% of companies fail to respond to leads" (InSellerate, 2015 GlobeNewswire release,
  <https://www.globenewswire.com/news-release/2015/08/20/1033235/0/en/>, checked 2026-09-15) —
  **Grade C.** The better-sourced version of this point is already on file: the HBR/Oldroyd
  2,241-company audit's "23% of leads never get a response," recorded with its own caveats in
  `research/product/2026-09-09-followup-cadence-best-practices.md` §1.

---

## 2. The apology question — does naming it plainly help, and how much?

**Yes — for this bucket specifically, and only for this bucket.**

**Does naming the failure help?** Yes, when the recipient is already aware of it (§1.2, Grade A),
which an ignored inquirer definitionally is. They wrote, they watched nothing come back, they
already formed a view. There is no awareness left to create; there is only the question of whether
we are going to pretend it didn't happen. Pretending is the option that reads badly, because the
gap is visible in the thread itself.

**How much?** One sentence. The evidence supports **warmth over length**: empathy has the largest
effect, intensity (a genuine "I'm sorry" over a perfunctory "sorry about that") second, and neither
is the same thing as volume (§1.4, Grade B). Two apology sentences is the ceiling. A paragraph of
self-criticism changes the subject from their problem to our process, which is the one topic they
did not write in about.

**Is there a point where it reads as weakness, or invites a complaint instead of a reply?** The
"weakness" claim is folk wisdom — I found **no** credible evidence that a brief apology reads as
weak in a sales context, and I'm not going to manufacture some. The documented risk is different
and more specific, and it has two parts:

1. **Apologising to someone who didn't think they were wronged** actively lowers satisfaction,
   trust and repeat behaviour (§1.2, Grade A). That is the real backfire mode, and it is a
   *targeting* error, not a tone error.
2. **An apology that names a grievance and attaches no remedy may make the grievance more
   actionable.** The nearest hard evidence is from a different domain and I'm citing it as an
   analogy, clearly labelled: **McMichael, Van Horn & Viscusi (2019), "'Sorry' Is Never Enough: How
   State Apology Laws Fail to Reduce Medical Malpractice Liability Risk," 71 *Stanford Law Review*
   341** — across ~75,000 physician-years, apology laws **increased** rather than limited
   malpractice liability risk; for non-surgeons (where patients are less aware of the underlying
   risk) they increased both the probability of facing a claim and average payments. **Grade B for
   the study; Grade Inference for the transfer to a sales inbox** — different domain, different
   stakes, and apology *laws* are not the same thing as apologies.
   <https://www.stanfordlawreview.org/print/article/sorry-is-never-enough/> (checked 2026-09-15)

   Read conservatively, it points the same way as everything else here: **an apology with nothing
   attached raises the salience of a grievance it cannot resolve.** Add the Uber finding that
   *repeated* apologies can be worse than sending nothing (§1.3, Grade A), and the rule is clean:

**Apologise once, only to someone who was actually failed, and only in the same message that
delivers the remedy. Never apologise twice.**

---

## 3. The founder's actual question — offering a different service to someone you ignored

**Short answer: not in the first message, and never as an automated default. Conditionally
legitimate later, and legitimate in the first message only when the different service *is* the
honest answer to what they originally asked.**

I want to be plain that **I found no study that directly tests cross-selling to an inquirer the
business ignored.** I looked; the nearest literature is cross-selling during service recovery in
general, and even that is thin. So this section is **inference from graded evidence**, and I'm
labelling it rather than dressing it up.

### 3a. Why the instinct is wrong more often than it's right

Three independent lines converge:

- **Justice framing (§1.4, Grade A).** A recovery act has to deliver distributive, procedural or
  interactional justice. A different service delivers none of them. It is not compensation for the
  failure; it's a new commercial proposition that happens to arrive in the same envelope as an
  apology. The apology then reads as the setup for the pitch — which retroactively makes the
  apology insincere, costing what little the apology earned.
- **Motive inference (§1.6, Grades A and B).** Cross-selling's harm is mediated by uncertainty
  about the firm's motives, and inferred motive is precisely what decides revenge vs. reconciliation
  after a failed recovery. The ignored inquirer is already asking "why did they not answer me?" A
  message that says "sorry we ignored your question — here's a different thing you could buy"
  answers it: *because there wasn't enough in it for us, and now there is.* That is the worst
  available answer and we'd be volunteering it.
- **Match the remedy to the reason (Grade A).** **Kumar, Bhagwat & Zhang (2015), "Regaining 'Lost'
  Customers," *Journal of Marketing* 79(4)** — the reason for defection and the nature of the
  win-back offer jointly predict reacquisition, second-lifetime duration and second-lifetime
  profitability. **Customers who left because they were unhappy with the *service* — as opposed to
  price — and who are won back with a *service upgrade* are the profitable ones**; the service
  upgrade is the cheapest strategy with the highest ROI, while the bundled offer has the highest
  success rate, the highest cost and the lowest ROI. Also: the offer that maximises reacquisition
  is not always the one that maximises second-lifetime profit.
  <https://journals.sagepub.com/doi/10.1509/jm.14.0107> ·
  <https://research.wpcarey.asu.edu/services-leadership/2015/08/07/what-you-need-to-know-about-customer-win-back/>
  (both checked 2026-09-15)

  **The reason this person "defected" is that we ignored them. That is a service failure. The
  matched remedy is service — an actual answer, promptly, from a named human — not a discount and
  not a different product.** This is the closest thing to a direct answer to the founder's question
  that real published evidence provides, and it says: fix the service, don't change the offer.

### 3b. The asymmetry that should settle the default

**Inference, stated as such.** Upside of cross-selling an ignored lead: one incremental deal from
someone who was already lost. Downside: a person with a legitimate, documentable grievance, a
screenshot, and a review site. The double-deviation literature (§1.7) says the response to getting
this wrong is anger and retaliation, not indifference. Under CLAUDE.md's "trust outranks
sophistication" and PRODUCT_DIRECTION's "never designed as a spam tool or an aggressive sales
platform... not in its defaults," the asymmetric payoff makes the conservative default the only
defensible one. **If FollowUp ever offers this, it must be an owner-chosen, per-lead action with an
owner-supplied alternative — never a model inferring that someone "might qualify for" something
else.**

### 3c. When a different offer *is* legitimate

There is a real, non-opportunistic version, and it is worth building for. The test is: **is the
different service an answer to their question, or a change of subject?** Only the first is
allowed. Concretely, all of these have to be true:

1. **The original request cannot be fulfilled as asked** — we don't do that, it's gone, it's out of
   our area, it's out of their budget, the date has passed. Then the alternative isn't a cross-sell
   at all; it's the answer, and withholding it would be the unhelpful move. The closest empirical
   analogue is the stockout-substitution literature: **matching the substitute on the *dominant*
   attribute increases acceptance** (flavour vs. brand matching by category), and shoppers who
   don't get an acceptable substitute switch stores rather than substitute
   (<https://www.sciencedirect.com/science/article/pii/S002243592200046X>, checked 2026-09-15).
   **Grade B for the stockout finding; Grade Inference for the transfer.** The lesson transfers
   cleanly: substitute on the attribute that mattered to them, not on the one that's convenient for
   us. Someone who asked about a *cheap* option gets a cheaper alternative, not a premium one.
2. **The hook is in their own words.** The need the other service meets was stated, by them, in
   the thread we're replying to. If we have to infer it from their industry, their company size, or
   a lookalike model, it is not a substitution — it is a cold pitch to a stranger who is already
   annoyed with us, arriving under cover of an apology.
3. **It is smaller, cheaper, or less committing than what they asked for.** **Inference, Grade C.**
   Downshifting reads as accommodation; upshifting reads as extraction. I have no direct evidence
   for this and would want to test it, but it follows from motive inference: nobody suspects a
   worse-for-us offer of being self-serving.
4. **It is one alternative, not a menu.** A list is a catalogue, and a catalogue is marketing.
5. **The apology and the alternative are the same act, not two acts stapled together.** "We can't
   do X — I should have told you that in March rather than leaving you waiting. The nearest thing
   we do is Y; if that's no use, no hard feelings." One motive, visible, and it isn't revenue.

### 3d. What makes it insulting, stated plainly for the founder

The original question was **specific and answerable**, we never answered it, and now we answer with
something else. That is the failure performed a second time, in the open, with a sales motive
attached. It converts a recoverable situation ("they forgot about me") into an unrecoverable one
("they never cared what I asked"). Every mechanism in §1.6 and §1.7 points at that outcome.

### 3e. Where the founder's instinct is genuinely right

One version of his idea survives all of the above, and it's the strongest thing in this section:
**the qualifying happens in the reply, not in the outreach.** Send the belated answer; the goal is
a reply; *once they reply, the conversation is live again* and offering a different service is
normal sales, not opportunism — because they re-entered it voluntarily and the motive question is
settled. Everything FollowUp already does (scoring, drafting, timing-aware handoff) works in that
live conversation. **So the correct product shape is: FollowUp reopens the door, the owner walks
through it.** That also happens to be the only shape that stays inside CASL at any age (§4).

---

## 4. Timing and channel

### 4.1 Sooner is strictly better and there is no lower bound on how bad late gets

**"Unveiling the recovery time zone of tolerance: when time matters in service recovery," *Journal
of the Academy of Marketing Science* 45(6), 866–883 (2017)** — there's an initial window where
compensation expectations don't rise; beyond it, the relationship is an inverted U (expectations
rise, then fall again in the long run). **Long recovery times bring lower recovery satisfaction and
more negative word of mouth — postponing recovery is a poor option. Relationship strength
moderates: first-time customers expect higher compensation earlier**, while relational customers
show a genuine tolerance window before demanding considerably more. **Grade B.**
<https://link.springer.com/article/10.1007/s11747-017-0544-7> (checked 2026-09-15)

**An ignored inquirer is a first-time non-customer: on this evidence their tolerance window is
essentially zero.** At three weeks we are already far outside it. The difference between 3 weeks
and 6 months is therefore **not** "one is fine and one isn't" — both are late. What changes with
age is the *inverted-U* part: at six months they expect less from us and think less of us. The
practical translation is that **a later message should ask for less, not more** — which is another
reason the six-month cross-sell (asking for *more*) is exactly backwards.

Supporting, same direction: a late apology lowers satisfaction ratings but does not invert the
effect (§1.4). And **"Timing of apology after service failure: the moderating role of future
interaction expectation," *Marketing Letters* (2020)** — a responsive apology (listen, then
apologise) beats a pre-emptive one **when the customer expects future interaction**, and the effect
weakens or reverses when they don't. **Grade B.**
<https://link.springer.com/article/10.1007/s11002-020-09522-y> (checked 2026-09-15). **Inference:**
a lead who wrote once, months ago, has *low* future-interaction expectation, which mildly favours
leading with the apology rather than asking them to re-explain themselves first. That also matches
the practical reality that we already have their question in the thread — asking them to repeat it
is a second insult.

### 4.2 The hard limits are legal, not stylistic

These are the real answer to "how long is too long," and they're bright lines rather than
preferences.

**CASL (Canada — directly relevant, first customers are GTA;
`research/market/2026-09-10-first-paying-customers-gta.md`).** Implied consent arising from an
**inquiry** about goods or services lasts **six months** from the inquiry; implied consent from a
**purchase** or contract lasts **24 months**. Past that, there is no implied consent for a
commercial electronic message. **Grade B — from the CRTC's own guidance pages.**
<https://crtc.gc.ca/eng/com500/guide.htm> · <https://crtc.gc.ca/eng/com500/faq500.htm> (checked
2026-09-15). *Not legal advice; a lawyer should confirm before this becomes a product gate.*

The consequence is sharp and it lands squarely on the founder's question. A belated **answer to
their own question**, inside six months, in their own thread, is the most defensible message
FollowUp can possibly send — it is a continuation of a conversation they started. A message
**promoting a different service**, seven months later, is the least defensible: it is
unambiguously a commercial electronic message, sent outside the implied-consent window, to someone
who never opted in. **CASL, independently of any of the psychology above, says the cross-sell is
the one variant you must not automate.**

**TCPA (US — SMS and voice).** There is **no statutory expiry** on consent; industry practice
clusters at 6–18 months and the caller bears the burden of proving consent. The regulatory picture
is genuinely unsettled right now: the FCC's one-to-one consent rule was vacated by the Eleventh
Circuit in January 2025 days before taking effect, and the Fifth Circuit ruled in March 2026 that
the TCPA does not require prior express written consent for automated/prerecorded telemarketing
calls to cellphones. **Grade B/C — law-firm alerts and compliance vendors, not primary orders; the
existing detail on file in `research/integrations/2026-09-06-twilio-sms-compliance.md` should win
where the two disagree.**
<https://www.hklaw.com/en/insights/publications/2026/03/tcpa-reset-fifth-circuit-rejects-prior-express-written-consent-rule>
· <https://www.bclplaw.com/en-US/events-insights-news/the-tcpas-new-opt-out-rules-take-effect-on-april-11-2025-what-does-this-mean-for-businesses.html>
(checked 2026-09-15). **Practical steer regardless of how the courts land: don't text a six-month-old
ignored inquiry about a service they never asked about.**

**Deliverability.** Mailbox providers convert long-dormant addresses into **recycled spam traps**,
with commonly-cited dormancy windows of **6–12 months**; Gmail/Yahoo's bulk-sender requirements set
a **0.3% spam-complaint ceiling** (with 0.1% the practical target) for senders above **5,000
messages/day** to personal Gmail/Yahoo accounts. **Grade C** — deliverability-vendor documentation,
internally consistent across several vendors but not a provider spec I could fetch.
<https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/> ·
<https://www.validity.com/blog/what-is-a-spam-trap/> (checked 2026-09-15). FollowUp sends from the
**owner's own Gmail**, so the 5,000/day bulk threshold rarely bites — but the reputation being
risked is the owner's own business domain, which is a worse thing to damage than a shared sending
IP, and the trap risk isn't volume-gated. **This is a real argument for an age ceiling on anything
automated, independent of the law.**

### 4.3 Proposed windows

| Age of the ignored inquiry | What to send | Why |
|---|---|---|
| **≤ 30 days** | Belated answer, same thread, same channel. Highest expected value. | Outside tolerance already, but the need is likeliest to be live and the thread still recognisable. |
| **30–180 days** | Belated answer + explicit acknowledgement that it's probably long since sorted + a genuinely easy exit. Ask for less. | Inverted-U: they expect less and think less of us (§4.1). CASL implied consent still open at ≤180 days. |
| **> 180 days** | **Nothing automated.** Owner-initiated, one message, and in Canada only where explicit consent exists. | CASL implied consent from an inquiry has expired; recycled-trap risk is material; the need is almost certainly dead. |

### 4.4 Channel: same thread, same channel, with one exception

Reply **in the original thread on the channel they used**. Four reasons, in descending order of
how well-evidenced they are:

1. **Consent is clearest there.** Under CASL the implied consent attaches to *their inquiry*; under
   TCPA, a phone number given for one purpose is not consent for a marketing text about another.
   Switching channels converts a belated reply into an unsolicited approach. (Grade B.)
2. **Motive.** Becker et al. found the *medium* effect runs through **perceived privacy invasion**
   (§1.6, Grade A). Arriving somewhere they didn't choose is the definition of that.
3. **Recognition.** The "who is this?" moment is the thing that turns a belated reply into spam.
   `deadLeadMessageHint`'s existing comment already identifies this correctly and it's the reason
   the omission of an unsubscribe line is defensible; a channel switch destroys the same property.
   (Grade Inference, but it is the same argument already accepted in the codebase.)
4. **It is the channel they chose**, which is information about how they want to be reached.

**Exception:** a missed *call* with a number attached, where an SMS is the conventional
same-conversation response — which is already the product's missed-call text-back behaviour and
shouldn't change.

**Do not escalate channels to get attention.** Two contacts on two channels about one ignored
question is the double-deviation pattern (§1.7), not persistence.

---

## 5. What to actually send — four steers

Written as guidance for a model, in the style of `deadLeadMessageHint` — not as templates. Each
would sit behind its own exported function and be selected by *facts already in the database*
(`quietOutcome`, last message direction, days quiet), never by a model's guess about which one
applies.

Constraints that apply to **all four**, and should be repeated in each rather than assumed:
never "just checking in" or "circling back"; never state a fact absent from the conversation (the
risk gate already enforces this); never introduce a second offer; never a discount unless the owner
configured one; at most one apology sentence; and always leave a one-line way out that costs them
nothing to take.

### Steer A — "The belated answer" (`COLD_UNANSWERED`, ≤ ~90 days, their question is answerable)

**Situation:** they wrote, nobody replied, and the thing they asked about is something this
business does and can still do.
**Reasoning:** this is the whole recommendation in one message — apology + remedy in a single act
(§1.2, §1.3), empathy-first because being ignored is a process failure (§1.4), one process-focused
explanation clause because this is a delayed recovery (§1.5), and no offer at all because the
motive has to stay unambiguous (§1.6).

> This person wrote to this business and **never got a reply**. That is the single most important
> fact about this message: it is not a follow-up, it is the reply they were owed, arriving about
> {days} days late.
>
> Make four things true, in this order, and nothing else.
> (1) It must be instantly obvious that **they** made contact first, in their own words — "you got
> in touch about…", "you asked whether…". They should recognise this within one line, with no
> moment of wondering who is writing.
> (2) **One** sentence acknowledging they never got an answer. Warm, direct, human — the warmth
> matters more than the wording, and far more than the length. No grovelling, no paragraph about
> our processes, no second apology later in the message. If you want a reason, one short clause
> about what happened ("it got buried in our inbox") is enough — a reason, never an excuse, and
> never a promise about how we've fixed things.
> (3) **Then actually answer what they asked.** This is the point of the whole message. Use the
> specifics in their own message and give them the most useful, most concrete answer available
> from what is in this conversation — a real answer to a real question, not a status update, not
> an invitation to a call as a substitute for answering. If the answer genuinely depends on
> something only they know, give as much of it as is possible and name the one thing you need.
> (4) One clear, easy question, and an explicit, no-cost way to say it's no longer needed.
>
> Do not offer anything they did not ask about. Do not mention any other product or service. Do
> not offer a discount. Do not ask them to re-explain what they wanted — it is in this thread, and
> asking them to repeat it is a second version of not having read it the first time.
>
> The whole thing should read like one person who just found this in their inbox, felt bad, and
> wrote back properly — because that is exactly what happened.

### Steer B — "The honest late answer" (`COLD_UNANSWERED`, ~90–180 days)

**Situation:** the same failure, months old. The need is probably resolved elsewhere.
**Reasoning:** the inverted-U (§4.1) says they expect less and think less of us, so the ask shrinks.
Pretending this is a normal follow-up at six months is the thing that reads as tone-deaf; naming
the elapsed time and the likely outcome is what makes it credible.

> Same situation as a belated reply, but it is roughly {days} days late — long enough that this
> almost certainly got sorted elsewhere, and the message must be written as though it did.
>
> Name the elapsed time plainly, once. One apology sentence, no more. Then say the honest thing
> out loud: that this is very likely long since handled, and that this is being sent anyway
> because leaving their question unanswered wasn't right. Still answer the question — briefly, in
> a line or two — because an apology with nothing attached to it is worth less than one with the
> answer attached, even a late answer.
>
> **Ask for less than a normal follow-up would.** Not a call, not a meeting, not a decision. One
> question they can answer in four words, or ignore with no cost. Make the exit explicit and
> genuinely easy: if it's handled, that's completely fine and they'll hear nothing further.
>
> No new offer. No discount. No urgency, no deadline, no scarcity of any kind — there is nothing
> urgent about a question we sat on for months, and manufacturing urgency here is the thing that
> turns a late apology into a sales tactic.

### Steer C — "The substitution" (the original request can't be fulfilled as asked)

**Situation:** the only case where a different service belongs in the *first* message. They asked
for something this business doesn't do, no longer does, can't do in their area, or can't do at
their budget or date. **This steer must be gated on the owner having said so** — on a real fact
(service not offered, out of area, date passed), not on a model's inference that they "might
qualify for something else."
**Reasoning:** §3c. Here the alternative *is* the answer, so it delivers justice rather than
extracting value; the substitution must match on the attribute that mattered to them (stockout
analogue), and offering one alternative rather than a menu keeps it a reply rather than a catalogue.

> This person asked about something this business **cannot provide as asked** — and then never got
> told that. The failure here is double: no answer, and the answer would have been no.
>
> Say the no first, plainly, before anything else of substance. Do not bury it, do not lead with
> the alternative, do not imply we can help with what they asked for. One apology sentence,
> covering the silence rather than the no — the no is nobody's fault; the silence is ours.
>
> Then offer **exactly one** alternative, and only the one supplied to you. Frame it as the
> nearest thing to what they asked for, and be specific about how it differs, including where it
> is worse. It must match on whatever mattered most in their original message — if they asked
> about price, the alternative is cheaper; if they asked about timing, it is faster; if they asked
> about scope, it is closer in scope. If the only alternative available is bigger, more expensive
> or further from what they wanted, **say the no and stop there** — no alternative at all is
> better than one that reads as an upsell attached to an apology.
>
> Close by making it completely costless to decline, and mean it: if it's not what they need, no
> follow-up is coming. Do not list other services. Do not ask for a call. Do not treat this as an
> opening.

### Steer D — "Closing the file" (nothing substantive to say, or this is the last message)

**Situation:** the question can't be answered from what's in the thread and the owner has nothing
to offer; or a reactivation message has already gone and gone unanswered. Purpose is to end it
cleanly and hand control back to the recipient.
**Reasoning:** repeated apologies were *worse than nothing* in the Uber experiment (§1.3, Grade A),
so the second message must not be another apology or another attempt. This also creates a defined
end state, which is what keeps the whole feature from becoming a nurture loop. **Explicitly not
the "breakup email" pressure tactic** — the vendor reply-rate claims behind that technique are
unverified (§1.8) and a deadline aimed at someone we ignored is coercive.

> This is the last message that will be sent about this. Its job is to end the thread cleanly, not
> to get a reply.
>
> Two or three sentences. Do not apologise again — it has already been said once and saying it
> twice makes it about us. State simply that since there's been no reply, their enquiry is being
> closed, that the door is open whenever they want it, and how to reopen it in one step.
>
> No deadline. No "last chance." No scarcity. No new offer, no discount, no alternative service.
> No question that requires an answer. They should finish reading and owe this business nothing.

### Steer E (negative) — do **not** apologise to a `COLD` lead

Not a message, a guard, and the most important item in this section. A lead who stopped replying
to *us* was not failed by us and is **not aware of any failure**. Apologising to them is the exact
condition under which apologies lower satisfaction, trust and repeat behaviour (§1.2, Grade A).
Their message is the existing reactivation framing — name the elapsed time, lead with something
concrete, no apology, no confession.

---

## 6. Where saying nothing is the right answer

In rough order of how clear-cut each is:

1. **They opted out.** Already enforced (`optedOutAt`). Nothing below overrides it.
2. **The thread is `CLOSED`, `OFF_PLATFORM`, or the owner set the stage to WON/LOST.** Already
   handled by `classifyQuietLeads`; this section exists so it stays handled.
3. **`UNCLEAR`.** If we cannot tell whether they were failed, we cannot tell whether an apology
   will land in the "aware" or the "unaware" condition — and the unaware condition is the one where
   it actively does harm (§1.2). Uncertainty resolves to silence.
4. **We still can't answer their question, and have nothing to offer instead.** An apology with no
   remedy is the weakest, most complaint-adjacent form (§2, §1.3). Steer D or nothing.
5. **Over ~6 months, in Canada, without explicit consent.** CASL implied consent from an inquiry
   has expired (§4.2). This should be a hard gate, not a nudge.
6. **The failure isn't one they'd notice.** A lead who got an answer in two days and then drifted
   was not ignored. Apologising creates the grievance (§1.2). This is Steer E.
7. **One reactivation message has already gone unanswered.** A second apology was *worse than
   nothing* in the largest field experiment available (§1.3). Steer D once, then stop.
8. **Time-bound inquiries whose date has passed** — an event, a specific property, a job start
   date — where we have nothing to substitute. The message can only remind them of something they
   lost partly because we didn't answer. **Inference, Grade C**, but the downside is obvious and
   the upside is nil.
9. **They already complained publicly or left a review.** That is a human's job. An AI-drafted
   apology to someone who has escalated is the double-deviation setup with an audience.
10. **The address has shown no activity for 6–12 months** and the send would go from the owner's
    own Gmail. The reputational risk lands on the owner's domain (§4.2), and it is theirs to accept
    knowingly, not ours to spend quietly.

**The honest framing for the product:** the number of quiet leads FollowUp *declines* to message is
a feature, and should be shown as one. "9 you never replied to · 4 we're not writing to, and why"
is a more trustworthy screen than a bigger number of drafts.

---

## 7. Code-verified observations (no changes made)

Read this session; stated as observations for the founder to decide on, not as fixes.

**7.1 The apology steer appears to be pointed at the wrong bucket.** In `src/lib/automation.ts`,
`deadIds` deliberately subtracts `unansweredIds` (line ~343), so a lead who is **both** cold and
unanswered gets the unanswered framing and `messageHint` is `undefined` (line ~512) — no steer at
all. Meanwhile `findUnansweredLeads` (line ~190) has **no upper age bound**: its only time filter
is "the newest message is inbound and older than the threshold." The effect, as far as I can read
it:

- A lead ignored for six months (last message inbound) lands in `unanswered`, is therefore excluded
  from `deadIds`, and is drafted **with no steer** — no elapsed-time instruction, no "you contacted
  us first" instruction, no apology instruction. **This is precisely the bucket the founder is
  asking about, and it is currently the one getting the least guidance.**
- `deadLeadMessageHint` — whose text instructs the model to "acknowledge honestly that they never
  got a proper reply" — therefore fires mainly for leads whose last message was **outbound**, i.e.
  the `COLD` case where we did reply and they didn't. For those, that sentence risks being
  factually wrong *and* is the documented apology-backfire condition (§1.2).

I have not traced every path and I'd want this confirmed by whoever owns `automation.ts` before
anyone acts on it. If it holds, the fix is to split the hint by last-message direction (the same
fact `reactivation.ts` already uses to split `COLD` from `COLD_UNANSWERED`) rather than by which
query won the merge, and to give the unanswered path Steers A/B by age.

**7.2 Age-aware steers.** Steers A and B differ only by elapsed time, which is already computed at
the call site.

**7.3 Cross-sell, if built at all, should be owner-supplied.** A per-lead owner action carrying an
explicit alternative (§3c, Steer C), never a model inferring that someone "might qualify" for
something. Serves Rule 3 — the guarantee is "FollowUp will never offer a customer something they
didn't ask about unless you told it what to offer and why." That is a statable, testable promise of
the kind Rule 3 asks for.

**7.4 A CASL age gate belongs on the back-catalogue consent screen.** The spec in
`research/product/2026-09-15-reactivation-consent-spec.md` buckets by outcome, not age. For a
Canadian business the 6-month line is a legal boundary, not a preference (§4.2). Worth raising with
whoever owns that screen — and worth a lawyer's read before it becomes a gate.

---

## 8. What I'm unsure about

- **Every finding here is abstract-level.** I have not read one full paper. A boundary condition I
  can't see in an abstract could change §3 in particular.
- **The cross-sell conclusion is derived, not tested.** No study I found tests cross-selling to an
  *ignored inquirer* specifically. The chain (justice → motive inference → matched remedy) is made
  of well-evidenced links, but it is a chain I assembled. **The cheapest way to settle it is a real
  A/B on one willing owner's own back catalogue** — Steer A vs. Steer A + one alternative — measured
  on reply rate and complaints, not deals. I'd trust 200 real sends over everything above.
- **The eBay/Uber tension (§1.3)** is resolved here by a mechanism I inferred ("apology plus a
  concrete thing"). Both are real field experiments pointing slightly different ways and I could be
  wrong about why.
- **The malpractice-apology analogy (§2)** is from a different domain with vastly different stakes.
  I've included it because it's the only hard evidence I found on "does apologising invite a
  claim," and flagged it as an analogy. Don't let it carry more weight than that.
- **No FollowUp data exists on this yet.** Everything here is desk research, consistent with the
  standing note in `PRODUCT_DIRECTION.md` that no primary owner interviews are on file. The
  interview guide at `research/customers/2026-09-15-owner-interview-guide.md` would be a good place
  to add one question: *"Have you ever gone back to someone you never answered? What happened?"*

---

## Sources

All checked **2026-09-15**. All read as search-result snippets, publisher abstracts or press
summaries — **not** full texts (`WebFetch` egress-blocked; confirmed against `www.msi.org`).

**Peer-reviewed / working papers**
- Matos, Henrique & Rossi (2007), "Service Recovery Paradox: A Meta-Analysis," *Journal of Service Research* — <https://journals.sagepub.com/doi/10.1177/1094670507303012>
- "Are Apologies Always the Best Policy? Apologies for Service Failures Backfire When Consumers Are Not Aware of the Failure," *Journal of Consumer Research*, doi 10.1093/jcr/ucaf064 — <https://academic.oup.com/jcr/advance-article-abstract/doi/10.1093/jcr/ucaf064/8364031>; press summary <https://phys.org/news/2026-03-customer-backfire.html>
- MSI Report 21-130, "An Argument for Withholding an Apology After Service Failure" — recap: <https://www.msi.org/research-recaps/when-should-you-apologize-for-a-service-failure/>
- Halperin, Ho, List & Muir (2019/2022), "Toward an Understanding of the Economics of Apologies," NBER WP 25676 / *The Economic Journal* 132(641) — <https://www.nber.org/papers/w25676>, <https://academic.oup.com/ej/article-abstract/132/641/273/6325164>
- Abeler, Calaki, Andree & Basek (2010), "The Power of Apology," *Economics Letters* — <https://www.sciencedirect.com/science/article/abs/pii/S0165176510000340>
- Roschk & Kaiser (2013), "The nature of an apology," *Marketing Letters* — <https://link.springer.com/article/10.1007/s11002-012-9218-x>
- Gelbrich & Roschk (2011), "A Meta-Analysis of Organizational Complaint Handling and Customer Responses," *JSR* — <https://journals.sagepub.com/doi/10.1177/1094670510387914>
- Joireman, Grégoire, Devezer & Tripp (2013), "When do customers offer firms a 'second chance' following a double deviation?" *Journal of Retailing* 89(3) — <https://www.sciencedirect.com/science/article/abs/pii/S0022435913000237>
- Becker, Spann & Barrot (2020), "Impact of Proactive Postsales Service and Cross-Selling Activities on Customer Churn and Service Calls," *JSR* 23(1) — <https://journals.sagepub.com/doi/abs/10.1177/1094670519883347>
- Kumar, Bhagwat & Zhang (2015), "Regaining 'Lost' Customers," *Journal of Marketing* 79(4) — <https://journals.sagepub.com/doi/10.1509/jm.14.0107>; summary <https://research.wpcarey.asu.edu/services-leadership/2015/08/07/what-you-need-to-know-about-customer-win-back/>
- "Unveiling the recovery time zone of tolerance," *JAMS* 45(6) (2017) — <https://link.springer.com/article/10.1007/s11747-017-0544-7>
- "Timing of apology after service failure," *Marketing Letters* (2020) — <https://link.springer.com/article/10.1007/s11002-020-09522-y>
- "Alleviating the negative impact of delayed recovery: process- versus outcome-focused explanations," *Journal of Services Marketing* — <https://www.emerald.com/insight/content/doi/10.1108/jsm-06-2012-0097/full/html>
- Suresh et al. (2022), "The Burden of Double Deviation in Services: A Systematic Review," *IJCS* — <https://onlinelibrary.wiley.com/doi/10.1111/ijcs.12836>
- "'Sorry, the product you ordered is out of stock': Effects of substitution policy in online grocery retailing" — <https://www.sciencedirect.com/science/article/pii/S002243592200046X>
- McMichael, Van Horn & Viscusi (2019), "'Sorry' Is Never Enough," 71 *Stanford Law Review* 341 — <https://www.stanfordlawreview.org/print/article/sorry-is-never-enough/>

**Regulatory / compliance**
- CRTC, CASL guidance on implied consent — <https://crtc.gc.ca/eng/com500/guide.htm>, <https://crtc.gc.ca/eng/com500/faq500.htm>
- Holland & Knight, "TCPA Reset: Fifth Circuit Rejects 'Prior Express Written Consent' Rule" (Mar 2026) — <https://www.hklaw.com/en/insights/publications/2026/03/tcpa-reset-fifth-circuit-rejects-prior-express-written-consent-rule>
- BCLP, "The TCPA's New Opt-Out Rules Take Effect on April 11, 2025" — <https://www.bclplaw.com/en-US/events-insights-news/the-tcpas-new-opt-out-rules-take-effect-on-april-11-2025-what-does-this-mean-for-businesses.html>

**Deliverability (Grade C — vendor documentation)**
- Mailgun, Gmail/Yahoo bulk sender requirements — <https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/>
- Validity, "What is a spam trap?" — <https://www.validity.com/blog/what-is-a-spam-trap/>

**Recorded as unverified — do not cite**
- Breakup-email reply-rate claims (76%, 33%) — <https://growleads.io/blog/breakup-email-templates-outbound-email-outreach/>, <https://www.mixmax.com/blog/breakup-email-templates-that-get-replies>
- Consumer non-response survey stats (78%, 89%, 64%) — <https://www.businesswire.com/news/home/20220610005375/en/>
- "More than 50% of companies fail to respond to leads" (InSellerate, 2015) — <https://www.globenewswire.com/news-release/2015/08/20/1033235/0/en/>
