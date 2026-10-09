# Rejected decisions

**What the founder has said no to — and what Claude must never propose again.**

This is the highest-value file in the design brain. Read it before proposing anything.

A rejected idea coming back in a new color wastes the founder's time and erodes their
trust that the system is listening. **Re-proposing something on this list is a failure,
not a fresh perspective.**

## How to add an entry

```
## R-00N — [Short title]
**Date:** YYYY-MM-DD
**Scope:** [screen / component / system-wide]
**Rejected:** [exactly what was rejected]
**Stated reason:** [the founder's own words, verbatim if possible]
**Inferred principle:** [INFERRED — what this implies generally. Mark clearly as inference.]
**Do not propose again:** [the specific variants that are also dead — this is the point]
**Would need to change for this to be reconsidered:** [or "nothing — permanently closed"]
```

**The field that prevents repeat offenses is "do not propose again."** If the founder
rejects a colorful chart-heavy dashboard, the dead list includes: the same dashboard with
fewer colors, the same dashboard with the charts collapsed, and the same dashboard on a
different screen. Write those out explicitly, because the next session will genuinely
believe its variant is a new idea.

## Rules

1. **Ask for the reason when it isn't given.** "I don't like it" is a fact; the reason is
   what generalizes. One question — "is it the density, or the color, or the layout?" —
   converts a data point into a principle. Do this *while the founder is present*, not by
   guessing later.
2. **Never delete an entry.** A reversal is a new, dated entry that supersedes the old,
   not an erasure.
3. **Rejections can be narrow.** "Not on this screen" is different from "never." Record
   which.
4. **A rejection with an unclear reason still gets recorded**, marked
   `REASON UNKNOWN — ask before going near this area again`.

---

## Decisions

