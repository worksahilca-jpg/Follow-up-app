# What actually raises a landing page's conversion rate, and where FollowUp's page stands

**Date:** 2026-09-26. **Asked by the founder:** "do a deep research about all the strategies
that are used to make the landing page for the best conversion rate."
**Status:** research only. Nothing in the code or the Figma file changed.

**The question, in one sentence:** which landing-page strategies have evidence that they raise
the share of visitors who take the next step, and which of them is FollowUp's page missing?

**Read first, not repeated here:** `followup/research/product/2026-09-13-landing-page-research.md`
(what each section is for), `2026-09-14-landing-page-company-strategy.md` (how named companies
pitch), `research/landing-page/2026-09-18-structure-v1.md` (the page order, approved as A-015),
`2026-09-25-hero-3d-research.md` (the hero picture), and `decisions/rejected.md`, all of it. This
file adds the part those don't cover: **evidence about conversion**, and a scorecard of our page.

**How sure this is.** Every direct page fetch was blocked in this session (unbounce.com and
others refused). Every number below comes from **web-search summaries**, so the source's own
wording is what was read, not the full study. Confidence is marked on each claim:
- **High:** a large, named, repeatable study (Google/Deloitte, Nielsen Norman Group, Unbounce's 41,000-page benchmark).
- **Medium:** a vendor's own dataset, big but self-interested.
- **Low:** a blog that repeats a number without showing the study. These are listed so they are not re-researched, not so they get quoted.

Our own page was measured directly: the live page rendered locally on 2026-09-26, its text
counted from the Figma import.

---

## 1. In plain words

1. **We can't see our own conversion rate.** The site has no analytics at all. Every other
   point here is a guess until that changes. This is the first fix.
2. **Right now, strangers can't convert at all, on purpose.** Every button says "Start free",
   but sign-in only lets in people Sahil added (R-012, private beta). That is a founder
   decision, not a mistake. It does mean the page's real job today is to make people *want* it
   and email us, not to sign them up.
3. **One goal, repeated, beats several goals.** Our page already does this: every button is
   "Start free". Keep it.
4. **Plain words convert.** Pages written at a 5th–7th-grade reading level do far better than
   professional-sounding ones. Ours reads at about grade 5. Keep it.
5. **Most attention is in the first two screens.** Our page is almost 10 screens long. The
   first two have to make the whole case on their own.
6. **Proof sells, and we have none yet.** It must never be faked (a standing rule). It can be
   earned from the beta testers as soon as they use it.
7. **Showing the product doing the job beats an abstract picture.** For us that means a real
   message and the reply FollowUp wrote for it, not a dashboard (dashboard heroes were rejected, R-005/R-009).
8. **Fewer steps, less worry.** Google sign-in is already one click, and "no card" already sits
   under the button. The remaining worry is "what will it do with my inbox?", and that answer
   should sit next to the button.
9. **Speed is conversion.** 0.1 seconds faster measurably raised conversions in Google's study.
   Any 3D or motion in the new hero must never slow the first screen.
10. **Don't fake urgency.** Countdown timers and "only 3 spots left" lift conversion briefly,
    then destroy trust. They are also against FollowUp's brand (principles 2 and 7).

---

## 2. The strategies, strongest evidence first

Each one gets four answers: **what it is**, **the evidence**, **what our page does today**, and
**what to do**.

### 2.1 Measure before you change anything
- **What it is:** track visits, button clicks and sign-ins, so a change can be judged.
- **Evidence:** not a study; it's the precondition for every study below. Without numbers,
  "better" is opinion.
- **Our page today:** **no analytics on the site** (no Vercel Analytics, no Google Analytics, no
  PostHog; checked `package.json` and `layout.tsx`).
- **Do:** add privacy-friendly page analytics (Vercel Web Analytics, which our host already
  supports) and count three events: "Start free" clicked, sign-in reached, sign-in succeeded.
  **Needs the founder's OK:** it's a new dependency, and it touches privacy copy.

### 2.2 One goal on the page, repeated at every scroll depth
- **Evidence (medium):** pages with one clear action convert at about 13.5%, against about 10.5%
  for pages with five or more competing actions, across Unbounce-style datasets. The finding
  that holds everywhere is the distinction: *one goal repeated* reinforces, *several different
  goals* confuse.
- **Our page today:** ✅ every button is "Start free", 7 of them at different depths. The only
  other link is "Sign in" in the top bar, which is fine for returning users.
- **Do:** keep it. Don't add "Book a demo" or "Watch video" as second goals.

### 2.3 Plain words, at a grade-5 to grade-7 reading level
- **Evidence (high, Unbounce benchmark of ~41,000 pages):** pages written at a 5th–7th-grade
  level converted at **12.9%**, professional-level copy at **2.1%**. Pages of **250–725 words**
  did best, with few "hard" (3+ syllable) words.
- **Our page today:** about **grade 4.7**, 1,286 words, 106 hard words, measured 2026-09-26.
  Reading level ✅. Length is about twice the best band.
- **Do:** don't cut words for the sake of it. That word band comes mostly from single-offer
  pages fed by ads, and ours is also the home page. But see 2.4: the first two screens must
  work on their own.

### 2.4 The case has to be made in the first two screens
- **Evidence (high, Nielsen Norman Group eyetracking):** **57%** of viewing time is spent above
  the fold, and **74%** in the first two screenfuls. The drop after the fold was the same in
  2018 as in 2010.
- **Our page today:** 9.6 screens long at desktop. Screen 1 has the headline, buyer line,
  button and diagram. Screen 2 has "The gap" question. What it does, how, what it costs and
  why to trust it only arrive on screens 3–8.
- **Do (design, in Figma):** make screens 1–2 answer the four questions a visitor has: *what is
  it, is it for me, does it work, what does it cost / what's the catch.* Right now "what's the
  catch" (free, no card, nothing sends without you) is a small grey line under the button. It
  deserves to be read.

### 2.5 Speed
- **Evidence (high, Google and Deloitte, "Milliseconds Make Millions", 37 brands):** mobile
  sites made **0.1 s faster** saw conversions rise **8.4% (retail)** and **10.1% (travel)**. Lead
  generation was in the study, but the summary numbers read were retail and travel. Separately
  (medium): bounce probability rises about 32% as load time goes from 1 s to 3 s.
- **Our page today:** not measured yet. The page is a Next.js server render, which is a good start.
- **Do:** measure it (part of 2.1). Rule for the redesign: the headline and button render first,
  and 3D or motion loads after them. This matches the hero research.

### 2.6 Social proof: real people, next to the button
- **Evidence (medium to low):** vendor datasets report lifts from about 10% to 70% for adding
  reviews or testimonials. TrustRadius reports about +30% on average after adding its review
  widget; Matillion and Veeam report about +70% each. One claim says a testimonial *next to the
  CTA* lifted conversion 68%. That is low confidence (a single, unverified figure), but the
  principle is well-worn: proof works best where the decision happens.
- **Our page today:** ❌ no testimonials, no logos, no real numbers. That's correct: nothing real
  exists yet, and fake proof is banned outright (brand principle 1 and the standing exclusions
  in A-010).
- **Do:**
  1. When a beta tester has used it for a week, ask for one sentence and permission to use their
     first name, trade and city.
  2. Until then, the honest substitutes are:
     - the founder's own line (who built it and why);
     - the four promises section, which already acts as proof;
     - specific, true product facts ("replies in the customer's language").
  3. **Never** invent a quote, a logo or a count.

### 2.7 Show the product doing the job
- **Evidence (low: blog claims that product-forward heroes convert about 35% better; medium:
  the general agreement across SaaS teardowns):** visitors want to see what they'd actually get.
- **Our page today:** the hero is the flow diagram (A-012). The founder called it flat and too
  big (R-014) but kept the concept. The product itself appears on screen 5 as mock cards.
- **Conflict, stated plainly:** a dashboard screenshot hero was **rejected twice** (R-005, R-009).
  So "put the app screenshot in the hero" is off the table.
- **Do:** show the *job*, not the app: one real-looking customer message and the reply
  FollowUp wrote for it, with "Reply ready · 1 min". That is direction D2 ("the deck") or D3
  ("the pocket") in the hero research, and it is fully compatible with R-005/R-009.

### 2.8 Let people try it without signing up (an interactive demo)
- **Evidence (medium, Navattic's report on ~40,000 demos; the vendor sells demos):** teams
  reported about a **20–25%** lift in website conversion. Ungated demos engaged slightly more
  than gated ones, and demos placed in the top bar or first screen were clicked most.
- **Our page today:** ❌ none.
- **FollowUp-shaped version:** "Paste a message a customer sent you" → FollowUp shows the reply
  it would write, in their language. It proves the one thing a visitor doubts ("will it sound
  like me?") in 10 seconds.
- **Do: founder decision.** It changes product behaviour: it costs AI money per try and needs
  abuse limits. It doesn't break R-012, because it's not a sign-up or a capture, but ask first.

### 2.9 Fewer steps to get in
- **Evidence (medium):** social sign-in is reported to lift sign-up by roughly 20–60%. Reddit's
  published Google case study reports close to 2× new sign-ups with Sign in with Google plus
  One Tap.
- **Our page today:** ✅ sign-in is Google only, one click. The friction that matters is the
  private-beta gate (R-012), which is deliberate.
- **Do:** nothing on the page. When the founder opens the beta, this is already the right shape.
  Until then, make the blocked sign-in screen as warm and easy as possible (see 3.2).

### 2.10 Remove the worry: risk reversal and anxiety
- **Evidence (medium):**
  - MECLABS' conversion heuristic, from years of their own tests, puts it as C = 4m + 3v + 2(i−f) − 2a.
    It's a checklist, not maths: motivation, clear value, incentive, minus friction, minus **anxiety**.
  - Guarantee tests report about **+21–22%** with low refund rates. Those were consumer
    purchases, so the transfer to us is partial.
  - In B2B, the risk is the buyer's reputation as well as their money.
- **Our page today:** "Free while in beta. No card. It follows up for you — nothing sends
  without your OK." ✅ right words, but set in small grey text. The FAQ also answers "Will it
  send things I did not approve?" and "Is my data safe?".
- **Do (design):** the owner's biggest worry is "*what will this do to my inbox and my
  customers?*" Put the answer next to the button, in readable type: nothing sends without you,
  you can delete everything, and it stops when they reply. Once paid plans exist, add "cancel
  any time" there too.

### 2.11 Match the page to where the visitor came from
- **Evidence (medium):** Unbounce reports that strong ad-to-page message match converts at
  about 2.5–3× weak match. Agencies report 50%+ lifts from moving ad traffic off a generic
  home page onto a dedicated page.
- **Our page today:** one page for everyone. Fine while there are no ads.
- **Do: later.** The day ads or outreach run, give each audience its own page ("for
  plumbers", "for realtors", "for clinics") with the same structure and their own examples.
  The design system should make this cheap: one template, swapped words and examples.

### 2.12 Design for the phone first
- **Evidence:** worldwide web traffic is about **54% mobile** (medium). One claim puts landing
  pages at about **83% mobile** (low). Desktop still converts a little better per visitor.
- **Our page today:** responsive. The Figma copy so far is desktop only.
- **Do (design):** our buyer opens FollowUp "between jobs, on a phone" (brand principle 4).
  Design each section at 390 px wide first, then desktop.

### 2.13 Fake urgency and pressure tricks: don't
- **Evidence (medium):**
  - The OECD found at least one manipulative pattern on most sites it checked.
  - About 40% of countdown timers checked on 393 shopping sites were fake.
  - Merchants caught using fake scarcity reported repeat-purchase drops of 20–40%.
  - Honest urgency stops working once fake urgency has been seen.
- **Do:** no timers, no fake scarcity, no exit popups, no "only today" (brand principles 2 and 7).
  The one true urgency we have is the customer's own: "*a lead that waits an hour goes cold*".
  It belongs in the copy, not in a timer.

### 2.14 Button wording: first person
- **Evidence (low to medium):** a single, famous 2013 test (ContentVerve) found that "Start
  **my** free 30-day trial" got 90% more clicks than "Start **your** …". It's widely quoted.
  The claim that it was later reproduced couldn't be verified from here.
- **Do:** a cheap thing to test once we have analytics. "Start free" is fine until then.

### 2.15 How to test with little traffic
- **Evidence (medium, several testing vendors):** A/B tests need enough conversions to detect
  a change. Small sites should only test **big** changes, and should get most of their learning
  from **5-person qualitative tests**.
- **Do:**
  1. The 5-second test: show the first screen for 5 seconds to five business owners, then ask
     "what does this do, and who is it for?". Run it on the new hero before we build it.
  2. Once analytics exist, test only big swings, for example hero D2 against D3.

---

## 3. Scorecard: our page against the evidence

| Strategy | Evidence | Our page today | Action | Who / when |
|---|---|---|---|---|
| Measure conversion | precondition | ❌ no analytics | Add page analytics + 3 events | Founder OK (new dependency) |
| One goal, repeated | medium | ✅ "Start free" ×7 | Keep | — |
| Plain words (grade 5–7) | high | ✅ ~grade 4.7 | Keep | — |
| Case made in first 2 screens | high | ⚠️ price, trust and "the catch" arrive late | Redesign screens 1–2 | Figma, now |
| Speed | high | ? not measured | Measure; 3D never blocks first paint | Code, later |
| Real social proof | medium–low | ❌ none (correctly) | Collect tester quotes with permission | Founder: ask testers |
| Show the job, not a picture | low–medium | ⚠️ abstract diagram | Hero D2/D3: message → reply | Figma, now |
| Try it without signing up | medium | ❌ none | "Paste a message" demo | Founder decision |
| One-click sign-in | medium | ✅ Google only | Keep | — |
| Worry answered by the button | medium | ⚠️ right words, small grey type | Make the promise readable at the button | Figma, now |
| Page per audience | medium | one page | Later, when ads run | Later |
| Phone first | medium | responsive; Figma desktop only | Design 390 px first | Figma, now |
| No fake urgency | medium | ✅ none | Keep it that way | — |

### 3.1 The one thing that outranks all of this
Because of R-012, a stranger clicking "Start free" today lands on "FollowUp is in a private beta.
Sign in with the Google account Sahil added." No page change can make that convert. It's
**intentional**, and it's recorded here so nobody "fixes" it without the founder. When the
beta opens, the page is already set up for it: one goal, one-click sign-in, no card.

### 3.2 A small improvement that respects R-012
While the beta is closed, the only way in is emailing contact@followupbase.io. Make that
one tap: a pre-filled email link ("Hi Sahil, I run a ___ business and I'd like to try
FollowUp"), shown on the blocked sign-in screen. It isn't a form, a waitlist or a capture, so
it stays inside R-012's line. **Still ask the founder**, since R-012 is his rule.

---

## 4. Recommended order

**In Figma, now (design work, the founder directs):**
1. **Hero:** show the job (message → reply) at under half the first screen. Headline and button
   first. Direction D2 or D3.
2. **Screens 1–2:** answer what it is, who it's for, and what the catch is. Move the promise
   ("nothing sends without your OK · no card · delete everything any time") up to the button,
   in readable type.
3. **Every section at 390 px first,** then desktop.
4. **Keep:** one "Start free" goal, plain words, prices on the page, the four promises and the FAQ.

**Founder decisions (one short question each):**
5. Add privacy-friendly analytics (Vercel Web Analytics)?
6. Build the "paste a customer message, see the reply" demo?
7. Ask two or three beta testers for a one-line quote with their first name and trade?
8. Add a pre-filled "email Sahil" link on the private-beta sign-in screen?

**Later:** a page per audience once ads run; A/B tests once there's traffic; a
first-person button wording test.

## 5. What I would not do, and why

- **Invented testimonials, logos or counts.** Banned. They also cost more trust than they gain.
- **Countdown timers, "limited spots", exit-intent popups, chat bubbles that pop up.** These are
  pressure, and FollowUp promises calm (principle 2). The evidence says the lift doesn't last.
- **A second call to action** ("Book a demo", "Watch the video"). Two goals convert worse than one.
- **A dashboard screenshot as the hero.** Rejected twice (R-005, R-009). The job can be shown
  without the app.
- **Cutting the page to 700 words to hit a benchmark.** That number comes from ad-fed
  single-offer pages. The fix is making the first two screens complete, not deleting the
  answers further down.

---

## Sources (all read via web-search summaries on 2026-09-26; direct fetches were blocked)

- Unbounce, Conversion Benchmark Report (reading level, word count, SaaS median 3.8%, all-industry 6.6%): https://unbounce.com/conversion-benchmark-report/ · https://unbounce.com/conversion-benchmark-report/saas-conversion-rate/ · https://unbounce.com/landing-pages/whats-a-good-conversion-rate/
- Single vs multiple CTAs: https://www.apexure.com/blog/landing-page-call-to-action-button-tips · https://unbounce.com/conversion-rate-optimization/landing-page-cta-placement/
- Google & Deloitte, "Milliseconds Make Millions": https://www.thinkwithgoogle.com/_qs/documents/9757/Milliseconds_Make_Millions_report_hQYAbZJ.pdf · https://www.deloitte.com/ie/en/services/consulting/research/milliseconds-make-millions.html
- Nielsen Norman Group, "Scrolling and Attention": https://www.nngroup.com/articles/scrolling-and-attention/
- Trial models (opt-in vs opt-out): https://www.klipfolio.com/kpis/saas/trial-conversion-rate · https://userpilot.com/blog/saas-average-conversion-rate/
- Social proof lifts (vendor data): https://www.custify.com/blog/social-proof-b2b-saas/ · https://genesysgrowth.com/blog/social-proof-conversion-stats-for-marketing-leaders
- Message match: https://disruptiveadvertising.com/blog/landing-pages/message-match/ · https://www.webtonic.io/blog/message-match
- Navattic, State of the Interactive Product Demo 2026: https://www.navattic.com/report/state-of-the-interactive-product-demo-2026
- Social sign-in: https://developers.google.com/identity/sign-in/case-studies/reddit · https://www.corbado.com/blog/social-login-conversion-rate
- Testing with low traffic: https://www.convert.com/blog/a-b-testing/i-dont-have-enough-traffic-to-a-b-test-now-what/
- Dark patterns and fake urgency: https://arxiv.org/pdf/1907.07032 · https://www.eleken.co/blog-posts/dark-patterns-examples
- First-person button copy (ContentVerve): https://disruptiveadvertising.com/blog/landing-pages/effective-ctas/
- MECLABS conversion heuristic: https://marketingexperiments.com/conversion-marketing/the-meclabs-conversion-index · https://marketingexperiments.com/value-proposition/customer-anxiety-conversion-heuristic
- Risk reversal: https://conversionsciences.com/eliminate-risk-and-bump-your-lead-conversion-rate/
- Mobile share: https://sqmagazine.co.uk/mobile-vs-desktop-statistics/ · https://www.shno.co/marketing-statistics/landing-page-conversion-statistics
- Product screenshots vs illustrations (low confidence): https://studiomaydit.com/blog/saas-landing-page-best-practices-2026 · https://framiq.app/blog/saas-hero-section-design-guide
