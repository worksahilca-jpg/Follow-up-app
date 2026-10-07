# Psychology for FollowUp, round 2: trust in the drafts, attention, closure, colour, motion, themes (2026-10-07)

**Why:** founder, 2026-10-07: *"do proper psychological research and compare it with our follow-up app. Where do we
need to improve with our designs, animations, colours, themes, and UI/UX? How can we improve users' attention or
users' work experience?"* Builds on `2026-10-05-psychology-ease-results-return.md` (Kahneman, Fogg, Hooked, labour
illusion, peak-end, endowed progress, colour-in-context) and does not repeat it.

**The question, in one sentence:** what does research on human attention, trust in automation and perception say
FollowUp should change so a busy owner trusts the right drafts, misses no customer, and stops thinking about
FollowUp when the work is done?

**Evidence, honestly:** grade B. Original abstracts, the authors' own pages and reputable summaries; no paper was
read in full from here, and nngroup.com was blocked from this machine, so its findings are from summaries that quote
it. Where a finding has failed to replicate, it says so. Numbers are the studies' own.

**Compared against:** the running app on 2026-10-07 (main at 54ab4d7), phone 390×844 and desktop 1440×900: Today,
Customers, a customer page, Settings.

**Rule above everything here (unchanged):** psychology makes FollowUp easier and shows results that are true. No fake
urgency, streaks, guilt, badges or invented counts (A-038, A-046, R-027). Brand principle 1 outranks any lift.

---

## What the research says, and where FollowUp stands

### 1. Trust in automation must be *calibrated*, not maximised

- **Lee & See (2004), "Trust in Automation: Designing for Appropriate Reliance".** The goal is trust that matches
  what the system can actually do. Over-trust leads to misuse; under-trust leads to disuse. Trust grows from
  feedback on how the system performed.
- **Automation bias.** People follow automated suggestions even against contrary evidence, and scrutiny drops as a
  review queue grows (summarised across aviation, radiology and hiring; Goddard et al. and later work).
- **Buçinca, Malaya & Gajos (2021), "To Trust or to Think".** Explanations alone did *not* reduce over-reliance on AI
  suggestions and may increase it. Small "cognitive forcing" designs that make the person engage with the specific
  decision did reduce it, more so for people who like to think things through.

**FollowUp today.** Strong already: every reply waits for an OK by default, with an undo window after Send (A-048).
Risky claims get a line ("Check the number. Nobody wrote it in this conversation."), and blanks can't be sent
(A-100). **Gap:** the check is a sentence *under* the draft, about the whole draft. The owner still has to find the
risky words themselves, and the 20th "Send" of the day gets the least attention. Nothing tells the owner how often
FollowUp's drafts were right, so they have no way to calibrate their trust in either direction.

### 2. Interruptions are expensive; batch what can wait

- **Gloria Mark (UC Irvine).** Attention on one screen has fallen to about 47 seconds on average (2016 study), and
  interrupted work is resumed on average 23 minutes later, usually after two other tasks.
- **Fitz, Kushlev et al. (2019), Computers in Human Behavior, 237 people, randomised field experiment.** Getting
  notifications in three batches a day made people feel more attentive, productive, in a better mood and more in
  control than getting them as they came. Getting *none* raised anxiety and fear of missing out.
- **Oldroyd / HBR (2011), "The Short Life of Online Sales Leads", 1.25M leads.** Firms that contacted a lead within
  an hour were about 7× as likely to qualify it as firms that tried an hour later, and over 60× as likely as those that
  waited 24 hours.

