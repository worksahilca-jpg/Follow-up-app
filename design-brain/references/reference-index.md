# Reference library — index

The reference library is where inspiration becomes **usable design intelligence**.

A screenshot in a folder is worthless. A screenshot with an analysis of *why it works*,
*what principle it demonstrates*, and *what FollowUp must not copy from it* is an asset
that improves every future design decision.

**The rule that makes this library valuable: nothing is stored without analysis.**

---

## How to add a reference

### 1. Drop it in the right category folder

| Folder | What goes here |
|---|---|
| `dashboards/` | Overview screens, metrics, at-a-glance status, home screens |
| `crm/` | Lead/contact lists, pipelines, records, tables, filtering, bulk actions |
| `messaging/` | Inboxes, threads, composers, conversation UI, notifications-as-messages |
| `onboarding/` | Signup, setup, connection flows, first-run, empty-to-full journeys |
| `navigation/` | Sidebars, information architecture, search, command palettes, wayfinding |
| `mobile/` | Anything mobile-specific — responsive behavior, touch patterns, native feel |
| `animations/` | Motion, transitions, micro-interactions, loading, state change |
| `landing-pages/` | Marketing sites, pricing, positioning, trust signals |
| `design-systems/` | Token systems, component libraries, documentation approaches |

If a reference fits two categories, file it where its *most useful lesson* lives and
cross-link from the other.

### 2. Create a note file next to it

Filename: `YYYY-MM-DD-source-short-description.md`
Example: `2026-09-14-linear-issue-list-density.md`

Images go beside the note with a matching name (`2026-09-14-linear-issue-list-density.png`).
For a URL or video, the note file is the whole reference — record the link and, because
links rot, describe what it showed in enough detail to survive the link dying.

### 3. Fill in the template

Copy `_reference-template.md`. Every field. A half-filled reference is worse than none
because it looks analyzed and isn't.

---

## The template fields, and what they actually mean

| Field | What it's for | How to not waste it |
|---|---|---|
| **Name** | Identifying it later | Specific: "Stripe payment-status table", not "Stripe" |
| **Source** | Where it came from | URL, app + version, or "screenshot from founder" |
| **Category** | Which folder | One primary |
| **What is interesting** | The observation | Describe what you *see*, not how you feel about it |
| **UX principle** | The transferable lesson about behavior/flow | Must generalize beyond this screen |
| **Visual principle** | The transferable lesson about form | Hierarchy, spacing, restraint — not "nice colors" |
| **Interaction principle** | The transferable lesson about response | What happens on click/hover/load/fail |
| **What FollowUp could learn** | Applied to *our* users and *our* problem | Name the FollowUp screen it would improve |
| **What FollowUp should NOT copy** | The guardrail | **Never leave blank.** There is always something. |
| **Possible FollowUp application** | A concrete idea | A specific screen and a specific change |
| **Status** | Where it sits in the pipeline | See below |

**The two fields that do the real work** are *What FollowUp should NOT copy* and *UX
principle*. The first prevents the library from turning into a plagiarism folder. The
second is the difference between "Linear looks good" and "Linear's list density works
because every row has exactly one primary action and the rest are revealed on hover."

---

## Status lifecycle

```
INBOX  →  REVIEWED  →  APPROVED  →  (used in design)
                    ↘  REJECTED
                    ↘  ARCHIVED
```

| Status | Meaning |
|---|---|
| `INBOX` | Captured, not yet analyzed. Fine to have many. |
| `REVIEWED` | Analyzed and written up, awaiting the founder's judgment |
| `APPROVED` | The founder confirmed this direction is right for FollowUp. **Claude may draw principles from it freely.** |
| `REJECTED` | Considered and deliberately declined. **Do not draw from it.** Record why in the note *and* in `decisions/rejected.md` if it implies a general rule. |
| `ARCHIVED` | Was relevant, no longer is — superseded, or the product moved. Kept for history. |

**Only `APPROVED` references carry design authority.** A `REVIEWED` reference is an input
to a conversation, not a justification for a decision.

---

## Rules for using references

1. **Never copy an interface.** Extract the principle, build something original. If the
   result is recognizable as the reference, start over.
2. **Reference the principle, cite the source.** When a design decision comes from a
   reference, note it in `decisions/design-decisions.md`: *"list density follows the
   principle in `references/crm/2026-09-14-….md` — one primary action per row."*
3. **A reference is evidence, not an argument.** "Stripe does it" is not a reason.
   "Stripe does it, and here's why it works for a user in our situation" is.
4. **Beware the context mismatch.** Linear's users are engineers who live in the tool all
   day. FollowUp's user is an owner with 90 seconds on a phone. A pattern that's excellent
   for the first can be hostile for the second. **Always ask: does this reference's user
   look like ours?**
5. **Beware survivorship.** Beautiful screenshots circulate; the ones that tested badly
   don't. A gorgeous reference may have failed in production.

---

## Current state

**No longer empty as of 2026-09-13.** A first research pass added four files:

- `landing-pages/2026-09-13-competitor-landing-page-research.md` and its companion
  `landing-pages/2026-09-13-followup-synthesis-and-recommendation.md` — headline patterns,
  content order, social proof, and pricing presentation across Structurely, Ylopo, Artisan
  AI, Podium, Housecall Pro, HubSpot, Close, Pipedrive, Linear, Vercel, and Stripe.
- `dashboards/2026-09-13-crm-and-adjacent-dashboard-research.md` — "what needs me right
  now" patterns across HubSpot, Linear, Close, Follow Up Boss, and Attio.

All four are **REVIEWED**, not **APPROVED** — they haven't been walked through with the
founder yet, so they're an input to a design conversation, not design authority to draw
from unilaterally per the status lifecycle above. Every source in these four files was
reached via WebSearch, not a direct WebFetch render (WebFetch is blocked in this sandbox,
confirmed against multiple unrelated domains) — see the sourcing note at the top of each
file before treating a quote as verbatim page copy.

Before this pass, the library was empty — references come from the founder ("I like
this"), from purposeful research (see `workflows/research-workflow.md`), or from a real
design problem that needs prior art. Fabricating a reference library from memory —
describing screens that may have changed or may never have existed — would poison every
decision downstream; the four files above were built from search citations for exactly
this reason, not from training-data memory of what these products "probably" look like.