## R-001 — Dashboard proposal D-020 ("Today, in one sentence"): subtraction-only redesign ^R-001
**Date:** 2026-09-15
**Scope:** Dashboard — and, as a principle, any "redesign" pass on an existing screen
**Rejected:** [[design-decisions#^D-020|D-020]] — the proposal that removed the greeting
banner and the three stat tiles, replaced them with one computed sentence, reordered the
approval row, and swapped the score pill for a text fact. Same tokens, same components,
less chrome.
**Stated reason:** "make it more creative and enhanced i mean its very basic."
**Inferred principle:** INFERRED — for this founder, a redesign that is *only* subtraction
reads as unfinished, not as restraint. The bar he judges the product against is the
landing page he approved ([[approved#^A-002|A-002]]: atmosphere, depth, a designed hero
mockup, big display numbers, motion) — the authenticated app has to feel like the same
designed product, not a cleaner version of a plain admin list. "Precision is the
aesthetic" (`brand-principles.md` 8) still holds; it is not a license to strip a screen
down to text and hairlines. Confirm this reading on the next review.
**Do not propose again:** the same proposal with a different sentence; the same list
treatment with icons added back; "expert polish" passes on other screens that consist of
removing chrome without adding a designed layer in its place.
**Would need to change for this to be reconsidered:** nothing about the individual moves —
several of them (why-it-was-held first, the undo grace, facts instead of a score) may
survive inside a richer design. What is closed is *subtraction as the whole answer*.

## R-002 — Keyboard-first interaction as the dashboard's organising idea ^R-002
**Date:** 2026-09-15
**Scope:** The authenticated app, system-wide — not just the dashboard
**Rejected:** The "Queue Zero" prototype
(https://claude.ai/artifact/3mucUkn3m1Ar7JjPJUXBNe) — a working, clickable approval queue
built around `J`/`K` to move, `E` to approve, `X` to skip, `Z` to undo, `⌘K` for a command
palette, `?` for a shortcut sheet, with visible `<kbd>` hints on screen. The reasoning was
that a business tool feels expensive when it responds instantly and never needs the mouse
(Superhuman's model), and that this was the kind of craft a static mockup structurally
cannot show.
**Stated reason:** "no keys thing" → asked whether the keys had failed or he didn't want
the premise → **"i dont want"**.
**Inferred principle:** partly INFERRED, but with hard evidence behind it that should have
been read first. **FollowUp's ICP is not a keyboard user.**
`followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md` records the
literal usage context as an owner "up a ladder" — interrupted, on a phone, 90 seconds,
not a software person. `brand-principles.md` 4 says the same thing in the system's own
words. A keyboard-shortcut layer is built for a desk-bound power user processing volume;
that is Superhuman's ICP, not FollowUp's. The failure here was borrowing another product's
*craft model* along with its interaction model, without checking the second one against
who actually opens this screen — the research to catch it was already on file and went
unread.
**Do not propose again:** command palettes (`⌘K`) as a primary navigation idea; `J`/`K`
list navigation; single-letter action keys; on-screen `<kbd>` hints as a design motif; a
shortcut cheatsheet screen; "power user mode"; and, generally, any proposal whose pitch is
"it's fast once you learn it." Learning is the cost this ICP will not pay.
**Would need to change for this to be reconsidered:** a genuinely different user — a
FollowUp customer with a full-time person at a desk working a high-volume shared queue.
That is not the current ICP and is not on the roadmap. Treat as closed until the ICP
itself changes. (Note: shortcuts as an *invisible accelerant* — Escape closing a dialog,
Enter submitting a focused form — are ordinary web conventions and are not what this
rejection covers.)

**Standing note after four rejected dashboard concepts (D-020, D-021, D-022, Queue Zero):**
all four were generated from a hypothesis about what the founder wanted rather than from a
reference he had pointed at. That approach has now failed four times in one session and is
itself the thing to stop, not just its outputs. Before the next dashboard proposal, get an
external reference the founder actually chose — a screenshot or a product he names. Do not
open a fifth concept without one.

> **GATE SATISFIED (2026-09-15) → [[approved#^A-006|A-006]].** The reference is not an
> external screenshot in the end — it is the founder's own six-axis A/B taste test
> (`B A A - A B`: dense · soft+shadow · colour-coded · no preference on numbers · boxed ·
> accent held back). Asked directly whether that counted, he said "YES USE MY ANSWERS."
> The dashboard is unblocked and is to be assembled from those answers.
>
> **The note itself still stands for everything after this one.** A-006 satisfies it once,
> for this round of work. It is not a permanent exemption: the next time a design direction
> is genuinely unknown, run another paired comparison or get a reference he names — do not
> fall back on a hypothesis and cite A-006 as cover.

---

## Standing rejections (from the brief, 2026-09-12)

These were ruled out at the outset, before any design work. They carry the same weight as
a rejection made in review, and they apply system-wide, permanently.

| # | Never | Why |
|---|---|---|
| S-01 | Scammy visual styles | FollowUp is not a spam tool and must never look like one | ^S-01
| S-02 | Cheap-looking gradients | Reads as template, not as product | ^S-02
| S-03 | Excessive glassmorphism | Fashion, not clarity; hurts legibility | ^S-03
| S-04 | Excessive neon | Wrong register entirely — this is a business tool | ^S-04
| S-05 | Overly colorful dashboards | Color must mean something; a rainbow means nothing | ^S-05
| S-06 | Clutter | Directly against "calm over urgent" | ^S-06
| S-07 | Unnecessary 3D | Ornament | ^S-07
| S-08 | Random animations | Motion must explain change or not exist | ^S-08
| S-09 | Excessive rounded cards / card-in-card soup | Symptom of unresolved hierarchy | ^S-09
| S-10 | Poor typography | Type *is* the interface at this level of restraint | ^S-10
| S-11 | Tiny unreadable text | 14px floor for real content; never below 12px | ^S-11
| S-12 | Decoration that doesn't improve usability | Everything on screen must carry information | ^S-12
| S-13 | AI gimmicks — sparkles, typing dots, bot avatars, "✨AI-powered" | AI is invisible capability, never personality | ^S-13
| S-14 | Fake complexity | Complexity that signals sophistication rather than serving a need | ^S-14
| S-15 | "Startup template" aesthetics | The default look of an unconsidered product | ^S-15
| S-16 | Copying another company's interface | References are principles; the design must be original | ^S-16

**[[rejected#^S-13|S-13]] and [[rejected#^S-16|S-16]] are the two most likely to be violated by accident** — the first because
AI-product visual conventions are pervasive in training data, the second because
"inspired by" drifts into "reproduced from" without anyone deciding to.

## R-003 — Email as the fallback channel for an Instagram/Messenger follow-up past Meta's 24-hour window ^R-003
**Date:** 2026-09-16
**Scope:** Instagram and Messenger leads, system-wide — workflows, the unanswered rule,
reactivation, and any future sender.
**Rejected:** The research recommendation in
`followup/research/product/2026-09-16-meta-window-close-what-shipped-products-do.md` §6.3
("past the window, send by email if there is an email") and the option put to the founder
in plain words: *"Workflow steps after day 1 can't be delivered on Instagram or Messenger —
send them by email instead, or hold for you."* Seven shipped competitors do some form of
this; it was the recommended pick.
**Stated reason:** *"no on instagram we will be sending them in their dms only"*.
**Inferred principle:** NOT inferred — stated. A lead who chose to write on Instagram is
answered on Instagram. Switching channel on them is FollowUp deciding where the
conversation happens; that is the lead's choice, not ours. It lines up with brand
principle 1 (trust) and with the 2026-09-15 fix that stopped automated replies defaulting
to email over the channel the lead actually used.
**Do not propose again:** any automatic channel switch away from the DM the lead used, on
Instagram or Messenger — email fallback, SMS fallback, "we'll continue this by email."
Asking the lead, inside the window, for a number so the *owner* can call them is a
different thing and is not covered here.
**Would need to change for this to be reconsidered:** the founder saying so. The cost was
named before the decision and accepted: on these channels nothing automatic goes out after
24 hours, and nothing at all after 7 days unless the lead writes first. What replaces the
fallback is in `design-decisions.md`, same date.

## R-004 — Four light palette specimens (cool/graphite, warm/graphite, cool/our blue, cool/steel) and a ten-swatch accent picker ^R-004

**Rejected:** 2026-09-18, founder. On the four specimens: "I didn't like any" → "Wrong kind of colour".
On the ten accent swatches (Apple blue, indigo, violet, teal, green, amber, orange, rose, graphite,
silver) and four hero grounds: no pick; the founder asked for the build instead.

**What was rejected:** black, our blue (`#2a5cdb`) and a desaturated steel blue as the marketing
site's accent on a white/grey ground. Reason given: colour only. The grounds were not objected to.

**Inferred principle (marked inferred):** the founder has a colour in mind that none of the swatches
hit, and is more likely to recognise it on a finished page than in a chip. The method that worked
for the app (A-006, paired forced choices on real surfaces) did not produce a pick here; two rounds
of options cost more than they returned. Next time: build with a placeholder accent, ship the
screenshot, and change the one token on reaction.

**Evidence:** `followup-light-directions` and `followup-colour-picker` artifacts (2026-09-18); the
2026-09-18 "light direction" entry in `[[design-decisions]]`.

## R-005 — A dashboard-style product card as the hero visual ^R-005

**Rejected:** 2026-09-18, founder, on seeing the first render of the light-direction landing page:
"let's remove this dashboard kind of thing from the start, let's cook something else."

**What was rejected:** the reference template's hero device — one wide app-window card with stat
tiles, a bar chart and a ranked list — even when filled with FollowUp's own numbers.

**Inferred principle (marked inferred):** a dashboard says "software you will have to look at";
the promise is the opposite, that the owner does *not* have to. The hero should show the moment
the product exists for, not the screen it lives in. Replaced by the thread: lead writes, owner
answers, five days of silence, one short FollowUp question with buttons, the lead comes back.

**Evidence:** the 2026-09-18 "light direction" entry in `[[design-decisions]]`; `HeroStoryLight.tsx`.

## R-006 — An all-light marketing page (white and grey only, no dark ground anywhere) ^R-006
**SUPERSEDED (2026-09-26)** by [[approved#^A-022|A-022]]: the founder moved the landing page to white with black type.

**Rejected:** 2026-09-18, founder, on seeing the first full render: "bro where is that black greyish
gradient" → asked where it should go → "whole page with white and black and greyish gradient".

**What was rejected:** the reading of "make ours look like this but in white gradient or greyish"
as *invert the whole template to light*. The founder meant *keep the template's dark ground and add
the white and grey to it*: the page should move through black, grey and white, not sit on one of
them.

**Stated reason:** the black-to-grey gradient was the thing he liked about the reference and it was
missing.

**Do not propose again:** a marketing page with no dark region. The shape that replaced it is in
`[[design-decisions]]` 2026-09-18 ("black, grey, white: the page as a gradient"): dark hero, fade
to a light middle, fade back to a dark close.

**Lesson for the brain (inferred, marked inferred):** when the founder names a reference *and* a
colour change in one breath, the colour change is additive, not a replacement. Ask "where does the
dark go" before building an all-light page from a dark reference.

## R-007 — Three things on the first animated preview of the gradient page (2026-09-18) ^R-007

**Rejected:** 2026-09-18, founder, after watching the 16-second recording of the page: "logo is not
accurate", "I don't like it directly shifted to white from black", "the Sarah Johnson example is
looking awkward", "after that it's too much congested, my eye was not ready to read all those heavy
information". He then asked for the design to be opened somewhere he can comment directly; a
review artifact was published for that.

**What was rejected, item by item:**
1. **The two-leaf logo as built** does not match #69/#71 closely enough. Reason not yet given;
   awaiting his comments on the artifact before rebuilding.
2. **The hard hand-off from the black hero to the white middle.** The 180 px fade reads as a cut at
   scroll speed. Inferred (marked inferred): the transition should be long and gradual, or the
   dark should carry further down the page, not flip.
3. **The hero thread with Sarah Johnson** reads as awkward. Reason not yet given. Inferred (marked
   inferred): a fake chat with a named person, playing out message by message under the headline,
   is a lot of theatre for the first screen; the earlier objection to the dashboard (R-005) was to
   the *device*, and this device may have the same problem.
4. **Density below the hero.** Four product cards with live-looking figures, then three stats, then
   three guarantees: too much to read too soon. Inferred: fewer sections before the first breath,
   and less inside each; the page should let the reader arrive.

**Do not propose again** until his artifact comments are in: no rebuilding any of the four on a
guess. The comments are the brief.

**Evidence:** the recording `landing-preview.mp4` (session scratchpad); this entry's date in
`[[design-decisions]]`.

## R-008 — The 2026-09-18 landing page, whole: look, layout, words and feel ^R-008

**Rejected:** 2026-09-18, founder, after the third animated preview (dark hero, timeline card,
long fades, half the cards removed, floating card, drifting light): "no bro" → "the page still
isn't it" → what's off: **the look, the layout, the words, the feel** → where: **all of it**.

**What this closes.** Not one element: the whole page as built this day, in all three states
(all-light R-006, dark-grey-white A-009, and the R-007 rework). A-009 is superseded by this
entry. The "this is sick" reaction was to a still image; the moving page did not hold up.

**Stated reason:** none beyond the four boxes. REASON UNKNOWN in the sense that matters — which
*quality* is missing. Asked next: a reference he actually wants, per the standing note under
R-002 (do not open another concept from a hypothesis; get a reference the founder names).

**Do not propose again:** another variation of this page generated from the session's own
reading of the Scalable template. Three variations from that reading have now failed. The next
build starts from something the founder points at, or from a faithful adaptation of the
template he chose in the first place (his words then: "same template and design, animation,
graphics and all, with our own information"), which this session never actually delivered — it
inverted it, then re-darkened it, then subtracted from it.

**Inferred principle (marked inferred):** when the founder names a template and says "same
results", the safe first build is the template's home page as literally as our content allows,
not a designer's take on it. Show that first; diverge only on his reaction.

**Evidence:** `landing-preview-v3.mp4`, the Figma frame, PR #265 (unmerged); entries above.

## R-009 — An app-dashboard mockup as the hero device (second time) ^R-009

**Rejected:** 2026-09-18, founder, on the live preview of the enhanced faithful build: "I don't
want app dashboard. What I want is an illustration where it shows that leads are being caught
from the sources and FollowUp is warming every lead."

**What was rejected:** the hero's dashboard card (stat tiles, bar chart, line chart, window
chrome) — the template's own hero device, kept in the faithful copy because he had asked for the
template "as it is". R-005 had already rejected a dashboard-card hero on the light page. Two
rejections, two very different pages: the objection is to the *object*, not its styling.

**Stated reason:** he wants the hero to show what FollowUp *does* (catch leads from every
channel, warm each one up), not what the app *looks like*.

**Do not propose again:** a screenshot-style or mockup-style app dashboard as the hero device, on
any page direction. A product mockup can still live further down (the Product cards are fine).

**Replaced by:** the lead-flow illustration (sources → FollowUp → warmed leads), see
`[[design-decisions]]` 2026-09-18, "Hero illustration".

## R-010 — The black → white gradient across the page ^R-010
**SUPERSEDED (2026-09-26)** by [[approved#^A-022|A-022]]: the founder moved the landing page to white with black type.

**Rejected:** 2026-09-18, founder, on the live preview, minutes after the device-theme rule:
"we will do full black with dark mode and white with light, so no transition."

**What was rejected:** the page changing tone from top to bottom at all: the slow ramp across
the Features section and the flipped lower zone (built today after "can we go with white
black gradient", then mirrored per device theme).

**Stated reason:** none beyond "no transition". Inferred (marked inferred): with the device theme
in play, a page that is half one tone and half the other is the wrong half for someone on either
setting; one tone per setting is simpler and calmer, which is the brand.

**Do not propose again:** any top-to-bottom tone change on the landing page, ramp or hard edge.
Section-level surfaces (cards, the CTA band) still lift with borders and shadow; the ground stays
one tone. The A-011 amendment about the gradient is superseded by this entry.

## R-011 — A photograph of a person as the hero image, and the Aer layout with it ^R-011

**Rejected:** 2026-09-18, founder, on a first cut sent as a screenshot: "no, it doesn't make
sense with FollowUp." Asked what exactly: "the photo of a person." Then, before the second cut
shipped: "I just wanted to use the colour, that's it" and "no person, I want same as previous."

**What was rejected:** (1) a generated black-and-white photograph of a business owner from
behind, phone in hand, as the hero image (two variations on his ElevenLabs account, about 4
cents; the file is deleted); (2) the Aer layout itself (framed panel, left rail, index block,
headline right, bottom strip), which he never asked for. He pasted the Aer shot for its
charcoal colour only.

**Stated reason:** a person says nothing about the product; and the layout was my reading, not
his ask. **Inferred (marked inferred):** when this founder pastes a reference and says "use
this", ask *what* about it before building — colour, layout, type, or all of it. The same
lesson as A-010 from the other side: the literal thing he pointed at, and only that.

**Do not propose again:** photography of people as the hero image; the Aer hero layout.

**Replaced by:** the approved page (A-011) unchanged, with the dark ground moved to charcoal;
see `[[design-decisions]]` 2026-09-18, "Charcoal, not black".

## R-012 — A public "request access" form on the landing page ^R-012
**Date:** 2026-09-19
**Scope:** Landing page and sign-up flow
**Rejected:** The `/beta` page: every landing button reading "Join the beta" and opening a
form (name, email, what you sell, where customers write) that anyone could submit, with the
founder approving from `/admin`. Built and shown the same day.
**The founder's words:** "I don't want any unknown users to try my beta app and request access
to the app. I don't want that, so I will personally be adding all the emails, and then they can
test it."
**The reason:** stated, not inferred — strangers must not be able to knock. The beta is a
closed list of people he knows and adds himself.
**The generalizable principle:** for now, every door into FollowUp is opened by the founder by
hand. Do not add self-serve sign-up, waitlists, request forms or "get early access" captures
anywhere — on the site, in emails, in the app — until he says the beta is open. The site sells;
it does not enrol. "Start free" leads to sign-in, and sign-in says plainly that it is a private
beta and gives contact@followupbase.io.
**What survived:** the admin tester list (add an email, they can sign in, no redeploy), the Beta
mark and the "Something broke?" feedback dialog in the app.


## R-013 — The F/U interlocked-monogram logo drafts (all three) ^R-013
**Date:** 2026-09-14 · **Recorded:** 2026-09-21
**Scope:** Logo mark — the F/U monogram direction specifically
**Rejected:** All three rough drafts ("Shared spine, arrow crossbar", "Flag planted in the
tray", "Negative-space arrow") — the founder's own follow-up idea ("F within a U"), drafted
and shown back, then rejected on sight: *"no bro"*.
**Stated reason:** none given. A clarifying question was asked in the same turn and, before
it was answered, the founder said he would handle the logo himself: *"I will handle the logo
part by myself"*.
**Inferred principle:** [INFERRED, unconfirmed] It is genuinely unknown whether the monogram
*concept* was the problem or only these three executions. Recorded as unresolved rather than
settled either way.

**PARTLY SUPERSEDED (2026-09-18) by [[approved#^A-008|A-008]] and
[[approved#^A-009|A-009]].** The "don't propose any logo work at all" half of this entry is
dead: the founder re-opened logo design four days later, picked a direction, and the mark
now ships (`src/components/LogoMark.tsx`). What survives is the narrow rejection — **the F/U
monogram is not the direction**, and it should not come back in new clothing.

**Why this is being written a week late.** It was recovered in PR #232 on 2026-09-14 after a
force-push lost it, and that PR then sat open long enough for its own instruction to go
stale. Merging it verbatim in 2026-09-21 would have put "do not propose any further logo
direction" into the brain on the same day the approved logo is in production — a rule that
contradicts what shipped is worse than no rule. Ported here instead, with the contradiction
resolved rather than hidden, per this brain's own supersede-don't-delete rule. PR #232 is
closed as superseded by this entry.

## R-014 — The hero lead-flow diagram as it stands: flat, and filling the screen ^R-014
**Date:** 2026-09-25
**Scope:** Landing page hero (the A-012 diagram)
**Rejected (in part):** on the website review page, the founder commented on the diagram:
*"this whole diagram is very boring the concept is cool but not that advanced and it is in the
whole screen too"*.
**What survives:** the **concept** — leads coming in from every channel, FollowUp in the middle,
customers answering on the right. He called it cool. Do not drop the idea.
**What is rejected:** the execution: flat cards and thin wires, and its size (full screen width
under the headline).
**Inferred principle (marked inferred):** "advanced" here most likely means depth and craft —
the same story told with more dimension and motion that explains, in a smaller footprint — not a
new concept. Asked which reading he means before rebuilding (R-008: no rebuild on a guess).
**Supersedes, partly:** [[approved#^A-012|A-012]] — its concept stands, its look and size do not.

## R-015 — The first phone app screens: too much on each screen ^R-015

**Rejected:** 2026-09-26, founder, on the canvas: *"the mobile interface still looks very complex. I would
rather ignore using it on my phone. Make it more simple so that I can also be habitable with my phone, because
users will be mostly using their phone… very clean, neat, and simple."*

**What was rejected:** the first phone versions of Today, Inbox, the conversation screen, and "all caught up".
Specifically, what each screen carried:
- **Today:** a progress bar with a caption, two section labels, "Send both", a win card, times and icons on every row.
- **Inbox:** filter chips, three group labels, and a coloured dot per row.
- **Conversation:** a window-time line, an event divider, and a mono label.
- **All caught up:** a colour wash, a progress bar, and an outcomes grid.

**Stated reason:** too complex; he wouldn't use it on his own phone.
**Inferred principle (marked inferred):** the desktop's information density doesn't transfer to the phone, even
when it's styled cleanly. The phone gets one decision per screen, bigger type, fewer labels, and no colour
coding. Anything that's only "nice to know" moves off the phone screen.

**Do not propose again:** desktop-density screens on the phone, in any styling.

## R-016 — Black-only state dots on desktop ^R-016

**Rejected:** 2026-09-26, founder, "Colored one", on the side-by-side comparison. The proposal was a black dot and bold text
for "needs you", and grey for every other state.
**Stated reason:** none. **Inferred (marked inferred):** the desktop table is scanned many rows at a time, and
colour makes the states distinguishable at a glance. It's the Attio principle "colour only for state", which the
founder accepted. **Do not re-propose** removing colour from the desktop state dots.

## R-017 — A handwriting font / handwritten note on the landing page ^R-017

**Rejected:** 2026-09-26, founder: "skip it". It was offered as an option for "more human made" (a note like
"you tap send" beside the reply).
**Reason (my recommendation, accepted):** the pen-drawn underline and arrow already carry the hand-made feel; a
handwriting font tends to read as a gimmick and adds a font dependency.
**Do not re-propose** a handwriting font. The pen marks are the approved human touch.

## R-018 — The reply as a big black card ("too black") ^R-018

**Rejected:** 2026-09-26, founder, in a canvas comment on the proof screen's reply card: *"I'm not liking this black
theme. It's everywhere. It's too black. Can we add that or gradient things?"*
**What was rejected:** the large black reply card (white text, white Send) used on every screen: the proof screen,
Today, the conversation, Inbox, People, and three cards on the landing page.
**The principle (inferred):** big dark surfaces repeated on every screen read as heavy, not calm. Black should be
rare: the one action (a small Send or Start button), not whole blocks.
**What replaced it (canvas version 26):** the landing wash (warm peach, rose and slate, with grain; A-032) and dark
text, a faint border, a black Send and a light Edit. Partly supersedes A-022 and A-025 ("the one black card").
**Still open:** whether the small black buttons should be softened too. The founder was asked in the thread.

## R-019 — New canvas boards drawn in the live site's older type, not the sketched canvas system ^R-019

**Rejected:** 2026-09-26, founder, looking at the Intercom and Close boards (DemoStory, SafePromise, HeroProof,
ProofWaiting): *"why i am seeing older theme designs in the new canvas you are drawing"* and *"this is the design
that we sketched but why are you sketching the new canvas according to the old fonts"*. Pointed at Main, App and Today.
**What was rejected:**
- Instrument Serif italic in headlines ("and why.", "using it.").
- Centered 500/600-weight headings.
- A black reply bubble. That had already been rejected in R-018 and came back through the live site's styling.

All of these were copied from the live `page.tsx` instead of the canvas.
**The principle:** the sketched canvas (Main.dc.html, Today.dc.html, TodayPhone.dc.html) is the design system for
every new board. That means:
- Public Sans headings at weight 300: 48px in sections, 64px in the hero.
- IBM Plex Mono eyebrows at 11px, spaced 0.1em.
- Left-aligned sections padded 100px 184px.
- White cards with a #e7e5e2 border and 22px radius.
- The peach/rose/slate wash with grain for any written reply. Black only for the one small action.

Where the live site differs, the canvas wins. Before drawing, open Main.dc.html and match it. Don't use the live
page or memory.
**What replaced it (canvas version 41):** all nine boards were redrawn in that system.

## R-020 — Hand-drawn marks (underline, arrow), repeated channel lists, and the "Only for owners…" hero line ^R-020

**Rejected:** 2026-09-26, founder, circling them on the combined landing page (MainV2):
- *"I'm seeing Works with twice … at the bottom as well and in the front"*
- *"I don't like that concept of drawing that arrow and underlines"*
- *"Only for owners who have this thing … I'm not getting that kick"*

**What was rejected:**
1. The hand-drawn swash under "follow up" in the headline.
2. The hand-drawn curved arrow between the message card and the reply card in the hero picture.
3. The channel chips in the hero picture (Gmail, Instagram, WhatsApp, Website), with the "Works with" strip right
   below saying the same thing.
4. The hero lede opening "Only for owners who have leads and don't have time to reply."

**The principle:**
- No hand-drawn decoration anywhere. It's the same family as R-017 (handwriting), so the whole hand-made-mark
  direction is dead.
- Say a thing once on a screen.
- The line under the headline says what FollowUp does, never who it's for or a qualifier. (That part is inferred from
  "no kick", and matches the reference strategy's note that the explanation line was a qualifier.)

**What replaced it (canvas v50):**
- The underline, the arrow and the chips are gone. The "Works with" strip stays as the one place the channels appear.
- New lede: "FollowUp reads your email, DMs and website messages, finds every customer still waiting on you, and
  writes the reply. You just check it and send."

## R-021 — The phone's first screen as all text ^R-021

**Rejected:** 2026-09-26, founder, on PhoneV2 (canvas v55): *"for the website for laptop or desktop, it's good, but
for mobile, it's very boring. I don't think anybody will see… I don't think anybody will catch that on their phone.
Desktop is fine."*
**What was rejected:** the phone's first screen: headline, a four-line paragraph, the buttons and two check lines. The
picture of FollowUp replying started at the very bottom, so on a phone nobody saw it without scrolling.
**What survives:** the desktop hero. There the picture sits beside the text, so it's in view.
**Inferred principle (marked inferred):** on a phone, the first screen has to *show* FollowUp doing its job, not just
describe it. Stacking the desktop's text column above the picture pushes the product below the fold.
**Open:** "bold, full letters" could mean the thin headline, or the wall of text. Both versions are drawn
(PhoneHeroA thin, PhoneHeroB bold) for the founder to pick.
**Do not propose again:** a phone hero where the picture starts below the first screen.

## R-022 — The small-f logos (F1–F5): a letter with a clever detail ^R-022

**Rejected:** 2026-09-27, founder, on LogoF (canvas v69): *"it is not conveying the message bro"*.

**What was rejected:** all five lowercase-f marks:
- F1, dog-eared f;
- F2, folded ribbon;
- F3, f with a pause (my pick);
- F4, f carrying a message;
- F5, f and a dot.

The founder asked for the f himself. The rejection is of what these f's say, not of asking.

**Stated reason:** they don't convey the message.

**Inferred principle (marked inferred):**
- The mark has to say what FollowUp does at a glance.
- A letter plus a small hidden detail (a gap, a fold, a dot) needs explaining, so it fails.
- The detail was carrying the meaning, and at a glance nobody sees the detail.

**Answered the same day:** *"Every message gets a reply"*. That's what the logo has to say in one second. See
`[[design-decisions]]` 2026-09-27, "logo, every message gets a reply".

**Do not propose again:** a letter (f or F) whose meaning lives in a small detail.

## R-023 — The reply marks drawn heavy (LogoReply R1–R4) ^R-023

**Rejected:** 2026-09-27, founder, on LogoReply (canvas v70): *"looks lil wiered"*. Asked what was weird, he picked
**"Too heavy / chunky"**: the shapes feel thick and blunt, not premium or refined.

**What was rejected:** the weight, not the idea. "Every message gets a reply" still stands. R1–R4 were drawn as solid
blobs or thick 8-unit outlines, with fat tails.

**Principle (from his answer):**
- The mark has to feel light and refined.
- It should match the page's thin Public Sans 300 headline (A-059), not a chunky app icon. That part is inferred.
- Thin, even lines and room around them.

**Do not propose again:** heavy solid chat blobs or thick outlines as the mark.

## R-024 — A white badge behind the logo in the weekly email ^R-024

**Rejected:** 2026-09-28, founder, on the real weekly email in Gmail (dark mode): *"I dont want white background behind
the logo"*.

**What was rejected:** the lockup on a white pill (`followup-lockup-chip.png`), added in #382 so the black mark stayed
visible when Gmail darkened the header around it.

**Principle (inferred):** the logo sits on the page's own surface, never on a sticker that exists only to work around a
mail app. If the mark needs help to be seen, change what sits behind it, not the mark.

**Do not propose again:** a white (or any contrasting) chip, pill or badge behind the FollowUp lockup in email.

## R-025 — Notice emails as a plain white sheet with a thin wash band ^R-025

**Rejected:** 2026-10-01, founder, on the first mock of the six notice emails (reconnect, customer waiting, new
sign-in…): *"this design doesn't look good, use those gradients that we have in our theme."* Also: *"look at the
logo"* — the mock had a drawn stand-in instead of the real lockup. Never again: a mock carries the real brand assets.
**Principle (founder's words, not inferred):** the brand's warmth is the landing page's wash — the peach, blue and
rose gradient on cream with the grain (`landing.module.css` `.washHero`). A notice email that is a white sheet with
the wash as a 2cm band reads as a generic transactional template. The wash is the ground, the words sit on a card.
**What replaced it:** take 2, the whole email on the hero wash with one white card.

## R-026 — The app as it ships on 2026-10-03: too much on every screen ^R-026

**Rejected:** 2026-10-03, founder, after a day of watching the product through a reviewer's eyes (two demo
recordings) and through a realtor's account: *"our product looks way too complicated"*. Asked which screen and
whether it is density or words: *"all of it, too much stuff"*.

**What was rejected:** the amount on screen, across the app, desktop included. Not the words, not one screen.
R-015 and brand principle 4 already said this for the phone ("one screen = one decision"); this extends it to the
desktop, where Today, the customer page, Settings and the lists each carry several jobs at once.

**Principle (founder's words plus inferred, marked):** fewer things on the screen beats a clearer explanation of
many (principle 9, already written). *Inferred:* the desktop was allowed to keep what the phone was told to drop,
on the theory that a bigger screen can hold more. The founder's reaction says the theory is wrong for this user:
the owner is the same busy person at a desk, and extra panels, counts, chips and expanders read as work, not
as help. Subtraction is the direction; what to subtract is the research question, answered per screen with the
owner's one job on it, never by hiding things behind more chrome (an accordion is still stuff).

**Do not propose again:** adding a panel, count, chip, section label or expander to an app screen without
naming what it replaces. "More context" is not a reason. R-001 still stands: subtraction alone with no
structural idea was rejected once; the structure must come from the owner's job on that screen, then subtract
to it.

## R-027 — A row of questions right after setup (the A-100 question step as the first thing a new owner sees) ^R-027

**Rejected:** 2026-10-07, founder, after the first outside tester called it annoying: *"Too many questions might be
unrelatable… make it more strategic or easy for them so that they don't find it boring or irritating answering
those questions… after an hour, or whenever we need… play with their psychology."*

**What was rejected:** sending a new owner from setup straight into six or seven questions in a row, before they
have seen FollowUp do anything. Not the questions themselves, and not the answer blank on Today.

**Principle (founder's words plus inferred, marked):** ask after FollowUp has shown it is useful, one question at a
time, when the owner isn't busy. *Inferred:* a list of questions asked up front feels like homework for a product
that hasn't earned it yet, and a general list reads as unrelatable to anyone it doesn't fit. "Psychology" here
means the honest kind (value first, a tiny ask, the right moment, an easy "Not now"), never streaks, guilt,
countdowns or fake urgency (brand principles 1, 2 and 7).

**Do not propose again:** any multi-question form between setup and the owner's first look at Today.

## R-028 — D2 and D3 (2026-10-08): a tidier version of the current page ^R-028

**Rejected:** 2026-10-08, founder, on the canvas: *"BRO I THINK WE ARE GETTING THERE"* then *"NOT"*; then, shown the
eight reference sites side by side: *"i love all these websites. That's why I have given you the references."*

**What was rejected:** the D2/D3 boards as a whole (`prototypes/2026-10-08-taste-d2-d3/`): the same white page, the
same Public Sans, the same wash, the same layout, tidied (slower story, floating menu, two-tone headings, a serif in
D3). Not any single element.

**Inferred principle (marked inferred):** when the founder hands over bold references and says he wants "that
taste", a careful refinement of what ships is not an answer; the change has to be visible at a glance (scale, a
committed colour, a display face, depth behind the product). Keep the guardrails (R-005, R-009, R-011, R-017,
R-018), but don't spend the boldness budget on caution.

**Do not propose again:** a "same page, finished" option as the main answer to a request for a new look.

## R-029 — One reference site as the base of the new website ^R-029

**Rejected:** 2026-10-08, founder, right after it was proposed: *"Bro. I didn't tell you to copy Wispr Flow or
something, but what you should do is get the best things that they are using on our side, and then we'll design it
according to our website. Let's try to reframe the whole website too."*

**What was rejected:** the proposal to pick one of the eight references (Wispr Flow recommended) as the skeleton of
the new landing page and follow its format and motion closely.

**Principle (his words, plus inference marked):** take the **best technique** from each reference, bring it to
FollowUp's side, and design FollowUp's own website with it. The references are a toolbox, not a base. *Inferred:*
the work is the whole site (every public page), not the landing page alone, and the result should read as one
FollowUp system, not as a page per reference.

**Do not propose again:** "pick one site and follow it", in any wording.

## R-030 — Mood photos that mean nothing (sunset skies, rooftops, a coffee by a window) ^R-030

**PARTLY SUPERSEDED (2026-10-08)** by [[approved#^A-120|A-120]]: unrelated photos are now wanted, but only blurred until
nothing in them is recognisable, as colour fields. A *visible* photo that means nothing stays rejected.

**Rejected:** 2026-10-08, founder, as the first five Unsplash photos arrived (sunrise sky over rooftops, pink sky
over houses, two coffee-by-the-window shots, red roofs under a blue sky): *"Bro, we got to use the photos that are
relevant, not the irrelevant ones. What does the sunset mean, bro? Nothing."*

**What was rejected:** photographs used as atmosphere behind the product (the Wispr/Granola "mood" technique),
chosen to carry an abstract idea (the time of day) rather than anything in the owner's or the customer's world.

**Principle (his words):** a photo has to be **relevant**: it must show something real about the work FollowUp
serves (an owner busy on a job, between jobs, a customer writing, the deal that follows), so that a visitor gets a
meaning from it without a caption. *Inferred, not confirmed:* the night-to-dawn colour idea of the reframed website
may read the same way ("what does the sky mean?") and should be justified by what it shows, not by a metaphor.

**Do not propose again:** skies, sunsets, landscapes, coffee cups, plants or other decorative photos as imagery.

## R-031 — The dark blue night-to-sunrise look ^R-031

**Rejected:** 2026-10-08, founder: *"we don't want to use that dark bluish sunrise kind of thing. It was looking good,
but not my type."*

**What was rejected:** the night-sky-to-dawn gradient heroes and the deep night-blue blocks: L2 "Morning light", L4,
the "Website · reframed" pages (night hero, dawn closing panel, Sign in sky) and the deep blue stage (`#0f1a2c`) of
the held v2 Home.

**Principle (his words, plus inference marked):** it looked good but it isn't his taste. *Inferred:* he prefers the
light, warm, editorial ground of Wispr Flow (cream, near-black, flat colour blocks) to cinematic dark-blue
atmosphere; dark is fine as a near-black block (Wispr), not as a blue sky.

**Do not propose again:** dark blue or navy grounds, night skies, sunrise/dawn gradients.

## R-032 — Following Wispr's page as-is; the giant wordmark footer ^R-032

**Rejected:** 2026-10-08, founder, on the "Around Wispr" Home: *"We don't have to copy as it is, bro. The thing that you
have copied at the end, like a big FollowUp text, looks odd."*

**What was rejected:** W1's section-by-section mirror of wisprflow.ai (hero device, colour band, pinned comparison,
pinned three steps, lit list, trust card, FAQ, big closing) and specifically the footer's giant "FollowUp" wordmark.

**Principle (his words, plus inference marked):** take Wispr's best techniques, not its page. *Inferred:* when a
section exists only because Wispr has one there (the drifting logo band, the giant wordmark), it reads as copied and
odd for FollowUp; every section must earn its place for our story.

**Do not propose again:** a giant wordmark footer; Wispr's section order as our section order.

## R-033 — W1's hero: a centred headline over two small cards ^R-033

**Rejected:** 2026-10-08, founder: *"our first impression is very boring, very bad. We have to improve the first
impression."*

**What was rejected:** the "Around Wispr" first screen: label, centred serif headline, one line, one button, and the
email → "1 min" → reply cards small and low on a plain paper ground.

**Inferred principle (marked inferred):** the first screen needs one big, living moment that fills the screen and
makes you feel the problem and the relief, not text with a small diagram under it. Scale, depth and motion belong in
the first screen, inside the guardrails (no dashboard hero R-005/R-009, no person photo R-011, no dark blue R-031).

## R-034 — The hero concept "your pile, cleared" (option A's pile of emails) ^R-034

**Rejected:** 2026-10-08, founder: *"I like the A1, but I don't like the concept. It is good, but no, it's kind of
boring."*

**What was rejected:** the idea inside A's stage: a pile of customer emails, the top one flipping to the reply, a Sent
stamp, the Answered pile. The layout stays (A-105).

**Inferred principle (marked inferred):** one customer and one reply, however animated, still reads as "a message and
a reply", which he has now seen many times (R-028, R-033). The hero needs a bigger idea than a single exchange.
Note R-009's own words for what he wanted the hero to show: "leads are being caught from the sources and FollowUp is
warming every lead."

## R-035 — A2 "Without, then with FollowUp" (the grid of nine customer cards) ^R-035

**Rejected:** 2026-10-08, founder, in a canvas comment anchored on A2's stage ("Who wrote this week / Without
FollowUp / With FollowUp"): *"I don't like this."*

**What was rejected:** A2's picture: a 3×3 grid of customer cards in cool grey-blue, four dropping away as "Lost",
then the switch to "With FollowUp" and the cards warming to peach.

**Reason:** not given. Asked in the thread which part (the grid of cards, the cold/warm colours, or the
lost-customers story). *Inferred, not confirmed:* a grid of small cards reads like a dashboard or a list (R-005/R-009
territory) rather than one big, felt moment.

## R-036 — Shine: glows, light halos and glossy highlights ^R-036

**Rejected:** 2026-10-08, founder, looking at A5 and its Charcoal version: *"Don't add that shiny thing, bro."*

**What was rejected:** A5's lighting effects: the peach/amber light glowing behind the reply (and brightening when it
was written), the rose haze, the coloured glow shadow under the reply card, the glow round the orange dot, the peach
glow under the "Connect Gmail" button, and the thin highlight edges on the panel and the customer's bubble.

**Reason:** "shiny" is his word. *Inferred (marked inferred):* he wants the depth and contrast he saw on Macro, but not
by lighting tricks; glows read as effects, not as the product (close to the standing "no neon, no cheap gradients").
Not asked which one he meant, because all of them were removed together.

**Do not propose again:** glows, halos, light sources, coloured or glowing shadows, glossy highlight edges. Depth comes
from contrast (dark ground, light text, the light button), plain dark shadows, one thing in front of another, and far
things being smaller and fainter.

## R-037 — Home v3: the charcoal + beige + peach palette, and a page with no "wow" after the first screen ^R-037

**Rejected:** 2026-10-08, founder, on the "Website · v3" page: *"i didnt like this broooo."* Asked what (four
choices, more than one allowed), he picked **"Colours"** and **"Not impressive"** (nothing makes you say wow after the
first screen; it doesn't feel like Wispr, Macro or Linear). He did not pick "boring, same old" or "too long".

**What was rejected:** the colour system of v3 and A5 (charcoal `#1e1e20`, warm paper `#faf7f2`, sand stages
`#ebe3d7`, the peach/slate wash, peach italic) and the page's middle: small cards on sand panels, chapter by chapter.
The structure (one story in chapters, the promises, questions as replies, one button) was not named as the problem.

**Principle (inferred, marked inferred):** warm cream + serif + soft peach is a safe, common look and reads as
generic, not premium; his four favourites each commit to a confident colour world (Macro black/white, Linear black,
Wispr cream with a strong dark and a lilac button, Superhuman's saturated moods). And the "wow" has to continue past
the first screen: big type, big moments, the product's story told at full size, not in small cards.

**Do not propose again:** the charcoal + sand + peach-wash palette as the site's colours; chapters drawn as small
cards on beige rounded panels.

## R-038 — Five "themes" that were one layout in five colours ^R-038

**Rejected:** 2026-10-08, founder, on the "Five themes" page: *"bro why you using the same design be creative bro just
use the info not the design."*

**What was rejected:** Signal, Greenhouse, Lilac, Blocks and Ledger as a set: all five shared one composition (top
menu, headline and lede on the left, button, a moving demo on the right or below). Only colour, font and the demo
changed.

**Principle (his words):** keep the information (what FollowUp does, the headline, the button, the story), and make the
*design* new each time. Variety has to be in the composition and the idea, not in the paint.
**Inferred (marked inferred):** "layout A" (A-105, headline left and a stage right) has become a habit he's tired of;
he wants each first screen to be a different picture, the way Wispr, Macro and Superhuman each look like nothing else.

**Do not propose again:** a set of options that share one skeleton; headline-left/demo-right as the default answer.

## R-039 — The "Five ideas" boards: "these designs look shit… not even close to those references" ^R-039

**Rejected:** 2026-10-08, founder, on the "Five ideas" page (Night, The list, The letter, The poster, The receipt):
*"tese designes looks shit man"* and *"bro its not even close to those refrences"*.

**What was rejected:** the five boards, and with them the method behind every round today (A2–A5, v3, five themes,
five ideas): quick first screens hand-drawn as HTML on the canvas, made of type, flat shapes and small cards.

**Principle (inferred, marked inferred):** the gap is craft, not concept. Wispr, Macro, Linear and Superhuman reach
their level through (1) the real product rendered in high fidelity as the picture, (2) art-directed media made by a
team (film, photography, custom illustration), (3) scroll-driven motion across the whole page, and (4) hundreds of
small details. Our boards had none of the four: they were text-only scenes, static frames on a canvas that cannot
scroll-drive, five at a time and fast. More rounds of the same method will not close the gap.

**Do not propose again:** another batch of quick canvas options as the answer to "make it look like the references".

## R-040 — All five palettes on the full page ^R-040

**Rejected:** 2026-10-08, founder, after trying the picker on https://claude.ai/artifact/4nhihQ1jNDy8w5e97PgX4E:
*"not any of these."*
**What was rejected:** 1 Ink and paper, 2 Forest and lime, 3 Plum and lilac, 4 Wine and rose, 5 Black and orange.
**Inferred (marked inferred):** all five were dark-first (a dark first screen and a dark close, light only in the
middle). His favourite, Wispr, is light-first; the app's own ground is white (A-090); he has called black "too much"
before (R-018) and loved a black-to-white page only once (A-009). The miss may be the darkness, not the hue. Asked.

## R-041 — Four opening screens (One line, Day and night, Your phone, Three words) ^R-041

**Rejected:** 2026-10-08, founder, on https://claude.ai/artifact/1D4MG89T9aLMXVqE8buHpP: *"no one i dont like the
concept, we have to make something catchy."*
**What was rejected:** the four concepts as a set: a headline with one changing sentence; a 24-hour day line with
customers answered; the headline split around a phone; "Replies. Follows up. Stops." in big type.
**What he asked for instead (his words):** "If someone lands on our page, it should just give a quick look that says,
'Oh yeah, someone is replying,' or 'What's the main job of FollowUp? Why should they use it? How is this going to
help?' Not everything, but this should be the goal… Make it a bit more interactive too… like Wispr Flow, where they
have something flowing according to their concept."
**Inferred principle (marked inferred):** the four were quiet and explained FollowUp; none of them *showed the act*.
The first look has to be the act of replying itself, moving and catchy, and the visitor should be able to touch it.
Static type (1, 4), a diagram (2) and a still phone (3) all read as "about" the product, not the product working.
**Do not propose again:** type-only openings; a timeline diagram as the opening; a phone mockup as the whole idea.

## R-042 — The soft peach-and-blue theme on the type-first opening; the headline lost among things ^R-042

**Rejected (in doubt):** 2026-10-08, founder, on the type-first opening (home v8): *"Bro, our idea is fire. Now, the
colour… I think I'm a bit confused because I don't like the theme, and also 'never lose a lead because you forgot
to follow' is a bit like hiding from all these things. We have to do something, like organise it in another way."*
**What:** the A-108 soft wash (peach, blue and rose together) as the opening's colours, and the stacked layout
where the headline, the box and the full stream all compete on one screen. The idea itself (A-109, A-110) is not
in doubt: "our idea is fire".
**Asked:** what bothers him about the colours (too many, too pale, wants dark) → *"Not sure, show me"*; how to
organise the first screen → *"Show me options"*. So no principle is recorded yet; the options page answers it.
**Inferred, marked inferred:** three hues at once reads as a theme, not a brand; the headline needs room to be the
hook (his comment earlier the same day: the hook first, the box second).

## R-043 — The all-green theme (green blocks, green italics, green-family touches) and the letter everywhere ^R-043

**Rejected:** 2026-10-08, founder, on home v11 with five references (Ruul, Table22, Harmoniq, Lunora, Aethera):
*"we don't have to use that whole letter theme everywhere. Just for one part… this greenish touch is not something
that I'm looking for because we can't use the whole green theme. I don't like it. We have to make it a professional
theme. Not just the all-go green."*
**What:** green as the main colour across the page (Leaf/Sage/Emerald blocks, green headline italics, lime and sage
touches) and the postmark stamped on the live demo card.
**Principle (from his references, inferred and marked so):** professional = a neutral page (off-white, ink, grey
second lines), black buttons, one strong image or dark panel with the product floating on it, and accents so small
they are almost absent (Ruul's single lime pill). Colour is rare; it does not carry the page.
**Supersedes:** A-116 (green as the main colour), A-113/A-114's green blocks. Green stays only as the app's meaning
("sent").

## R-044 — Theme v4, the professional neutral page (paper, ink, black buttons, one dark panel) ^R-044

**Rejected:** 2026-10-08, founder, on https://claude.ai/artifact/4nhihQ1jNDy8w5e97PgX4E v12: *"i dont like it"*.
**What:** paper `#F4F3EF` everywhere, grey second lines, black buttons, a near-black panel for the live flow, the 7×
card, the "1 minute" envelope and the close; colour only as meaning; one lime pill.
**Reason:** not given; asked which part (see the next design-decisions entry). *Inferred, not confirmed:* with the
green gone and no imagery yet, the page lost its warmth and reads flat and dark, the opposite of the references he
sent, whose colour comes from one strong human image.

## R-045 — AI-generated images, of any style ^R-045

**Rejected:** 2026-10-08, founder, while three AI example images (painted, cinematic, owner portrait; ElevenLabs)
were being placed: *"I don't want any AI images. Arts are good, but not AI."* The examples were never published.
**Rule:** no AI-generated imagery on FollowUp's site or product. Art is welcome when it is made by people: licensed
or public-domain artwork, commissioned illustration, real photographs of real owners (with permission).
**Inferred, marked inferred:** a product that writes in your words cannot show faked people or faked art; it reads
as fake and costs trust (brand principle 1).

## R-046 — One trade's photo as the page's photo ^R-046

**Rejected:** 2026-10-08, founder, on home v13 (café photo behind the live demo): *"now I feel like I'm building this
for a cafe"*. The look itself was liked (A-119).
**Principle (his words plus `PRODUCT_DIRECTION.md`, "Who it's for", 2026-09-26: examples mixed so no reader thinks
"this is for plumbers only"):** one business's photo makes FollowUp read as a tool for that business. Imagery must
be mixed across trades or show no trade at all. The café was also a mismatch: none of the demo's customers is a café.

## R-047 — Rows of messages flowing around the headline (home v14) ^R-047

**Rejected:** 2026-10-08, founder: *"those rows that are just flowing … on the top and at the bottom of that page. I
don't like that format. We'll be using that moving structure with the companies that will be using this or the
reviews that we are getting … Let's create something else so that it justifies our product."*
**Principle (his words):** a moving band reads as social proof (logos, reviews), so it is kept for that and not used
to explain the product. The band waits for real customers and real reviews: no invented logos or quotes (A-023).

> **EXCEPTION (2026-10-09):** the founder asked for a moving band of what FollowUp does in place of the "Start free" row
> after the follow-ups (thread b589f2df, A-188). That one band is allowed. The rest of this rule stands: no other
> explanatory bands, and reviews or logos only when real.

## R-048 — A photo that changes with each customer or visitor ^R-048

**Rejected:** 2026-10-08, founder, on the proposal to change the photo with each example customer: *"leave this
concept: whoever will come, if the cafe owner comes, it will become a cafe. No, we need just one."*
**Rule:** one photo for everyone; with R-046 it shows no single trade.

## R-049 — A photo filling the whole demo block ^R-049

**Rejected:** 2026-10-08, founder, on v13: *"For the opening one, we don't want to use whole photos like these
pictures. I just want it to be used like Wispr Flow does."*
**Principle (from our Wispr teardown, which matches his words):** Wispr puts photos inside a framed photo card (big
corners, the product floating on it), never as the background of a whole section. A-119's treatment still applies.

## R-050 — The brown (walnut, caramel, espresso) colours of v13–v15 ^R-050

**Rejected:** 2026-10-08, founder: *"brown looks good but not professional"*. Supersedes the colour half of A-119.
**Principle (his words):** warm and pleasant is not enough; the colour must read professional.

## R-051 — The thrown-and-caught messages animation (home v16) ^R-051

**Rejected:** 2026-10-08, founder: *"The animation that we're using, the example that you have added as a video kind
of thing, is not even close. Just remove the whole thing. I'll be telling you what we're going to do. Keep it plain
for now."* Removed in v17. Do not rebuild a version of it on a guess: he will describe what he wants.
*Inferred, not confirmed:* the idea (messages arriving from everywhere and being held) still stands (A-120); the
execution (a white list catching chips) did not match what he pictured.

## R-052 — Screen one and the demo feeling like two separate pages ^R-052

**Rejected:** 2026-10-08, founder: *"when I'm scrolling up to try it myself, the page feels like they both are
different pages, and it is not attached. Do something that feels connected… After getting the eyes on the opening
page, we should directly hop into the Try It Yourself one."* The cause was the slide-over: screen one pinned while
the demo block slid over it, plus a gap screen in between. Supersedes the "two screens" part of A-112.

## R-053 — The letter idea anywhere on the page ^R-053

**Rejected:** 2026-10-08, founder: *"keep that letter thing out. We just need to show them that reducing the reply time
and following up with everyone can save their potential clients and help them to close more deals."* Removed in v25.
Supersedes A-117 entirely. **Principle (his words):** the page argues one thing: faster replies plus following up with
everyone keep leads and close deals.

## R-054 — Several blur styles (tilt-shift, zoom, ribbed glass) ^R-054

**Rejected:** 2026-10-08, founder, on v24: *"don't use all these blurs. Just use motion blur… A little bit, not that
much."* Rule: one light motion blur on the photos.

## R-055 — A demo that explains too much (flip, typed follow-ups, notes, sub-labels) ^R-055

**Rejected:** 2026-10-08, founder, on v25: *"now we made it very complex. Let's just show this: 1. caught 2. answered
3. followed up 4. booked 5. won. Don't make it very complicated. We'll explain it further on our website."*
**Principle (his words):** the demo shows the five steps and nothing more; detail belongs further down the page.

## R-056 — Cards that turn or flip in 3D as they move ^R-056

**Rejected:** 2026-10-08, founder, on the demo's middle card: *"Do not flip this. It looks very odd."* Supersedes the
matte-3D tilt of A-113 for the demo's cards; they slide flat.

## R-057 — Brown and taupe everywhere (the stone frames and the warm beige ground) ^R-057

**Rejected:** 2026-10-09, founder: *"I'm not liking that brown theme everywhere"* and *"we don't want that brownish
theme too."* The taupe gradient frames behind the product (Today, How it works, the thread, the switch) and the warm
#F4F3EF page read as brown. **Instead:** blurred green photos (A-132) and a neutral, faintly green page (#F4F5F3).
Same family as R-050.

## R-058 — The peach-and-blue wash ^R-058

**Rejected:** 2026-10-09, founder: *"use a different colour instead of peach and blue. That gradient looks way odd. It
is good, but not what we are looking for. It should match with our theme of the app."* **Instead:** the app's own
soft green (#DCF5E5 family) on white for written replies. Supersedes A-032 on the website.

## R-059 — White or plain icons among colourful logos ^R-059

**Rejected:** 2026-10-09, founder: *"These white logos look odd between all these colourful ones."* Every channel in
the "From" bar is in colour: Outlook in Outlook blue, text messages a green bubble, the website form an orange form.

## R-060 — Sections that only tell: "boring written information", "low effort", "2D" ^R-060

**Rejected:** 2026-10-09, founder, on four sections at once (the cold-lead facts, the 11 PM sentence, "It checks in",
and the page in general): *"It feels boring, so I don't want to read this information"*, *"We don't want to keep the
whole page like a 2D model with boring written information"*, *"It feels like it's very low effort."*
**Principle:** every section shows its point with something to look at or play with (a clock you drag, a week that
plays, photo cards), and the words shrink to labels. A paragraph or a fact list on its own is not a section.

## R-061 — Everything oversized ^R-061

**Rejected:** 2026-10-09, founder: *"I don't know why this whole page is too big."* Headings, spacing and the scroll
length were too large for a laptop. v32 brought the section headings to at most 60px, the hero to 82px, and cut the
empty space. **Inferred:** size, not length alone — to confirm if it still feels big.

## R-062 — The same person and trade in every section ^R-062

**Rejected:** 2026-10-09, founder: *"see same name and same industry"*, and on the cold-lead card: *"be more specific,
we should be using different examples every time."* **Instead:** each section has its own person and trade (mixed
examples, as PRODUCT_DIRECTION already asks), and repeating examples rotate.
**Said again:** 2026-10-09, founder: *"use a variety of names, not just Priya."* One name on several sections is the
same failure. v40 keeps any one name to one place on the page (Priya only in the hero's rotation).

## R-063 — Defensive wording about data and AI ^R-063

**Rejected:** 2026-10-09, founder, on "It gets better every week": *"This is sounding like I'm defending."* Say what it
does, positively ("It learns your business", "What it learns stays yours"); the plain data promises live once, in the
data panel.

## R-064 — The ring of logos at the close ^R-064

**Rejected:** 2026-10-09, founder: *"The circle theme looks very odd. Can we improve this with something that looks more
familiar for them? It's too bold and thingy. We can change the concept too."* The eight channel logos on an orbit
around an "Every one answered" badge (v34–v39). **Principle (inferred, marked inferred):** an abstract diagram asks the
visitor to decode it; owners trust what they already recognise from their own day. Show the thing itself (messages
arriving, each answered), not a symbol of it. **Instead:** v40's stack of message notifications.

## R-065 — Dark olive photo panels (brown, again) ^R-065

**Rejected:** 2026-10-09, founder, on the whole page: *"Again, we are not using this dark brown theme. Can we just reduce
this?"* The green-toned photos kept the warm buildings of the originals; darkened under a green-black veil they read
olive, which reads brown (R-050, R-057). Ten of the page's panels were dark photos, plus a dark close. **Principle:** take
the warm colour out of a photo before toning it, and keep dark panels few (the demo, the cold-lead panel, the night, the
control and data panels in v40); the rest of the page is light.
**PARTLY SUPERSEDED (2026-10-09)** by [[approved#^A-138|A-138]]: the cool grade stays, but in light mode the photo panels go
back to dark; the light grade is kept for a dark-mode page.

## R-066 — The full-width bar ^R-066

**Rejected:** 2026-10-09, founder, on the header: *"It feels too 2D, like it's very '90s design. Let's get our references
out here."* A pale capsule stretched across the whole screen with the items spread to its ends. **Instead (v40):** a
short floating bar that hugs its contents, centred, lifted by a plain shadow (no shine, R-036), showing which part of
the page you are in.

## R-067 — Sections that read like separate pages ^R-067

**Rejected:** 2026-10-09, founder: *"Let's try to keep connecting all the pages when we are scrolling. It's like we're just
scrolling a regular PDF."* Every section was the same template (heading left, line right, one framed picture) with a big
gap and nothing carrying from one to the next. Same family as R-052. **Instead (v40):** one thread down the page that
fills as you read, pictures that settle in as you arrive, smaller gaps, no hard switch to dark at the end.

## R-068 — The short floating capsule bar (v40) ^R-068

**Rejected:** 2026-10-09, founder, minutes after R-066's fix: *"Now this looks way odd. Let's just fix this to Wispr
Flow, maybe."* The centred capsule that hugged its contents. **Instead (v42):** a plain row with no box (brand left,
links centred, Sign in and Start free right) that gains a soft see-through ground and a hairline only once you
scroll. **Lesson (inferred):** both capsules (wide and short) read as a widget sitting on the page; the references
he likes keep the bar quiet and part of the page.

## R-069 — A thread line down the side to "connect" the sections ^R-069

**Rejected:** 2026-10-09, founder, on v40: *"this bar that we have added on the left side doesn't mean we are connecting
every single page. I just meant to add transitions when we are changing the concept or the information… we should use
different templates too for every other thing."* **Instead (v43):** no line; each new topic arrives as a sheet sliding
over the last (A-139), and sections use different layouts. **Lesson:** "connected" meant *transitions between ideas*,
not a device that links them; and sameness of layout was half of the "PDF" feeling (R-067).

## R-070 — A reply-time demo that waits for clicks ^R-070

**Rejected:** 2026-10-09, founder, on "How fast do you reply?" (five buttons): *"They will be clicking on everything,
so can we just use animation or something to make them feel like faster replies are the best one?"* **Instead (v43):**
the times play on their own (a bar fills as time since the customer wrote runs out, the customer cools, the odds
fall), then it snaps back to "1 minute · With FollowUp"; a tap takes over. Note the earlier swing (a self-playing
slider read as "just playing", v34): what works is motion that is *labelled* (time visibly passing), not motion alone.

## R-071 — Grain texture on the photo blocks ^R-071

**Rejected:** 2026-10-09, founder, on the demo block under "Try it yourself": *"It's too grainy. It doesn't match the
background."* The SVG noise layer over the stage photo. **Instead:** smooth blurred photos only; frosted strips where
controls sit on a photo, the same glass as the demo panel.

## R-072 — The v44 patterns (pinstripes, dot grid, side hatching) ^R-072

**Rejected:** 2026-10-09, founder, minutes after asking for "a Granola kind of thing… stripes and different designs in
the background": *"Not these ones, bro. I will send you examples later."* Removed in v45. **Inferred (marked
inferred):** what he means by Granola's "stripes and designs" is its art: collage panels and drawn lines inside images,
not a texture laid over the page ground. Wait for his examples before drawing patterns again.

## R-073 — Sections that overlap like sliding sheets (v43) ^R-073

**Rejected:** 2026-10-09, founder: *"Don't use that thing that overlaps each page. That feels very odd. Just try to
connect like… how Granola connected its pages while scrolling and animations… remove that thing."* The rounded,
overlapping sheets of A-139 (the per-topic layouts stay). **Instead:** wait for the Granola captures and copy its
*technique* for hand-overs between sections.

## R-074 — Grey photos (the v40 grey-sage grade) ^R-074

**Rejected:** 2026-10-09, founder: *"I've told you to use the dark pictures, not just the black and white. It should not
be that very dark, but it should be colourful… the city pictures."* The desaturated cool grade read as black and white.
**Instead (v47):** each city photo rebuilt from its original in its own colour, a little darker, nudged slightly cool
so warm walls don't go brown (A-143).

## R-075 — The "missed, then caught" message cards around the headline (v42) ^R-075

**Rejected:** 2026-10-09, founder: *"We should not show this. This doesn't make any sense, but it is good that we are
showing messages. Keep it very light in the background, with blur, and keep it kind of moving."* Six readable
notification cards that went from "No reply yet" to "✓ Answered". **Instead (v50):** the same messages as soft,
blurred, light cards drifting slowly behind the headline, with no statuses or times. Not the scrolling rows of R-047:
each floats on its own.

## R-076 — Hand-drawn ink and paper notes (v55) ^R-076

**Rejected:** 2026-10-09, founder: *"I think we should remove the scribble"*; asked which, he chose **all the ink**. Gone:
the two paper notes (a light-green ticked list, an off-white clock at 11:04) on the demo's corners and above the closing
card, the curly ink arrow to the try-it box, and the ink underline under "Answer every one." **Inferred principle
(inferred):** Granola's hand-made print material doesn't translate to FollowUp; on our page it reads as decoration, not
as calm or trust. Learn from Granola's motion and explaining, not its artwork. Don't re-propose scribbles, doodles,
sketched icons or paper collages in another form.

## R-077 — The demo as a Mac app window (v62) ^R-077

**Rejected:** 2026-10-09, founder: *"you have changed the whole concept… You are showing the Mac or the iOS thing, the
red, green, and yellow button… but this is not our actual dashboard that we're going to be building."* The window
chrome, sidebar and conversation list. **Principle (his words):** the demo shows our product, not an imitation of
another app; make the familiar feel come from details, not from a borrowed window.

## R-078 — App logos in the footer ("Works with") (v54) ^R-078

**Rejected:** 2026-10-09, founder: *"'works with' should not mention logos and stuff. We'll be putting our handles here."*
The row of eight app tiles in the footer. **Principle (inferred):** the ending is about FollowUp itself (its links, its
people, its profiles), not other companies' brands; the channels are shown where the product works, not as a logo wall.

## R-079 — Taking money from a floating message (v65–v81) ^R-079

**Rejected:** 2026-10-09, founder: *"you're collecting the money from them. Why?"* Floating lead messages that turned into
"$X lost / $X saved" notes, "−$X" and "+$X" tokens, or added a deal and its value when they glided into the strip.
**Principle (inferred):** a lead's message is a person writing, not a coin; showing money pulled out of people's
messages reads as greedy, close to the "aggressive sales" look FollowUp must never have. Money belongs in an explained
example (the strip, the won job in a story), not in the ambient background.

## R-080 — The try-it box moved wholly inside the dark demo (v81) ^R-080

**Rejected:** 2026-10-09, founder: *"Did you try it yourself here? No… I want them to click it right away… half on the
screen, half above… it was making me curious."* Moving the box below the fold to separate the two screens. **Principle
(his words):** the first thing to try must be visible on the first screen; separate screens with space, not by pushing
the action away.

## R-081 — Floating messages so slow they look stopped (v81) ^R-081

**Rejected:** 2026-10-09, founder: *"you stopped the messages that were just floating."* Drift of ±34 px over 20–34 s.
**Principle:** "quiet" means faint and smooth, not still; the background has to read as alive.

## R-082 — Three big statistic cards (nearly 7×, over 60×, 21×) (v82) ^R-082

**Rejected:** 2026-10-09, founder: *"I still don't understand the idea behind this… it's too much, and I don't think
anybody is going to watch this or scroll through this for this information."* Three large figure cards with captions
under a "1.25 million leads" line. **Principle (his words, generalised):** visitors won't study numbers; say "fast
replies win" with one picture of the gap and the pain, and keep the proof to one sentence.

## R-083 — A nine-step chat timeline with a warmth meter (v82) ^R-083

**Rejected:** 2026-10-09, founder: *"It is vague and too complicated. I'm not trying to even read this thing… I don't want
them to stress and read the whole stuff out to understand a simple logic."* Marcus's story as nine timed rows of chat
bubbles with a "How warm Marcus is" bar. **Principle (his words):** a simple logic must be understood without reading;
if it needs a list of messages, it is too much.

## R-084 — A flat dark gradient in place of the photo panels (v89) ^R-084

**Rejected:** 2026-10-09, founder: *"this gradient thing looks very odd. The photos were looking very premium."* The deep
green radial gradient replacing the photo panels (Today frame, How it works pictures, Your control, the data card,
What's new, the closing card). **Principle (his words):** the blurred photos are what make the page feel premium; a
gradient reads as cheap next to them. Dark panels carry a photo under a dark veil (the follow-up card now too), never
a bare gradient. Also no to "cheap gradients" in CLAUDE.md.

## R-085 — An explanatory sentence under the headline (v89) ^R-085

**Rejected:** 2026-10-09, founder: *"It looks too informative. It should be straight to the point."* "FollowUp has a reply
ready for every new enquiry in a minute, in your words, and follows up until they book." **Instead:** "A reply in a
minute. Follow-ups until they book." **Principle:** the line under the headline is a punch, not a description.

## R-086 — "Reply in a minute" as the promise (v85–v92) ^R-086

**Rejected:** 2026-10-09, founder: *"'Reply in a minute' is not what we are aiming for. If we reply in a minute, it will
sound like AI."* Any copy that sells speed in minutes ("in a minute", "1 minute", "1 min"). **Instead:** the right reply at
the right time, a natural gap while the customer is still looking. Facts about replying within the hour can stay.

## R-087 — A founder quote on the home page (v89) ^R-087

**Rejected:** 2026-10-09, founder: *"What is this, bro? Sahil, founder of FollowUp? Why?"* A centred quote from his
product notes signed with his name. **Principle (inferred):** the page speaks as FollowUp, not as a person; no founder
signature or quote unless he asks.

## R-088 — Statistics in the opening (v66–v92) ^R-088

**Rejected:** 2026-10-09, founder: *"I don't know why you're saying 'in a test of 1,300+ law firms…' Let's just show them
later on. Let's just remove that part."* Any study figure in the first screen. Facts live further down (the gap
picture's one sentence).

## R-089 — The try-it box as one white card (v93–v95) ^R-089

**Rejected:** 2026-10-09, founder (thread da6c7a35): *"This got too bad, bro. Earlier, it was good."*
**What it was:** a serif "Try it yourself" title, a large field with the green edge, light chips and the languages,
all in one white card across the demo's edge.
**Principle (inferred):** the older half-and-half box already worked. Restyling a working, approved element into a
bigger standalone card made it louder without making it clearer. Offer alternatives side by side and let him choose;
never replace an approved element outright.

