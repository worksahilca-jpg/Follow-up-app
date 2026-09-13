# Typography

**Principle: hierarchy comes from size, weight, and space — not from color, boxes, or
decoration.** If you need a colored label to make something feel important, the type
hierarchy has failed.

---

## Current state — decided, 2026-09-13

- **Three families, product-wide, one system: Bricolage Grotesque (display/headings),
  Public Sans (body), IBM Plex Mono (eyebrows/labels/mono meta text)**, loaded via
  `next/font` in `followup/src/lib/fonts.ts`, exposed as `--font-display`, `--font-body`,
  and `--font-mono`. Promoted from the landing page's page-scoped "Award Direction"
  typography (originally a CEO-approved exception, D-008) to the whole product in
  D-010/A-002 — see `decisions/`.
- Headings (`h1, h2, h3, .font-display`): weight `600`, letter-spacing `-0.02em`, set in
  Bricolage Grotesque.
- Body: Public Sans, regular weight, Tailwind's default sizing applied ad hoc.
- Small uppercase labels/eyebrows: IBM Plex Mono via `.font-mono`, opt-in, not global.
- **The authenticated app and the marketing pages now use the same typeface family.** The
  previous split (Inter in the app, Fraunces as a display serif on the landing page) is
  gone, as is the Inter/Space Grotesk pairing before it, and as is the single-family
  Plus Jakarta Sans era that preceded this one.

**This is the right call and worth stating as a principle, not just a fact:** a visitor
and a signed-in customer should feel they are in one product. A marketing page with its
own typeface reads as a brochure attached to a different application.

**Note that the typeface has changed multiple times now** (Inter + Space Grotesk →
Fraunces on landing → Plus Jakarta Sans everywhere → Bricolage Grotesque/Public
Sans/IBM Plex Mono everywhere). Unlike the earlier changes, this one followed an actual
founder decision (A-002) rather than drift — it was decided alongside the color system,
as one visual-identity change, not two. It should now hold.

## Rules

1. **One family in the product.** A second family inside the authenticated app requires an
   explicit decision and a reason beyond "it looks nice." Marketing surfaces may differ.
2. **A small scale, used strictly.** Every size in the interface must come from the scale.
   An arbitrary `text-[15px]` is a bug.
3. **Readable floor: 14px for anything a user must read.** 12px is permitted only for
   genuinely secondary metadata (timestamps, pill labels) and never for content, never for
   error messages, never for anything a decision depends on. Below 12px: never.
4. **Line height scales inversely with size.** Long-form/body ~1.5–1.6; headings ~1.1–1.25.
5. **Tracking:** negative on large headings (as shipped, `-0.02em`), normal on body,
   slightly positive on all-caps micro-labels (which should be rare).
6. **Weight carries hierarchy, not color.** Two weights (regular, semibold) handle almost
   everything. A third is a decision, not a default.
7. **Measure: 60–75 characters** for reading text. Full-width paragraphs in a settings
   panel are a readability bug.
8. **Numbers in tables and metrics use tabular figures** (`font-variant-numeric:
   tabular-nums`) so columns align and count-ups don't jitter. `[TO DECIDE]` — not
   currently applied anywhere; it should be.
9. **Never justify. Never letterspace lowercase body text. Never all-caps a sentence.**
10. **Sentence case for everything** — headings, buttons, labels, nav. Title Case reads
    corporate and dated; ALL CAPS reads like shouting or a form from 1998.

---

## The scale `[TO DECIDE]`

The app currently uses Tailwind defaults ad hoc (`text-sm`, `text-3xl`, `text-lg`) rather
than a named, intentional scale. That's the real gap — not the values themselves.

A proposed starting shape, to be decided with real screens rather than in the abstract:

| Role | Size | Weight | Line height | Used for |
|---|---|---|---|---|
| Display | `[TO DECIDE]` | 600 | 1.1 | Marketing headlines only |
| Page title | ~28–32px | 600 | 1.2 | One per screen |
| Section title | ~20px | 600 | 1.3 | Card and section headers |
| Subheading | ~16px | 600 | 1.4 | Sub-sections, list group headers |
| Body | ~15–16px | 400 | 1.55 | Default reading text |
| Body small | ~14px | 400 | 1.5 | Secondary text, descriptions, table cells |
| Caption | ~12–13px | 400/500 | 1.4 | Timestamps, pill labels, metadata |
| Metric | ~30–36px | 600 | 1.1 | Stat card values (tabular) |

**Decide these together, on a real screen, not in a spreadsheet.** A type scale that looks
right in a specimen and wrong in a lead list is wrong.

---

## Copy voice (typography's other half)

Type quality is half type and half words. The words are part of this system.

- **Plain, specific, short.** "No reply in 6 days" beats "Engagement lapse detected."
- **No jargon.** Not "cadence", "sequence enrollment", "orchestration", "nurture".
  Say "follow-up", "added to a plan", "paused".
- **No exclamation marks** outside a genuine success moment, and rarely then.
- **Never blame the user.** "That didn't send — the number looks wrong" not "Invalid input."
- **Say what happens next.** Every error names the fix. Every empty state names the
  first action.
- **Honest about uncertainty.** "Not reviewed yet" is not "No action needed." The shipped
  `PriorityPill` already gets this right and is the reference example.
- **Never anthropomorphize the AI.** It doesn't "think", "want", or "feel". It scored,
  drafted, sent, or flagged.

---

## Open decisions

- `[TO DECIDE]` Final type scale and whether it's expressed as named tokens
  (`--text-body`, `--text-title`) rather than raw Tailwind classes.
- `[TO DECIDE]` **Ratify Plus Jakarta Sans** so the typeface stops changing. The family
  matters far less than the scale — but the *churn* costs real consistency, and each
  change silently invalidates every screenshot, mockup, and doc that came before.
- `[TO DECIDE]` Tabular figures on metrics and tables (recommended: yes).
- `[TO DECIDE]` Whether one typeface across marketing and product is the permanent rule
  (recommended: yes, make it explicit) or whether marketing may diverge again later.
