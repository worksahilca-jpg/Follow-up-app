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

## Current values (provisional — shipping today, verified 2026-09-12)

From `followup/src/app/globals.css`. Real, in production, consistent. Recorded as the
baseline, **not** ratified as final.

### Neutrals — a warm cream palette
| Token | Value | Role |
|---|---|---|
| `--paper` | `#f3f0ea` | Page background (warm cream) |
| `--card` | `#ffffff` | Card / raised surface (pure white) |
| `--ink` | `#18140f` | Primary text (warm near-black) |
| `--ink-soft` | `#5c574c` | Secondary text |
| `--line` | `#e2ddd0` | Borders, dividers |

Two rules already established here are worth keeping: **never pure black on pure white**,
and cards separate from the page by being *lighter* plus a border — separation through
contrast, not shadow. The warm palette was adopted to make the authenticated app and the
marketing pages read as one product rather than two, which is sound reasoning.

### Accent
| Token | Value | Role |
|---|---|---|
| `--rust` | `#e8a23a` (amber) | The accent, **fills only** |
| `--accent-text` | `#8a5a08` | The accent **as text** — added 2026-09-12, see A-001 |
| `--rust-soft` | `#f7e6c4` | Focus-ring halo only |
| `--on-accent` | `#241a08` (dark) | Text on an accent fill |

**Two open problems, both real:**

1. **`[TO DECIDE]` — the accent has now changed value three times.** Per the token's own
   comment in `globals.css`, `--rust` has held a **blue**, then a **violet** (`#7c3aed`),
   and now an **amber** (`#e8a23a`) — each time changed in place rather than decided.
   That churn is the strongest argument for this design brain existing: the accent is
   the most visible brand decision in the product and it has never actually been *made*.
   **This needs a real decision from the founder**, recorded in `decisions/approved.md`,
   after which it stops moving. Amber is a more distinctive choice than the violet it
   replaced (violet is the default AI-SaaS accent and worked against principle 3) — but
   amber is also a *warning* color in most interfaces, which sits awkwardly next to
   `--gold` (`#d97706`) in the status system. Worth deciding deliberately, not by drift.
2. **The token name has never matched its value.** `--rust` has never held a rust. It has
   held blue, violet, and now amber. The comment says the name was kept to avoid touching
   ~90 call sites. That's a reasonable engineering call each time and a compounding
   documentation cost: every session must learn that the name lies. `[TO DECIDE]` —
   rename to `--accent` in one mechanical pass, ideally at the same moment the color is
   finally decided, so it's one change rather than two.

Note: `--on-accent` is now **dark** (`#241a08`) because white on this amber fails
contrast. It must always move in lockstep with `--rust` — a good constraint, correctly
reasoned in the code comment, and easy to break accidentally.

### Status colors (lead urgency / state)
| Token | Value | Soft | Means |
|---|---|---|---|
| `--coral` | `#dc2626` | `#fee2e2` | Needs attention now / error / high priority |
| `--gold` | `#d97706` | `#fef3c7` | Warming / warning / attention soon |
| `--sage` | `#16a34a` | `#dcfce7` | Good / success / no action needed |
| `--slate` | `#64748b` | `#f1f5f9` | Neutral / informational / medium |

Deliberately left unchanged through the warm-palette pass, on the correct reasoning that
these encode **meaning**, not brand.

**The rule that makes this work:** these four are *semantic*, not a palette. `--sage` means
"fine" everywhere — never "the green card." Using a status color decoratively destroys the
system, because once green is decorative, green can no longer mean "fine."

Pattern in use: soft tint as background, saturated shade as text. Keep it.

**`[TO DECIDE]` — amber accent vs. `--gold` status.** `#e8a23a` (accent, meaning
"interactive") and `#d97706` (status, meaning "needs attention soon") are neighbors. A
user cannot be expected to learn that one amber is a button and a slightly darker amber is
a warning. This is a genuine collision introduced by the palette change and it should be
resolved — either by moving the accent, or by moving `--gold`.

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

