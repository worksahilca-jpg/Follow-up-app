# Lead qualification: how FollowUp should qualify accurately, from first message to booked

**Date:** 2026-10-09. **Asked by the founder (chat):** *"we have to make the qualification process so accurate… We'll
be creating the funnel to qualify the leads that the business owner wants… We can't make any mistakes in qualifying
the leads, so we have to train the model. I don't know what strategy we'll be using, so we're going to do proper
research about the market."*

**The question, in one sentence:** how do the products already doing this qualify leads, what makes qualification
accurate, and what should FollowUp build so the owner only gets leads that are genuinely ready, without losing good
ones?

**Builds on (read first, not repeated):**
- `research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`: the intent signals (a specific
  item, a timeline, money-readiness, a concrete time slot) and "answer first, then one question".
- `research/product/2026-09-13-scoring-and-drafting-accuracy.md`: how today's scorer works and where it errs.
- `research/product/2026-09-09-followup-cadence-best-practices.md`: check-in timing.
- `research/competitors/2026-10-07-gohighlevel.md`.

**How sure this is:** medium at best. Web-search summaries only; direct page fetches are blocked from this machine. No
vendor publishes measured qualification accuracy; every accuracy number found is the vendor's own marketing. The
accuracy *method* (section 4) comes from extraction research, not from lead-qualification studies.

---

## 1. The funnel, in the founder's words (now in PRODUCT_DIRECTION)

1. Leads come in.
2. Catch the right one: is it even a lead?
3. Reply the way the owner would: their voice, their tone.
4. Start qualifying.
5. Qualify accurately; if they go quiet, follow up again and again.
6. Hand the hot lead to the owner to close.
7. Reach the endpoint: a booked call, meeting or visit.

**What exists today:**
- Steps 1, 2 and 3 are largely built: capture from every channel, newsletter and real-person filtering, drafts in the
  owner's words and facts.
- Step 5's cadence is built: days 3, 7, 14 and 30, stopping on a reply or a no.
- Steps 4 and 6 are the gap. There is a 0–100 intent score, but no qualification card, no owner-defined criteria and no
  hand-over rule.
- Step 7 is partial: there is a booking link, but booking isn't treated as the goal state.

## 2. What the market does

| Product | Who it's for | How it qualifies | Hand-over | Notes |
|---|---|---|---|---|
| **Structurely** ("Aisa Holmes") | Real estate | Two-way SMS/email on timeline, budget, financing, current address; long nurture (12+ months) | Live phone transfer of "agent-ready" leads; escalates "derailing" conversations to a human | ~$499/mo plus setup; claims a 14–31% qualification rate (vendor) |
| **Verse** | Real estate, homebuilders, home services | SMS scripts per business; criteria like credit score, budget, timeline | Live transfer to the business; dashboard of disqualification reasons and chat history | AI plus **human concierges** checking quality; reviewers say some answers are weak |
| **Qualified (Piper)** | B2B websites | Customer-set rules; booking is gated until the required questions are answered; only high-fit buyers are offered a meeting | Books straight onto the right rep's calendar | Rules are the customer's, not the AI's |
| **GoHighLevel Conversation AI** | Agencies, small businesses | Knowledge base plus "intent-based" checks before offering calendar slots | Books into the calendar | Users say it "gets creative" with information; needs review early |
| **Podium AI Employee** | Local businesses | Little public detail | — | ~$399/mo, 12-month contracts (comparison sites) |

**The pattern:**
- The **business sets the criteria**; the AI follows them.
- **Booking is the finish line.**
- **A human is in the loop**, either live transfer or human checkers (Verse).
- **Nobody publishes their error rate.**

There's room for FollowUp to be the one that is honest about accuracy and lets the owner see why each lead was
called hot.

## 3. How good qualification conversations work

**Frameworks:**
- **BANT** (Budget, Authority, Need, Timing) is the simplest, suited to short small-business sales.
- **CHAMP** leads with the customer's challenge.
- **ANUM** leads with authority.
- **LPMAMA** is real estate's version: Location, Price, Motivation, Agent (already with one?), Mortgage
  (pre-approved?), Appointment.

Every source treats these as a **conversation guide, not a form**.

**The craft (consistent across sources, practitioner-level evidence):**
- **Answer their question first, then ask one question.** Never stack several. A list of questions reads as a bot
  and gets ignored.
- **Spread the criteria over several turns**, letting each answer shape the next.
- **Adapt to the answer.** "Six months out" means nurture, not a pushed viewing.
- **Frame questions as help** ("which of these fits you best?"), not screening ("what's your budget?").
- **Ask about their goals, not your criteria.**
- **Keep the set short:** 3–5 things per business type.
- **Don't punish a non-fit.** Move them to a slower nurture and keep the door open.
- **The AI must be able to answer the questions people actually ask** (HOA fees, service area, price ranges). Failing
  there kills trust faster than anything. FollowUp's facts are the basis.

