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
