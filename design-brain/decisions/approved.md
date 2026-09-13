# Approved decisions

**What the founder has said yes to.** Claude follows these. Deviating from an entry here
requires asking first — consistency with an approved decision beats a new better idea,
because the founder's time is the scarce resource, not ideas.

## How to add an entry

Append to the end. Never rewrite history. Use this shape:

```
## A-00N — [Short title]
**Date:** YYYY-MM-DD
**Scope:** [screen / component / system-wide]
**Approved:** [exactly what was approved — specific enough to reproduce]
**Why it was liked:** [the founder's words if given; your inference marked as inference]
**The generalizable principle:** [what this implies for future, unrelated designs]
**Applies to:** [where this constrains future work]
**Evidence:** [file path, screenshot, PR, or conversation date]
```

**The field that matters most is "the generalizable principle."** "The founder liked the
lead card" helps nothing. "The founder liked that the reason for the score sat directly
under the score, in plain language, without a tooltip" shapes twenty future screens.

## Rules

1. **Record it in the session it happens.** Feedback not written down is feedback lost.
2. **Record specifics, not vibes.** If you can't say what was approved precisely enough
   for another session to reproduce it, ask a clarifying question before writing.
3. **Mark inferences as inferences.** If the founder said "yes, that one" without a
   reason, write the reason as `INFERRED —` and be prepared to be wrong.
4. **Superseding, not deleting.** When a later decision overrides an earlier one, mark the
   old entry `SUPERSEDED (YYYY-MM-DD) → A-0NN` and leave it in place.
5. **An approval is scoped.** Approving a card layout on the dashboard doesn't approve it
   everywhere. Say what the scope is.

---

## Decisions

## A-001 — Split the accent into a fill token and a text token; darken the four status shades ^A-001
**Date:** 2026-09-12
**Scope:** System-wide — `followup/src/app/globals.css` and six call sites
**Approved:** The founder said "go" to the proposed contrast fixes. Two changes:
1. `--accent-text: #8a5a08` added as a **separate token for accent-colored text and
   functional icons**. `--rust` (`#e8a23a`) stays the fill/border/focus-ring/logo token.
   Six text call sites moved to the new token.
2. The four status shades darkened until each clears 4.5:1 on its own soft background:
   `--coral` `#dc2626`→`#ca2323`, `--gold` `#d97706`→`#a35904`,
   `--sage` `#16a34a`→`#117c38`, `--slate` `#64748b`→`#5f6e84`. Hues unchanged.
**Why it was liked:** Presented as measured WCAG AA failures rather than taste — the amber
accent read 2.17:1 as text (1.77:1 in the Sidebar chip), and all four status pills failed
at their 12px size, gold worst at 2.86:1.
**The generalizable principle:** **A fill color and a text color have opposite contrast
requirements, so one token cannot serve both.** Any light accent needs a darker sibling for
text, and any "soft tint + saturated text" pill pattern must be measured at the size it
actually renders — 12px counts as normal text and needs 4.5:1, not the 3:1 that "large
text" allows. Eyeballing low-saturation pairs reliably fails.
**Applies to:** Every future use of an accent or status color. Never use `--rust` as text.
Never introduce a soft/saturated pair without measuring it.
**Evidence:** `design-brain/[[color-system]]` (full audit table), [[design-decisions#^D-005|D-005]] below.

---

## A-002 — Unify the whole app on the "Award Direction" navy/blue system ^A-002
**Date:** 2026-09-13
**Scope:** System-wide — every authenticated-app page, `/signin`, and the landing page all
converge on one visual system (navy `#0b1f33` / blue `#2a5cdb`, Bricolage Grotesque + Public
Sans + IBM Plex Mono — currently `landing-award.module.css`, to be promoted into
`globals.css` as the app-wide baseline). Retires the warm-cream/amber system entirely.
**Approved:** Given a direct choice between reskinning the app to match the landing page's
navy/blue direction, or reverting the landing page back to the app's existing cream/amber,
the founder chose to move the app: "Reskin the app to navy/blue."
**Why it was liked:** The founder's own framing was that the landing page ("our landing
page is cool") should be the standard the rest of the product is judged against, not the
other way around — the internal app pages read as dated *by comparison* to it.
**The generalizable principle:** When a page-scoped design experiment reads as better than
the system it deliberately diverged from, that's a real signal the system should move, not
a violation to correct by reverting the experiment. Don't assume the older, more broadly
shipped system is the anchor by default.
**Applies to:** Supersedes [[approved#^A-001|A-001]]'s cream/amber baseline (the underlying contrast-fixing
*principle* in [[approved#^A-001|A-001]] still applies, just against the new navy/blue values — see [[design-decisions#^D-010|D-010]]).
Every future screen designs against Award Direction's tokens, not `globals.css`'s retired
cream ones.
**Evidence:** This conversation, 2026-09-13. See `[[design-decisions]]` [[design-decisions#^D-010|D-010]] for the full
reasoning and implementation plan.

---

*Note: the cream/amber UI documented in `[[color-system]]` and
`[[visual-direction]]` as of 2026-09-12 is now SUPERSEDED by [[approved#^A-002|A-002]] above — those files
need updating to describe Award Direction's navy/blue values as the real baseline once the
app-wide reskin ships. Until then, treat their "current values" sections as historical, not
current.*
