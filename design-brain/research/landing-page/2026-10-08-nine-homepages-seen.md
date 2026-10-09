# Nine homepages, actually seen: what makes them feel premium and easy, and where FollowUp's lags (2026-10-08)

**Question:** the founder says FollowUp's design feels dated ("reminiscent of the 1990s… not as user-friendly as I'd
like") and wants it premium, user-friendly and easy to understand. What do the homepages he admires do, in look,
motion, photos and video, that ours does not, and which of those fit FollowUp without breaking an approved or
rejected decision?

**Evidence, honestly: grade A for what is on the page, B for motion.** For the first time these sites were *seen*,
not read about: the founder's Claude in Chrome visited each homepage on 2026-10-07, read-only, and filled the Google
Doc "FollowUp design references" (founder's Drive) with five screenshots per site (desktop 1230 × 868, three
scrolled; phone 390 px), the output of `design-facts.js` (fonts, weights, sizes, colours, radii, shadows, video,
canvas, motion libraries, running animations, page length) and notes on motion, photos, video, "premium" and "easy".
Limits it stated: motion noted from repeated stills, not recordings; Superhuman, Mercury and followupbase.io refuse
framing, so their phone views are HTML copies (Mercury's first screen only); the orange `rgba(217, 119, 87…)` shadows
are Chrome's own outline; macro.com's page height reads 1 because it scrolls inside a box (really about 11 screens).
The screenshots were then seen too, from the founder's PDF export of the Doc; all 45 sit on the References page of the
private design canvas (claude.ai/artifact/Wtq91Jo56vW8fBzTxUWdgH), one board per site, and are deliberately not stored in
this repository (other companies' pages, as with the logos in `references/design-systems/2026-09-27-reference-company-logos.md`).
**Principles only.** No screen, layout, phrase or asset is to be reproduced (S-16).

**Sites:** wisprflow.ai, granola.ai, linear.app, attio.com, superhuman.com, macro.com, stripe.com, mercury.com, and
followupbase.io for comparison.

## What the eight do, measured

| | Headline type | Hero | Motion | Photos / video | Length |
|---|---|---|---|---|---|
| Wispr Flow | EB Garamond serif, 96 px, weight 400, second line italic; Figtree body | Messy speech flows into a pill and comes out as clean text, on a loop | GSAP + Lottie; one idea (speech → polished text) repeated; pinned card while 3 steps tick | Mood photos behind demo cards; real customer portraits; no video | 20 screens |
| Granola | Quadrant slab serif, 74 px, weight 400; Melange body | The app types rough notes, "Enhancing", swaps for tidy notes | Custom; the hero window travels down into the next section; Before / In / After list fills as you scroll; menu becomes a floating pill | Landscape photos and paper collage behind product; no video | 16 |
| Linear | Inter Variable 64 px at weight 510; mono labels | Big app window with an activity feed playing | Custom, CSS only (83 → 546 animations); each section fades in and plays one short scene | Almost none; product UI is the art | 11 |
| Attio | Inter Display 64 px / 600; claim in black, explanation in grey | App window cycles through 5 scenes | Sticky chapter list (Build pipeline… Retain) highlights as you scroll; hairline grid like a blueprint; one calm light → dark switch | Very few photos; no video | 20 |
| Superhuman | Custom Super Sans at 460 / 540 | Full-screen cinematic film of people, frosted product cards over it | Sticky product tab bar; each product plays one short clip with a pause button | 5 autoplay muted videos (1 mood film, 4 product clips) | 7 |
| Macro | Roboto Slab at weight 315, 48 px, on black | App icons orbit the logo | Sections rise out of near-black as they reach the middle (a spotlight); small scenes play; a live embedded app you can try | None | ~11 |
| Stripe | Söhne 48 px at weight 300; second sentence in grey | Live-drawn colour ribbon | Product cards each with a small looping scene; big numbers highlight one at a time | A few photos; no video | 16.5 |
| Mercury | Arcadia Display 44 px at 480 | A desk on a misty hill; scrolling pushes the camera into the laptop until it *is* the dashboard | Scroll-scrubbed film; four product areas step through with a clip each | Rendered scenery, soft 3D objects, customer portraits; 5 clips, none autoplay | 14 |

**FollowUp today:** Public Sans 64 px at weight 300 with IBM Plex Mono labels; zero images, zero video, no motion
library, 33 animations at load; hero card stack fades in; the five-step "One customer" story plays all five steps in
about **6 seconds**; nothing animates in as you scroll; the top menu scrolls away; "See how it works" carries a
play icon with **no video behind it**; 6.7 screens.

## The principles underneath (what is common to all eight)

1. **The product's one transformation, shown working, slowly, near the top.** Every page shows its single
   before → after as a loop you can watch without reading: rough speech → clean text (Wispr), rough notes → enhanced
   (Granola), question → answer (Attio). Paced for reading, often with pause and replay. *Ours has the right story
   (a customer writes → the reply is written → you OK it → they hear back), but it is below the hero and runs about
   4× too fast.*
2. **One scene per section, and the page organised by the reader's jobs.** A sticky list of chapters named in the
   user's words (Before / In / After the meeting; Build pipeline… Retain) highlights as the matching scene plays.
   The structure itself explains the product. *Ours: static sections.*
3. **Arrival motion that directs attention, never decoration for its own sake.** Sections fade or brighten in as
   they reach the middle of the screen; only one thing is "lit" at a time (Macro, Linear, Wispr's headings going
   grey → black). *Ours: nothing arrives.*
4. **A display typeface with a character, used for headlines only, beside a quiet body face.** Serif or slab with
   tight tracking (Wispr, Granola, Macro), or a sans at unusual in-between weights (Linear 510, Superhuman 540,
   Mercury 480). *Ours: Public Sans Light, the same family as the body, a common free choice: plain, which is
   what A-022 asked for, but also the likeliest single source of "generic".*
5. **Two-tone headings and short claims.** Black for the claim, grey for the explanation (Attio, Stripe). Each
   section title is a job, not a feature.
6. **Depth comes from craft, not from photos.** Linear, Attio and Macro use almost no photography; their richness is
   detailed, believable product scenes with exact numbers and real-looking names, hairline grids, soft glows.
   Photos, where used, sit *behind* the product as mood (Wispr, Granola), never as the subject. *Ours: a flat
   card stack and a gradient wash.*
7. **Navigation that stays.** The menu becomes a floating pill or a sticky tab bar. *Ours scrolls away.*
8. **Proof as concrete numbers with one-line labels.** 45 vs 220 words a minute; "Apply in 10 minutes"; GDP ticking.
   *Ours has no numbers yet, correctly (nothing may be invented; the proof number waits for real data, check-up #26).
   Honest numbers we can say today are product facts, such as "a reply written in about a minute".*
9. **Video is for the product, not for mood, on a page like ours.** Superhuman's mood film and Mercury's scroll film
   are expensive and brand-led; their product clips are short, muted, paused-able UI recordings. *Ours promises a
   video ("See how it works", play icon) and has none.*

## What fits FollowUp, checked against the brain

- **Fits, no conflict:** slower story with pause/replay (A-040 kept, timing only); sections arriving gently with
  `prefers-reduced-motion` respected (`brand/motion.md`: motion only to explain or give continuity); a menu that
  stays; a real 30–45 second product clip recorded from the real app behind "See how it works" (A-049 kept);
  two-tone headings; product facts as numbers.
- **Fits, but reopens an approved line:** a display face with character. A-022 approved "plain thin headline… no
  serif italic ('keep it plain')", and `brand/typography.md` lists Bricolage Grotesque for display while the live
  page uses Public Sans Light. Changing it means asking the founder (CLAUDE.md: deviating from approved; adding a font).
- **Fits only in a form not yet rejected:** depth for the lead-flow concept. R-014 kept the *concept* (leads come in
  from everywhere, FollowUp in the middle, customers answered) and rejected the flat, full-width execution; "more
  advanced" was read as depth and craft. A crafted, smaller, moving version is open.
- **Does not fit:** a dashboard or app-window mockup as the hero (R-005, R-009, twice); a photograph of a person as
  the hero (R-011); handwriting (R-017); a black reply card (R-018); a page that changes tone from black to white
  (R-010, superseded by A-022's white page, but a whole dark mid-section is still a question for the founder, not a
  default); mood video of people (R-011's reason, "a person says nothing about the product", applies).

## Directions to draw (for the founder to pick from; nothing built)

- **D1 — Same page, finished.** Keep the layout; fix pacing and arrival: the story slowed to about 4 s a step with
  pause/replay, sections arrive as they reach the middle, the menu becomes a floating pill, a real product clip
  behind "See how it works", two-tone headings, a few product facts as numbers. Cheapest; answers "lagging" more
  than "dated".
- **D2 — The one transformation as the hero.** The hero itself shows FollowUp's single before → after, slowly: an
  unanswered customer email turns into a reply in the owner's words, waiting for one tap, then "Thursday works"
  comes back. Not an app window (R-005/R-009): one message and one reply, large, with the lead-flow concept (R-014)
  as a small crafted layer behind it. Then chapters named in the owner's words (A customer writes / You OK the reply
  / They go quiet / They come back), sticky, each with one scene.
- **D3 — D2 with a new display face.** As D2, plus a headline face with character beside Public Sans body. Needs
  the founder's yes to reopen A-022 and to add a font; three candidates to be drawn side by side on the real
  headline, none chosen here.

**Still open before drawing:** which surface reads as dated to the founder (landing page, app, or both), and one
example of what reads as "1990s".
