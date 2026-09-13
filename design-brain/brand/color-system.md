# Color system

**Principle: color is information, never mood.** If a color on screen doesn't tell the
user something, it shouldn't be there.

---

## The structure (agreed — this shape is the decision)

FollowUp uses **four color roles and nothing else**:

1. **Neutrals** — carry ~95% of the interface. Background, surfaces, borders, text.
2. **One accent** — interactive elements only: primary buttons, links, active navigation,
   focus rings, selected states. Never a decorative fill, never an icon tint outside
   those contexts, never a "brand moment" on a dashboard.
3. **Status colors** — a small, fixed, semantic set. Each color means exactly one thing
   everywhere it appears, forever.
4. **Data-visualization colors** — `[TO DECIDE]`, derived from the above when needed.
   Charts default to neutral + accent; a categorical palette is only introduced if a real
   chart requires one. See `followup/src/components/AnalyticsCharts.tsx` before adding any.

**Why one accent:** a second accent doubles every future decision ("which one here?") and
halves the meaning of both. If something needs to stand out and the accent is taken, the
answer is hierarchy — size, weight, position, space — not another color.

---

## Current values — decided, navy/blue ("Award Direction"), 2026-09-13

From `followup/src/app/globals.css`. **This is the founder-approved baseline** (A-002,
superseding the cream/amber values this file described until 2026-09-13 — see D-010 for
the full reasoning). The accent has changed value multiple times before this one (blue →
violet → amber → this blue); A-002 is the first time a value was actually *ratified* by
the founder rather than drifted into. Barring a future decision, this is where it stops
moving.

### Neutrals — navy ink, cloud-white paper
| Token | Value | Role |
|---|---|---|
| `--paper` | `#f6f8fb` | Page background (cool cloud-white, not warm cream) |
| `--card` | `#ffffff` | Card / raised surface (pure white) |
| `--ink` | `#0b1f33` | Primary text (deep navy, not warm near-black) |
| `--ink-soft` | `#46566b` | Secondary text |
| `--line` | `rgba(11, 31, 51, 0.12)` | Borders, dividers — translucent so it composites correctly on both `--card` and `--paper` from one value |

Two rules already established here are worth keeping: **never pure black on pure white**,
and cards separate from the page by being *lighter* plus a border — separation through
contrast, not shadow. These values are **identical** to the landing page's own
`landing-award.module.css` tokens (`--paper`/`--ink`/`--ink-soft`/`--card`), not just a
similar palette — the whole product (marketing, `/signin`, authenticated app) now shares
one set of values, promoted from what was previously a page-scoped exception.

### Accent
| Token | Value | Role |
|---|---|---|
| `--rust` | `#2a5cdb` (blue) | The accent — fills **and** text (see below) |
| `--accent-deep` | `#17348a` | Darker step of the same blue — hover/active states, gradient endpoints |
| `--rust-soft` | `rgba(42, 92, 219, 0.12)` | Focus-ring halo, active-nav/selected-option fill |
| `--on-accent` | `#ffffff` (white) | Text on an accent fill |

**The `--accent-text` split (A-001/D-005) is gone.** That token existed because the retired
amber was light enough to work as a fill but failed outright as text (2.17:1). This blue
clears AA in *both* roles from one value — 5.40:1 on `--paper` and 5.75:1 on `--card` as
text, 5.75:1 as white-on-fill — so the split was collapsed back into `--rust`, exactly as
D-005's own "Revisit when" anticipated ("If a darker accent is chosen, `--accent-text` may
become redundant and should be collapsed back into `--rust`"). Every call site that used
`--accent-text` now uses `--rust` directly.

**The token name still doesn't match its value** (`--rust` has never held a rust — it has
held blue, violet, amber, and now blue again). This is unchanged from before and still
`[TO DECIDE]`: a mechanical rename to `--accent` across ~90 call sites is worth doing
*once*, but wasn't bundled into this reskin to keep the diff reviewable as "same names, new
values" — the same reasoning the code comments have used for every previous accent change.

**The amber-vs-`--gold` collision this file used to flag no longer applies** — the accent
is blue now, `--gold` (`#a35904`, warm amber) reads as clearly distinct from it, and the
two no longer sit as visual neighbors the way two ambers did.

### Status colors (lead urgency / state)
| Token | Value | Soft | Means |
|---|---|---|---|
| `--coral` | `#b32a44` | `#fbe1e6` | Needs attention now / error / high priority |
| `--gold` | `#a35904` | `#fef3c7` | Caution / needs attention soon (traffic-light amber — a severity step, not a temperature) |
| `--sage` | `#0d6e3c` | `#dcf5e5` | Good / success / no action needed |
| `--slate` | `#56677e` | `#eef1f6` | Neutral / informational / medium |

`--gold` is carried over byte-for-byte from the retired amber system — it already measured
AA-passing and doesn't clash with the new blue accent, so there was no reason to retune a
value that was already correct. The other three were re-tuned for the cooler navy palette:
`--slate` is now a blue-gray (matching the ink family) rather than the old system's
warmer gray; `--sage` and `--coral` were newly measured rather than reused, because reusing
the landing page's own decorative `--coral` (`#c93752`, used there as a 3px card-border
accent, not as 12px pill text) would have shipped a status pill that fails AA — see the
contrast audit below.

Deliberately unchanged through this pass **as a set of meanings**: these four still encode
cold/warm/hot, low/medium/high, and nothing else. Only their exact hues moved, and only to
keep pace with the neutral/accent shift around them.

