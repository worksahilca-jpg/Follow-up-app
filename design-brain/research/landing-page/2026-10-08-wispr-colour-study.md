# Wispr Flow's colour: how, why, and what FollowUp takes (2026-10-08)

**Question (founder):** "How they play with the colours, what is the reason behind that? Why do they use those
colours, and where can we implement it?… we can play with gradients too." Visual version:
https://claude.ai/artifact/Mi2ateBbv2oxiKwPhHPpWV (copy in `prototypes/2026-10-08-wispr-colour-study/`).

## What Wispr uses (each colour has one job)
| Colour | Value | Job |
|---|---|---|
| Cream paper | `#FFFFEB` | the page; warm, never pure white |
| Near-black | — | words: serif headlines, sans text |
| Deep teal-green | `#034F46` (rgb 3,79,70 measured) | heavy blocks: dark sections and panels |
| Lavender | `#F0D7FF` (rgb 240,215,255 measured) | only "press me": every main button, nothing else |
| Warm orange | `#FFA946` | tiny warm highlights, rare |
| Wine | `#7F1C34` | rare deep accent |
Blocks have ~80 px corners and slide over each other on scroll (our Oct 8 teardown).

## Why (Wispr's own rebrand post, "Rebranding Flow")
- "The palette worked well in product, but fell short in the wild. It wasn't recognizable in a feed, and it wasn't
  memorable in a moment."
- "Soft neutrals and thoughtful contrast lean away from the clinical palettes common in AI startups."
- They considered "icy blues and purples… gradient overlays" (precision, technology, the future) and went warm.
- "Every visual, every blur, every curve or cue echoes the same idea: voice, in motion."
- Done in six weeks by about 2.5 people in-house.

## Gradients
Wispr is mostly flat colour blocks; the softness is blurred photography behind product cards. Superhuman is the
gradient-led site (a gradient mood per product, a slowly rotating gradient border on the button). For FollowUp:
gradients only within one colour family, used like light (a lighter patch where light falls on a block, or a
one-colour fade). Not: several hues at once (R-042), neon or rainbow, gradient text, glowing borders (R-036).

## What makes it read as professional
Few colours with strict jobs; flat blocks with big corners alternating with paper; one button colour used nowhere
else; warm paper instead of white; the italic carries the human half of each headline.

## Proposed for FollowUp (same roles, our colours; founder to choose)
- **Forest** (recommended): paper `#FAF8F3`, ink `#0E0E0C`, block `#0F4A33` with a light patch `#1F7350`, action
  mint `#CDEFD9` on `#0B2A1A`. Green already means "sent" in the app.
- **Ink**: the same with a black block `#111110`; the mint button is the only colour.
- **Mint light**: paper `#F7F9F5`, a light block fading `#E3F6EA` → `#B9E2C9`, action ink.
All three keep the app's meanings: green `#0D6E3C` = sent, orange `#C96A1B` = needs you (a dot only).
**Where:** screen 1 paper (headline only); screen 2 the block slides up with big corners (box and middle card in
white on it); "how it helps" paper; Today block; control and what's new paper; closing block; buttons only in the
action colour.

## Sources
- Wispr, "Rebranding Flow": https://wisprflow.ai/rebrand (read through search results; the site is blocked from
  this session's network)
- Fudge, wisprflow.ai fonts, colours and UI patterns: https://design.withfudge.com/share/wisprflow.ai-design
- Refero, Wispr Flow design system: https://styles.refero.design/style/ac53825c-1e06-4ae0-8489-cace5c5e0339
- webdesignhot, Wispr Flow: https://www.webdesignhot.com/design.md/wispr-flow/
- Our measured teardown: `2026-10-08-four-favourites-teardown.md` (Part 2, Wispr)
