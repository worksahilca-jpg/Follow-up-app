# FollowUp brand assets

Built 2026-09-18 from the founder's logo brief (concepts #69 / #71). One master geometry,
every file derived from it. Monochrome by design: the identity has to work in one colour
before any colour is added.

| File | Use |
|---|---|
| `followup-symbol.svg` | Standalone symbol. `fill="currentColor"` — set `color` in CSS. |
| `followup-symbol-white.svg` | Same, fixed white, for places CSS cannot reach. |
| `followup-horizontal.svg` | Symbol + "FollowUp" wordmark (Inter 600, outlined). `currentColor`. |
| `followup-horizontal-white.svg` | Reversed lockup, fixed white. |
| `followup-app-icon.svg` | 1024 square, `#111312` ground, white symbol at 56% of canvas height. |
| `followup-app-icon-light.svg` | 1024 square, white ground, `#111312` symbol. |
| `followup-favicon.svg` | The symbol with wider channels and less lean, for 16–32 px. |
| `png/` | Previews of the symbol (transparent) and app icon at 16 → 1024 px. |

**The symbol.** Two forward-leaning forms that read as an abstract F. The upper form (top
arm + stem) is the first contact; the lower form is the follow-through. The channel between
them is the moment in between, and it is the part that must never close: at any size the gap
stays visible. Bounding box 100.8 × 120 (1 : 1.19). Upper form ≈ 65% of the mass, lower ≈ 35%.
Channel = 16 units ≈ 13% of the height. Lean = 0.14 (top edge shifted right by 14% of height).
Terminals are cut on a 1:3 chisel so the silhouette points forward without drawing an arrow.

**Colour.** Primary dark `#111312`, primary light `#FFFFFF`. No blue, purple or gradient.

**Clear space.** X = the stem's width (22 units at 120 tall, so X ≈ 18% of the symbol's
height). Keep at least 1X of empty space on every side of the symbol and of the lockup.
Nothing — text, buttons, other marks — inside that area.

**Lockup.** Symbol height = 1.2 × the wordmark's cap height. Gap between symbol and
wordmark = 0.46 × the symbol's width. The cap block sits centred on the symbol's height.

**Minimum sizes.** Symbol: 16 px. Lockup: 22 px tall. Below 24 px use the favicon variant.

**In code.** `src/components/landing/light/LogoMark.tsx` carries the same paths inline;
`src/app/icon.tsx` carries the favicon variant. Change the geometry here first, then there.

**Do not.** Add a gradient, shadow or 3D. Rotate it. Outline it. Recolour the two forms
differently. Put it in a circle. Redraw the wordmark in another face without a decision.
