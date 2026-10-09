# The hook: what makes a busy owner think "this is what I'm looking for" in the first screen

**Date:** 2026-10-09. **Asked by the founder:** *"Did we have any research about the strategy and the psychological play
around those users to hook them? … land them on the page, and they're like, 'Oh yeah, boom, this is what I'm looking
for. Let's just try this out.' … what to show, how to show it, how to convey the message, what psychological things
we need to play with, the colours: warm and cold, like how big companies are using them. … 'Try It Yourself': big
companies … make the user click on that option only."*

**The question, in one sentence:** what, in the first screen and the first ten seconds, turns a sceptical, time-poor
owner into someone who types a question into FollowUp, and what do we change on the home draft to get there?

**Read first, not repeated here:**
- `2026-09-26-conversion-strategies.md`: one goal, plain words, the first two screens, proof, demos, no fake urgency.
- `../ux-patterns/2026-10-07-psychology-attention-trust.md`: trust calibration, colour evidence, motion timing.
- `../ux-patterns/2026-10-03-laws-of-ux-applied.md`: Hick, Fitts, Jakob and the other named laws.
- `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md`: who the owner is and what they fear.

This file adds:
- the **first-ten-seconds** question;
- the **single-action** pattern big products use;
- an honest look at **warm and cool colour**;
- an **audit of the live draft**, with what was built.

**How sure this is:** grade B to C. These are web-search summaries of the original papers and vendor reports; direct
fetches were blocked from this machine. Each claim is marked high, medium or low.

---

## 1. In plain words

1. **People judge the page before they read it.** Visual appeal is judged in about 50 ms. That first impression colours
   how credible and usable the rest seems.
2. **One thing to do beats several.** Pages with one action convert better. Big AI products make the input box the
   hero: one box, a few example chips, nothing else asking for attention.
3. **The "aha" has to happen on screen.** Trying it only hooks people if they *see* the answer. On our draft, on a
   normal laptop, the answer appeared below the fold and the page didn't move. **That was the biggest leak. Fixed.**
4. **Ask for the sign-up at the peak, not at the end.** The moment FollowUp's reply appears is when the visitor
   believes it most. The "start free" line now shows then, beside the answer.
5. **Say what it is in one line, and that trying is free.** The headline names the pain. The visitor still needs one
   plain sentence about what FollowUp does, and to know that trying needs no sign-up.
6. **Typing their own question makes it theirs.** People value what they put effort into, and seeing the product work
   raises its perceived value. Both point at the same design: let them type, then show the work.
7. **Colour: contrast and meaning, not mood.** "Blue means trust" and "red means buy" are weak or unreplicated. What
   holds is that the one thing that looks different gets noticed, and that colour carries learned meanings. Our rule:
   warm for the cost of waiting, cool green for FollowUp's results, one solid edge for the one action.
8. **Loss versus gain wording barely matters on its own.** Across 165 studies, the two framings perform about the
   same. A loss-framed headline isn't magic; showing the loss as a concrete moment is what works.
9. **Never fake it.** No invented proof, no countdowns, no "3 spots left". Fake urgency lifts once, then costs trust.
   Trust is FollowUp's whole pitch.

---

## 2. The evidence

### 2.1 The first 50 milliseconds (high)
- **Lindgaard et al. (2006), *Behaviour & Information Technology*:** home pages flashed for 50 ms got appeal ratings
  that matched ratings after longer viewing. The authors tie this to a halo effect: a good first impression lifts
  perceived credibility and usability.
- **Kurosu & Kashimura; Tractinsky (aesthetic-usability):** good-looking interfaces are rated easier to use (see the
  2026-10-07 file).
- **For us:** the first frame must look calm, finished and uncluttered *before* anything moves. A busy first frame
  reads as "spammy tool" in 50 ms, and no copy recovers that.

### 2.2 One action; the input box as the hero (medium)
- **One goal vs many:** pages with one clear action convert better than pages with five or more (see the 2026-09-26
  file, 2.2).