## 4. What makes it accurate (the method)

No source gives a lead-qualification accuracy method directly. This is adapted from extraction research.

1. **Qualify field by field, with evidence.** Each criterion (need, timing, budget, location, decision-maker,
   readiness) is filled only from something the customer actually said, stored with the quote. Nothing is guessed: no
   quote means "unknown". This is checkable and explainable ("Hot because: 'pre-approved up to 650', 'moving in
   March'").
2. **The owner defines "hot".** At setup, pick a template (realtor, trades, salon, consultant…) and adjust: which
   criteria matter, which are must-haves, and what disqualifies. Piper, Verse and GoHighLevel all do this; it's also
   what makes it the *owner's* funnel.
3. **Don't trust the model's own confidence.** Research finds an LLM's self-reported confidence separates right from
   wrong poorly. Measure accuracy on real labelled conversations and set thresholds from that.
4. **A golden set.** Label 200–300 real beta conversations (hot / warm / not a lead / not ready), with two people on a
   subset to check agreement. Report precision and recall per field and for the final hot/not call. Re-run it on every
   prompt or model change.
5. **Two review streams in production:**
   - every low-confidence call goes to the owner as "Not sure: check this one";
   - a random sample of confident calls is audited, so we know the accuracy where nobody is looking.
6. **One-tap owner feedback** on every hand-over: "Was this lead actually hot?" Yes/No. This is the training signal and
   the live accuracy measure.
7. **Bias the mistakes the right way:**
   - A false "not hot" loses a sale: the worst error.
   - A false "hot" wastes a few minutes of the owner's time.
   - So when unsure, hand it over labelled "unsure"; never quietly drop a lead.
   - Never auto-disqualify without the owner seeing it.

**"Train the model": my recommendation is not to fine-tune yet.**
- Start with owner-defined criteria, structured evidence fields, the facts we already learn, and the golden set.
- Fine-tuning only pays off with thousands of labelled conversations; the one-tap feedback in point 6 is how we collect
  them.
- This also matches the promise on the Security page: customer data is not used to train AI models. Any fine-tuning
  later would need its own consent and wording, which is a founder decision.

## 5. What FollowUp would build, step by step (each needs the founder's OK; draw first)

| Step | Build | Size |
|---|---|---|
| 2. Is it a lead? | Measure the existing filter on the golden set; add a "Not a lead? Undo" tap | S |
| 4. Qualify | **The qualification card:** 3–5 criteria per business from a niche template, each *unknown / answered* with the customer's quote; drafts ask for the next unknown criterion, one question at a time, after answering | L |
| 5. Follow up | Check-ins (3/7/14/30) ask for the missing criterion instead of a plain "checking in"; a timing strategy per lead (see `website-promises-to-build.md` #1) | M |
| 6. Hand over | A **hot-lead rule** from the owner's must-haves; the owner gets the card ("Hot because…") plus one-tap "Was it hot?" | M |
| 7. Book | Booking is the goal state: once hot, the next message offers times or the owner's booking link; "Booked" and "Closed, confirmed by you" | M |
| Accuracy | The golden set plus a weekly accuracy report (precision/recall of "hot"), and random audits | M |

**Recommended first step:** the qualification card for **one niche (realtors, LPMAMA)**, with the golden set built from
beta conversations at the same time. That gives one complete funnel to measure before widening to trades, salons and
consultants.

## Sources (web-search summaries, 2026-10-09)

- Structurely: aitoolsbakery.com/blog/structurely-review; aiforproptech.com/companies/structurely
- Verse: verse.ai/industries/real-estate; verse.ai/appointment-setting; getapp.com (Verse.ai reviews)
- Qualified Piper: qualified.com/ai-sdr; qualified.com/plus/articles/piperx-faq; salesforce.com (agentic presales, Qualified)
- GoHighLevel / Podium: ghlscaleup.com/blog/gohighlevel-ai-employee; contractortoolstack.com/compare/gohighlevel-vs-podium
- LPMAMA: theclose.com/lpmama; help.sierrainteractive.com (LPMAMA framework)
- BANT / CHAMP / ANUM: copper.com/resources/lead-qualification-frameworks; squadstack.com/blog/useful-lead-qualification-frameworks-compared
- Conversational qualification practice: spurnow.com/en/blogs/ai-chatbot-for-real-estate-lead-qualification; orbitforms.ai/blog/best-lead-qualification-questions; chatfuel.com/docs (lead qualification questions and logic)
- Accuracy method: llamaindex.ai/blog/what-makes-an-extraction-confidence-score-useful; arxiv.org/pdf/2603.18014; arxiv.org/pdf/2602.00052; docs.agno.com (human routing and eval)
