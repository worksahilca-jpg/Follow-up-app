# Badges, pills & indicators

*Not in the original outline; added because §11 of the brief requires badges documented.*

**Principle: a badge carries a single piece of state, in one or two words.** A badge with
a sentence in it is a label. A badge without a word in it is a guess.

## Types

| Type | Purpose | Example |
|---|---|---|
| **Status pill** | The state of an object | "Needs attention", "Not reviewed yet" |
| **Count badge** | How many things need action | "3" on the notification bell |
| **Score indicator** | A computed value with meaning | Lead score (`ScoreBadge.tsx`) |
| **Channel tag** | Where something came from | "Instagram", "Email" |
| **Metadata chip** | A neutral attribute | Assigned owner, tag, source |

## Current state — and a pattern worth preserving

`PriorityPill.tsx` gets something right that most products get wrong, and it's worth
stating as a rule:

> A lead the AI hasn't scored yet shows **"Not reviewed yet"**, not "No action needed".

That's principle 6 (*show the reasoning, not just the verdict*) made concrete: the product
never implies it has looked at something it hasn't. **Preserve this behavior everywhere a
computed state has an unevaluated case.** It is a trust decision, not a copy detail.

## Rules

1. **Always a word.** A colored dot alone is not a status — it fails colorblind users and
   anyone who hasn't memorized the legend.
2. **Status colors are semantic** (`brand/color-system.md`). Never a badge in the brand
   accent — the accent means interactive, and a badge is not clickable.
3. **Soft background, saturated text** — the existing pattern. Never a saturated fill with
   white text for status; it's too loud and reads as an alert.
4. **One or two words.** Longer means it belongs in the content.
5. **A badge is not a button.** If it's clickable, it's a filter chip and must look
   interactive.
6. **Count badges only for things needing action.** (See `notifications.md`.)
7. **Don't stack badges.** Three pills in a row on a lead card is unresolved hierarchy —
   pick the one that matters.

## Score indicators

FollowUp shows a computed lead score. Scores are uniquely easy to design badly:

- **Never show a score without its reason** available immediately (principle 6). A number
  with no explanation is either obeyed blindly or ignored — both failures.
- **Never imply false precision.** If the model is approximate, "87" claims more than it
  knows. `[TO DECIDE]` — bands ("Likely to buy" / "Warm" / "Quiet") may be more honest and
  more actionable than a number. Worth real design work.
- **Never color a score on a continuous gradient** — red-to-green heat coloring is
  imprecise, inaccessible, and anxiety-inducing.
- **Always distinguish "not scored yet"** from "scored low". As above.

## Open decisions

- `[TO DECIDE]` Score as a number vs. bands.
- `[TO DECIDE]` Badge sizes — probably one, possibly two.
- `[TO DECIDE]` Channel tag treatment — text, official mark, or both.
- `[TO DECIDE]` Whether `ScoreBadge` and `PriorityPill` should share one primitive.