## Contrast audit — measured and FIXED 2026-09-12

Computed WCAG 2.1 ratios. **Both failures found in the first audit have been fixed** (see
`decisions/A-001` and `D-005`); the numbers below are re-measured from the committed CSS.

| Pair | Before | Now | |
|---|---|---|---|
| `--ink` on `--card` | 18.33:1 | 18.33:1 | ✅ |
| `--ink` on `--paper` | 16.11:1 | 16.11:1 | ✅ |
| `--ink-soft` on `--card` | 7.19:1 | 7.19:1 | ✅ |
| `--ink-soft` on `--paper` | 6.32:1 | 6.32:1 | ✅ |
| `--on-accent` on `--rust` (button label) | 7.88:1 | 7.88:1 | ✅ |
| **accent as text on `--card`** | **2.17:1** ❌ | **5.92:1** | ✅ via `--accent-text` |
| **accent as text on `--paper`** | **1.91:1** ❌ | **5.21:1** | ✅ via `--accent-text` |
| **accent as text on `--rust-soft`** | **1.77:1** ❌ | **4.81:1** | ✅ via `--accent-text` |
| `--coral` on `--coral-soft` (pill) | 3.95:1 ❌ | 4.55:1 | ✅ |
| `--gold` on `--gold-soft` (pill) | **2.86:1** ❌ | 4.73:1 | ✅ |
| `--sage` on `--sage-soft` (pill) | 3.00:1 ❌ | 4.82:1 | ✅ |
| `--slate` on `--slate-soft` (pill) | 4.34:1 ❌ | 4.73:1 | ✅ |
| `--coral`…`--slate` as text on `--card` | — | 5.19–5.56:1 | ✅ |
| white on `--coral` fill | 4.53:1 | 5.56:1 | ✅ improved |

### The rule this produced

**A fill color and a text color have opposite contrast requirements, so one token cannot
serve both.** `--rust` (`#e8a23a`) is light: it works as a fill *because* it is light
(paired with the dark `--on-accent`), and fails as text for exactly the same reason.
`--accent-text` (`#8a5a08`) is the same hue darkened until it clears AA on every surface it
lands on.

- **`--rust`** — fills, borders, focus rings, the Compass logo mark.
- **`--accent-text`** — any accent-colored text or meaning-carrying icon.

Logo marks were deliberately left on `--rust`: **logotypes carry no WCAG contrast
requirement**, and the mark should stay the brand color.

### Why the pills were failing invisibly

Pill labels render at 12px (`text-xs`). WCAG's relaxed 3:1 "large text" allowance starts at
18.66px bold / 24px regular — so these are **normal text** needing 4.5:1. Low-saturation
tint-and-text pairs look fine and fail anyway, which is why this needed measuring rather
than eyeballing. Any future soft/saturated pair gets measured at the size it renders.

**What did not change:** every hue. These are the same four colors, darker. The accent's
own value is untouched — fixing contrast must not quietly settle the open question of what
the accent should be.

---

## Open decisions

- `[TO DECIDE]` **Final accent color** — and stop it moving. Needs founder input and real
  screens. See "Accent" and the contrast audit above.
- ~~How the accent works as text~~ — **RESOLVED 2026-09-12** via `--accent-text`. See A-001.
- ~~Darken the four status shades~~ — **RESOLVED 2026-09-12**. See A-001.
- `[TO DECIDE]` **Dark mode.** Not built. `--on-accent` is already written to survive a
  theme flip, which is good discipline. Decide *whether* before deciding *how* — dark mode
  is a real ongoing cost, and this ICP (owner, phone, daylight, between jobs) may not
  value it. Don't build it because it's expected.
- `[TO DECIDE]` **Chart palette.** Only once a chart genuinely needs more than neutral +
  accent.
- `[TO DECIDE]` **Whether `--slate` and `--ink-soft` are redundant.** Two grays with
  overlapping roles is a smell.
