# FollowUp brand assets

Built 2026-09-18 from concepts **#69** (favicon) and **#71** (horizontal lockup) of the
founder's logo exploration sheet: "I want the logo to be 69 and 71." One master geometry,
every file derived from it. Monochrome by design: the identity has to work in one colour
before any colour is added.

| File | Use |
|---|---|
| `followup-symbol.svg` | Standalone symbol. `fill="currentColor"` — set `color` in CSS. |
| `followup-symbol-white.svg` | Same, fixed white, for places CSS cannot reach. |
| `followup-horizontal.svg` | Symbol + "FollowUp" wordmark (Manrope 600, outlined). `currentColor`. |
| `followup-horizontal-white.svg` | Reversed lockup, fixed white. |
| `followup-app-icon.svg` | 1024 rounded square (22% radius), `#111312` ground, white symbol at 58% of canvas height. |
| `followup-app-icon-light.svg` | Same, white ground, `#111312` symbol. |
| `followup-favicon.svg` | The symbol with a wider channel and rounder corners, for 16–32 px. |
| `png/` | Previews of the symbol (transparent) and app icon at 16 → 1024 px. |

**The symbol.** Two leaves. Each is a parallelogram leaning forward (top and bottom edges
rise to the right at about 23°, sides lean about 10°) with its two acute corners left sharp
and its two obtuse corners rounded. The upper leaf is the first contact; the lower leaf,
70% the size and tucked under to the left with the same lean, is the follow-through. The
channel between them is the moment in between, and it is the part that must never close:
at any size the gap stays visible. Bounding box 81.79 × 120 (1 : 1.47). Channel ≈ 6 units
(5% of height) in the master, 9.5 units in the favicon variant.

**Colour.** Primary dark `#111312`, primary light `#FFFFFF`. No blue, purple or gradient.

**Clear space.** X = the channel's width × 3 (about 19 units at 120 tall, so X ≈ 16% of the
symbol's height). Keep at least 1X of empty space on every side of the symbol and of the
lockup. Nothing — text, buttons, other marks — inside that area.

**Lockup.** As drawn in #71: the symbol is tall beside the word. Wordmark cap height =
symbol height ÷ 3.2. Gap between symbol and wordmark = 12% of the symbol's height. The cap
block is centred on the symbol's height. Wordmark is Manrope SemiBold, tracked −0.35 units,
outlined to paths so no font is needed to render it.

**Minimum sizes.** Symbol: 16 px (use the favicon variant below 24 px). Lockup: 28 px tall;
below that use the symbol alone, the wordmark becomes unreadable.

**In code.** `src/components/landing/light/LogoMark.tsx` carries the master paths inline;
`src/app/icon.tsx` carries the favicon variant. Change the geometry here first, then there.
The build script that produced every file lives with the founder's session; the numbers
above are enough to rebuild it.

**Do not.** Add a gradient, shadow or 3D. Rotate it. Outline it. Recolour the two leaves
differently. Put it in a circle (the app icon's rounded square is the one container).
Redraw the wordmark in another face without a decision.
