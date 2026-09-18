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