- **Removing competing links:** vendor case studies report big lifts from removing navigation on landing pages:
  - Yuppiechef: 3% to 6%.
  - Minders: 9.2% to 17.6%.
  - HubSpot found the effect depends on the funnel: 0–4% at the top, 16–28% in the middle.
  - Self-interested sources, small samples. The direction is consistent.
- **The AI-product pattern:** Lovable-style home pages put one large prompt box in the centre, with a few example
  chips under it ("lower the blank-box barrier") and sign-up in the corner. No published A/B test was found showing
  the box beats a plain button. The pattern is widespread, the proof is thin.
- **Interactive demos:** Navattic's 2025 report (28,000 demos; vendor data) found:
  - ~70% of the top 1% are ungated;
  - ungated demos get ~10% more engagement;
  - top sites promote the demo in several places.
- **For us:** the try-it box is our prompt box. While it's on screen and untried, it should be the strongest thing
  there. The bar's "Start free" steps back to an outline, and the box gets the one solid green edge. After the first
  try, the bar's button is solid again. A returning or decided visitor can always still find it.

### 2.3 The aha moment must be seen (our own measurement, high)
- **Measured on the draft, 2026-10-09, 1440 × 900:** after typing a question in the first screen and pressing Send,
  FollowUp's answer was written into the demo card at **1,052–1,348 px**. The screen ends at 900 px, and the page
  didn't move.
- The "That's FollowUp … Connect Gmail, start free" line appeared only after the whole journey, about 12 s later and
  further down still. **The hook happened where nobody could see it.**
- **Fixed (v88):**
  - when their message lands in the demo, the page glides so the card sits mid-screen;
  - the start-free line appears as soon as the reply is written;
  - reduced motion jumps instead of gliding.

### 2.4 Effort and visible work raise value (medium-high)
- **IKEA effect (Norton, Mochon & Ariely, 2012):** people value what they made themselves more highly, but only if
  they finish it.
- **Labor illusion (Buell & Norton, 2011, *Management Science*, 5 experiments):** people valued a service more when
  they could see it working, even preferring a slower result that showed its work. The effect amplifies a good
  outcome; it does not rescue a bad one.
- **For us:**
  - the visitor's own question, answered visibly ("Writing in your words", then "Sent") is the strongest proof we
    have;
  - the chips must lead to a *finished* answer (the IKEA effect needs completion);
  - the answer has to be good. Visible work only amplifies quality.

### 2.5 Small first steps (low-medium)
- **Foot-in-the-door:** meta-analysis puts the effect at r ≈ .17, small; a direct replication found nothing.
- **For us:** don't build a funnel of tiny asks. One honest step (try it, no sign-up) followed by one clear offer is
  enough.

### 2.6 Framing: loss vs gain (high, and it says "it hardly matters")
- **O'Keefe & Jensen meta-analyses:**
  - 165 studies: average difference r = .02, not significant;
  - detection messages: a tiny loss-frame edge (r = −.04);
  - prevention messages: a tiny gain-frame edge (r = .03).
- **For us:** "Never lose a lead" is fine, but the wording isn't what persuades. A concrete scene does it: 7:03 AM
  answered against "Thanks, already got someone". Keep the pain as a moment, not a slogan.

### 2.7 Colour: warm, cool and what big companies actually do (low-medium)
- **Warm advances, cool recedes:** a real but modest perceptual tendency, governed by hue *and* lightness, and it
  varies between people.
- **"Blue = trust":** one small online experiment (216 people) found darker blue raised trust and booking intent; the
  literature is mixed and no meta-analysis was found.
- **Red/green button tests:** these measure contrast with the page, not the hue.
- **Isolation (von Restorff):** a solid memory effect; applied to buttons it is a sound principle without direct
  conversion trials.
- **What big products do (seen in our teardowns):**
  - Linear, Superhuman and Macro are near-monochrome, with colour only around the product.
  - Wispr uses one button colour.
  - Stripe keeps the brand gradient for decoration and the button plain.
  - The pattern is *restraint plus one isolated accent for the action*, not warm-for-CTA or cool-for-trust.