**The rule that makes this work:** these four are *semantic*, not a palette. `--sage` means
"fine" everywhere — never "the green card." Using a status color decoratively destroys the
system, because once green is decorative, green can no longer mean "fine." (The landing
page's hero mockup uses its own local `--coral` for a "hot lead" demo card border — that's
a legitimate semantic use, same meaning, just the page-scoped value rather than the app's
darker AA-tuned one; the two are intentionally allowed to differ slightly because a 3px
border and a 12px text label have different contrast floors, exactly like `--gold` always
did.)

Pattern in use: soft tint as background, saturated shade as text. Keep it.

## Rules

1. **Accent only on interactive elements.** Buttons, links, active nav, focus rings,
   selected states. Nothing else.
2. **Status colors only for status.** Never decorative.
3. **Color is never the only signal.** Every status color pairs with a label or icon —
   roughly 1 in 12 users can't reliably distinguish red from green. A red dot alone is
   not an accessible error state.
4. **No new color without a new meaning.** Adding a color requires answering: what does
   this mean, everywhere, forever?
5. **Contrast is a hard floor, not a goal.** Body text ≥ 4.5:1, large text and UI
   elements ≥ 3:1 (WCAG AA). Test the actual pairing, including status text on its soft
   background — the low-saturation pairs are the ones that quietly fail.
6. **Never celebrate volume in color.** Messages-sent is not a success metric and never
   gets the success color.

---

## Contrast audit — measured and verified 2026-09-13 (navy/blue reskin)

Computed WCAG 2.1 ratios from the values actually committed in `globals.css`, at the sizes
they actually render (12px `text-xs` pills counted as normal text, not "large text").

| Pair | Ratio | |
|---|---|---|
| `--ink` on `--card` | 16.69:1 | ✅ |
| `--ink` on `--paper` | 15.69:1 | ✅ |
| `--ink-soft` on `--card` | 7.49:1 | ✅ |
| `--ink-soft` on `--paper` | 7.04:1 | ✅ |
| `--on-accent` (white) on `--rust` (button label) | 5.75:1 | ✅ |
| `--rust` as text on `--card` | 5.75:1 | ✅ |
| `--rust` as text on `--paper` | 5.40:1 | ✅ |
| `--rust` as text/icon on `--rust-soft` fill | 4.82:1 | ✅ |
| `--accent-deep` on `--card` / `--paper` | 11.08:1 / 10.42:1 | ✅ |
| `--coral` on `--coral-soft` (pill) | 5.11:1 | ✅ |
| `--gold` on `--gold-soft` (pill) | 4.73:1 | ✅ |
| `--sage` on `--sage-soft` (pill) | 5.50:1 | ✅ |
| `--slate` on `--slate-soft` (pill) | 5.10:1 | ✅ |
| `--coral`…`--slate` as standalone text on `--card` | 5.27–6.34:1 | ✅ |
| `--coral`…`--slate` as standalone text on `--paper` | 4.95–5.96:1 | ✅ |

### The rule this reconfirmed

**A fill color and a text color have opposite contrast requirements, so measure both
before assuming one token can serve both.** The retired amber needed a separate text token
because it failed as text; this blue happens to clear AA in both roles, which is a property
of *this specific hue's lightness*, not a general rule that accents don't need checking.
The next accent change must re-run this same audit rather than assuming the current
one-token setup still works.

### Why the pills need remeasuring on every palette change

Pill labels render at 12px (`text-xs`). WCAG's relaxed 3:1 "large text" allowance starts at
18.66px bold / 24px regular — so these are **normal text** needing 4.5:1. Low-saturation
tint-and-text pairs look fine and fail anyway, which is why reusing the landing page's own
decorative `--coral` verbatim (4.10:1 measured against a matching soft tint) would have
shipped a silent failure. Any future soft/saturated pair gets measured at the size it
renders, not assumed safe because a sibling page's similar-looking pair was fine at a
larger size.

---

## Open decisions

- **RESOLVED 2026-09-13** — the "going cold" gold pill stays `--gold`, not `--slate`: the
  axis is traffic-light escalation (fine → caution → urgent), not literal temperature, and
  `--slate` is already spoken for by "Total" in the same stat row. The description above was
  reworded to drop "Warming," which invited the question by literally contradicting "going
  cold." See `[[design-decisions#^D-015|D-015]]` and `[[approved#^A-004|A-004]]`.
- **RESOLVED 2026-09-13** — `--gold` was actually in use at 30 sites across 15 files, not
  just the six currency call sites [[design-decisions#^D-016|D-016]] first found (it also
  covered most warning/error text app-wide). Currency figures move to plain `--ink`; warning/
  error text moves to `--coral` (already the correct documented token). `--gold` goes back to
  meaning only "going cold." See `[[design-decisions#^D-017|D-017]]` and `[[approved#^A-005|A-005]]`.
- `[TO DECIDE]` **Rename `--rust` to `--accent`.** The value is right now (see above); the
  name still isn't. Worth doing as its own mechanical pass across ~90 call sites, not
  bundled into a value change again.
- `[TO DECIDE]` **Dark mode.** Not built. `--on-accent` is already written to survive a
  theme flip, which is good discipline. Decide *whether* before deciding *how* — dark mode
  is a real ongoing cost, and this ICP (owner, phone, daylight, between jobs) may not
  value it. Don't build it because it's expected.
- `[TO DECIDE]` **Chart palette.** Only once a chart genuinely needs more than neutral +
  accent.
- `[TO DECIDE]` **Whether `--slate` and `--ink-soft` are redundant.** Two grays with
  overlapping roles is a smell — carried over unresolved from the previous palette.