**FollowUp today.** Right shape. A customer who just wrote is the one thing that interrupts (owner alerts, "told
within minutes"), and the rest is in the weekly digest. **Gaps to check, not assumed:** whether an alert can arrive
at 2 am, or in a burst of several in a row, and whether an owner interrupted mid-edit comes back to their half-written
reply. (Mark's 23 minutes means they *will* be pulled away mid-reply.)

### 3. Closure: a plan quiets the mind as much as finishing does

- **Masicampo & Baumeister (2011), "Consider It Done!".** Unfinished goals keep intruding on attention, the
  Zeigarnik-style effect, but making a specific plan for them removes most of that interference, even before they're
  done. (The original Zeigarnik effect itself replicates unevenly. This plan-making result is the useful part.)

**FollowUp today.** When nothing is waiting, Today says "Nothing needs your OK right now." twice (the heading and the
box under it, noted in the A-101 entry), followed by a paragraph about what goes out automatically. It does not tell
the owner the *plan*: who FollowUp will check on next, and when. That is the sentence that lets them stop thinking
about it.

### 4. Colour: meaning and contrast beat "colour psychology"

- **Elliot & Maier (2007), red impairs performance in achievement contexts.** A later meta-analysis found much
  smaller effects in follow-up studies, and *no evidential value after correcting for publication bias*. Treat
  "colour X makes people do Y" claims as weak.
- **Mehta & Zhu (2009), Science.** Red helped detail tasks and blue helped creative tasks. It's widely cited, but it
  belongs to the same family of small, context-dependent effects.
- **What does hold:** learned meaning (red = stop or error, green = done) and contrast (WCAG).

**FollowUp today.** Monochrome, with colour only for meaning. Orange is "your turn" and never an error (A-091), red
only for errors, and text shades pass AA. This is already the evidence-backed approach. **Do not** add colour for
mood. **One real issue:** on phone Customers every row carries the same pill, "● Needs you" (15 of 16 rows). A label
repeated on every row stops carrying information, and the tab above already says it.

### 5. Themes: light by default, follow the phone at night

- **NN/g summary of Piepenbrock et al. (2013, 2014).** People with normal vision read and proofread better in light
  mode at every age, and the gap grows as text gets smaller. At night, light mode still performed better. No
  difference in eye fatigue was found. Dark mode can help some low-vision users, such as those with cataracts.

**FollowUp today.** Light only; no dark tokens exist. Light is the right default for proofreading drafts, which is
the core job. **But** owners check their phone in bed, and a bright white screen in a dark room is the main reason
people ask for dark mode, a comfort reason rather than a reading-speed one. Worth doing later as "follow the phone's
setting", with drafts still easy to proofread. It's a token change, so `[TO DECIDE]`, the founder's call.

### 6. Motion: fast, and only for continuity

- **NN/g response-time limits:** 0.1 s feels instant, 1 s keeps the flow of thought. UI animation of 100 to 500 ms,
  with most small transitions under 300 ms. Perceiving a change takes about 230 ms.
- **Skeleton screens vs spinners:** mixed results (Viget n=136 found skeletons felt *slower*; Mejtoft 2018 found the
  opposite). Skeletons help only in familiar layouts with short waits.

**FollowUp today.** Motion is used sparingly (framer-motion on the queue, `initial={false}`), with the undo line
draining over the real window. Reduced motion is respected (8 places). Today on the phone is about 0.2–0.4 s per
tap (2026-10-05 speed check). **One opportunity:** after Send, the card should visibly leave and the next customer
arrive from where the eye already is. That keeps place and confirms "done" without a toast. Check what it does now
before adding anything.

### 7. One-handed use, and how looks shape perceived ease

- **Hoober (2013), 1,333 observations:** 49% of people hold the phone in one hand and use their thumb; about 75% of
  touches are by thumb.
- **Kurosu & Kashimura (1995); Tractinsky (2000):** how good an interface looks strongly predicts how *usable* people
  rate it. In Tractinsky's study, aesthetics changed post-use usability ratings and actual usability did not.

**FollowUp today.** The phone keeps Send at the bottom of the card, inside the thumb's reach, and swipe-for-Later is
already there (A-08x). Polish counts as function here, because a rough edge reads as "hard to use". **Seen in the
audit:** on a customer page the action row is three outlined pills ("Already spoke", "Copy booking link",
"Email"), and the page carries a Details expander. Both were flagged before (R-026 direction: subtract).

### 8. Autonomy, competence, relatedness (self-determination theory)

- **Peters, Calvo & Ryan (2018), METUX.** Wellbeing and lasting engagement with technology depend on three needs.
  **Autonomy:** "I chose this". **Competence:** "I'm good at this". **Relatedness:** "I'm connected to people".

**FollowUp today.** Autonomy is well served: every automation is asked once, can be undone and is shown in Settings
(A-099, A-101). Competence is only partly served: results are shown weekly, but the owner rarely sees "your reply
worked" at the moment it happens. Relatedness is the product's real reward: the customer wrote back. That is when
FollowUp should be quietly present, never a badge.

---

## Recommendations, ranked (nothing built; each one gets drawn first)

| # | Change | Why (evidence) | Size | Status |
|---|---|---|---|---|
| 1 | **Point at the exact words to check.** When a draft carries a number, date, price or a fact from "What FollowUp knows", mark *those words* inside the draft (a quiet underline) instead of only a sentence under it. A draft with nothing to check says so in one short line. | Buçinca 2021 (forcing attention to the specific decision beats explanations); Lee & See (calibration) | M | Proposal, draw first |
| 2 | **Closure with a plan.** On a quiet Today, one heading only, then one line of what happens next: "FollowUp checks on Priya on Thursday." Replaces the duplicate heading-plus-box. | Masicampo & Baumeister 2011; R-026 subtraction | S | Proposal, draw first |
| 3 | **Show the track record that lets trust grow honestly.** In Settings → How it writes: "You sent 18 of FollowUp's last 20 replies as written." Real numbers only, never on Today. It is also the honest basis for any future "send these without asking". | Lee & See (trust grows from performance feedback) | S | Proposal, product call |
| 4 | **Customers list: drop the repeated "Needs you" pill** and keep the information that differs per row (how long they've waited, already on Today). | Repetition carries no information; R-026 | S | Proposal, draw first |
| 5 | **Check alerts for night-time and bursts.** No alert between, say, 10 pm and 7 am unless the owner chooses otherwise, and several customers inside a few minutes become one alert. | Fitz et al. 2019; HBR speed-to-lead says the morning still wins | S | Check code first |
| 6 | **Never lose a half-written reply.** If the owner is pulled away mid-edit, the edit is there when they come back. | Gloria Mark (resumption ~23 min) | S | Check code first |
| 7 | **After Send, the next customer arrives in place** (≤250 ms, still under reduced motion). | NN/g timing; continuity | S | Check what exists |
| 8 | **Follow the phone's dark setting**, keeping proofreading-grade contrast in drafts. | Piepenbrock / NN/g (light reads better; dark for comfort at night) | L | `[TO DECIDE]`, founder |

**Not recommended, and why:** colour changes for mood (the evidence doesn't hold), streaks, progress bars, sounds or
badges (R-026, brand 2 and 7), skeleton screens everywhere (mixed evidence; FollowUp is already fast), and more
explanation text on drafts (Buçinca: explanations can increase over-reliance).

**Seen in passing, to verify:** on the local copy, a customer page's "Why it's here" read "Check the number…" while
the same draft on Today showed the answer blank's line. That's likely the local seed data's stale hold reason, but
worth checking on a real held answer-blank draft.

## Sources

- Lee & See 2004: mycourses.aalto.fi (PDF of the paper); pmc.ncbi.nlm.nih.gov/articles/PMC8181412
- Automation bias and complacency: pubmed.ncbi.nlm.nih.gov/25886768; axios.com/2019/10/19/ai-automation-bias-trust
- Buçinca, Malaya & Gajos 2021: eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml; arxiv.org/abs/2102.09692
- Gloria Mark: toolsforhumans.ai/blog/the-47-second-attention-crisis-what-the-research-actually-says-and-doesnt;
  kioncentralcoast.com (CNN Health, 2023-01-11)
- Fitz et al. 2019: scholars.duke.edu/publication/1402953; communities.springernature.com (authors' summary)
- HBR, The Short Life of Online Sales Leads (2011): via crankwheel.com and customerthink.com summaries
- Masicampo & Baumeister 2011: psychologytoday.com/us/blog/tech-support/201310/why-your-to-do-list-drives-you-crazy;
  scrapbox.io/nishio/consider_it_done
- Elliot et al. 2007 and the later meta-analysis: sciencedaily.com/releases/2007/02/070228170240.htm;
  link.springer.com/article/10.3758/s13423-020-01772-1
- Mehta & Zhu 2009: sciencedaily.com/releases/2009/02/090205142143.htm
- Dark vs light mode (NN/g summary of Piepenbrock et al.): gi-radar.de/tl/DC-0313 (link to nngroup.com/articles/dark-mode)
- Animation timing: valhead.com (UI animation duration); uxcel.com glossary (duration)
- Skeleton vs spinner: theplusaddons.com/blog/skeleton-loading-screen (Viget 2017; Mejtoft et al. 2018)
- Hoober 2013: uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
- Aesthetic-usability: ise.bgu.ac.il/faculty/noam/research/aesthetics.html; lawsofux.com/aesthetic-usability-effect
- Calm technology (Weiser & Brown 1995; Case 2015): en.wikipedia.org/wiki/Calm_technology; caseorganic.com
- Self-determination theory and METUX: wp.unil.ch/persuasivelab (review of Peters, Calvo & Ryan);
  selfdeterminationtheory.org/topics/application-technology