- **Our rule (built):**
  - **Warm (amber → red)** marks the cost of waiting: the businesses that never answered, the late reply, "already
    got someone".
  - **Cool green** marks what FollowUp gets you: the strip, the 1-minute reply, booked, won.
  - **One action accent:** the try box's solid green edge on the light page; ink buttons on light, lime on dark.
  - **No glows or halos (R-036):** the edge is flat. A first attempt with a soft pulsing ring was removed before
    publishing.

### 2.8 Specific beats vague; plain beats clever (high)
- **Grade 5–7 reading level:** 12.9% conversion against 2.1% for professional copy (Unbounce, ~41,000 pages).
- **Specific claims** ("in about a minute", "26% never answered") read as checkable, and so as more credible.
- **For us:** every claim stays specific and true. "In about a minute" matches the product's target of a minute or
  two (PRODUCT_DIRECTION).

---

## 3. Audit of the home draft (v87), and what v88 changed

| Question a visitor has in 10 s | Before | After (v88) |
|---|---|---|
| What is this? | Headline names the pain; nothing says what FollowUp *does* | The try label says it: "FollowUp answers in about a minute, in your words." |
| Is it for me? | Mixed chips (2-bed, car detail, leaking tap) ✓ | Unchanged ✓ |
| What do I do? | Try box *and* a solid "Start free" in the bar competed | Bar button is an outline until they try; the try box has the one solid green edge |
| What does it cost to try? | Not said near the box | "Try it yourself · no sign-up" |
| Does it work? | Answer appeared below the fold, unseen | Page glides to the answer; start-free line appears with it |
| Why should I care? | Pain numbers highlighted in green (the colour of the solution) | Pain numbers in warm amber; FollowUp's results stay green |
| Can I trust it? | Free in beta, no card; control section further down ✓ | Unchanged; real testimonials still missing (to collect, never invent) |

**Not changed, and why:**
- The strip and the headline stay (approved A-175, A-182).
- The floating messages stay (A-179).
- No testimonials, logos or counts: none are real yet.
- No exit popups or timers.

## 4. Still open (founder decisions)

1. **Real proof:** two or three beta owners, one sentence each, first name and trade, with permission.
2. **Analytics** to measure "tried it", "started free" and how far people scroll. Without it, every change here is
   evidence-informed, not measured.
3. **A 5-second test** with five owners: show the first screen for 5 s, then ask "what does this do, and who is it
   for?"

## Sources (web-search summaries, 2026-10-09)

- Lindgaard et al. 2006: nature.com/news/2006/060109/full/news060109-13.html; old.websiteoptimization.com/speed/tweak/blink
- Navigation removal case studies: vwo.com/blog/a-b-testing-case-study-navigation-menu; blog.hubspot.com/marketing/landing-page-navigation-ht;
  conversionxl.com/use-navigation-landing-pages-data-driven-consideration
- Prompt-box hero pattern: contra.com/p/XFMqBXP3-lovable-homepage-clone-template; enter.converge.ai (minimal AI prompt hero)
- Navattic, State of the Interactive Product Demo 2025: navattic.com/report/state-of-the-interactive-product-demo-2025
- Buell & Norton 2011, The Labor Illusion: ideas.repec.org/a/inm/ormnsc/v57y2011i9p1564-1579.html
- Norton, Mochon & Ariely, The IKEA Effect: papers.ssrn.com/abstract=1777100; en.wikipedia.org/wiki/IKEA_effect
- Foot-in-the-door meta-analysis and replication: journals.sagepub.com/doi/10.1177/0146167283092002; sage.figshare.com (Poland/Ukraine replication)
- O'Keefe & Jensen framing meta-analyses: cbsm.com/articles/33455; scholars.cityu.edu.hk (relative effectiveness of gain/loss framing)
- Warm/cool and chromostereopsis: en.wikipedia.org/wiki/Chromostereopsis; psy.ritsumei.ac.jp/akitaoka (Kitaoka 2015)
- Blue and trust online: research.tilburguniversity.edu ("Colour in online advertising: going for trust, which blue is a must?")
- Von Restorff and CTAs (principle, no trials found): marketcurve.substack.com/p/contrast-in-context-the-von-restorff
- Unbounce reading-level benchmark: see the 2026-09-26 file
