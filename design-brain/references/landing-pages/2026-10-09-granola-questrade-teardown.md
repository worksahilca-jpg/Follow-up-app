# Granola and Questrade: how a home page explains, moves and connects

**Source:** granola.ai and questrade.com home pages, captured read-only on 2026-10-08 (Chrome on Windows, page area
1230 × 868). Teardown doc with 33 screenshots, GIFs, measurements and script output: the founder's Google Doc
"FollowUp teardown – Granola + Questrade" (private; the screenshots stay there and are never copied into the repo).
**Category:** landing-pages (also animations)
**Added:** 2026-10-09
**Added by:** Claude, from the founder's request ("check out Granola's design. I love it… their font, their animations,
their way of explaining things, the images, the graffities"; Questrade as a second look)
**Status:** REVIEWED
**Files:** link only (the Google Doc above)

---

## What is interesting

**Granola.** 15.8 screens tall. Two typefaces (one serif at weight 400 for every heading, one sans for the rest) and
five colours (ink, off-white, lime, olive for the main button, white). The hero is a live product window built in HTML,
not a screenshot: rough notes type in, a "Transcribing" pill, then tidy notes sweep in line by line; one pass is about
10 s and repeats. The window sits on a print collage: a lime paper panel, a black panel with film-leader dots and pen
scribbles, a halftone burst. On scroll the collage drifts off and fades and the same window shrinks and pins beside the
next section, so the first two screens read as one continuous object. A giant line of type ("For the doers", 148 px)
holds still while a dark band slides up over it. "Before, during, after" pins a three-item list on the left for about
2.7 screens; a 3 px bar fills under the current item as you scroll, while the cards on the right scroll normally. One
idea per flat lime band (a question typing itself into an input). Features are hairline-ruled rows: heading left, one
line right, a wide picture below (a product mock over a landscape photo). The hero's collage comes back behind the final
call to action, uncovered as the page scrolls away. Motion is native CSS scroll-driven animation; hovers are 0.15–0.3 s.
No animation library.

**Questrade.** 13.3 screens. Two typefaces, one weight, a type scale of only six sizes (12, 13, 17, 34, 60, 115). Pale
sage, near-black, black and one mint used for buttons and one whole band. A pinned block holds for about three screens
while a list item and its picture swap. Giant statement bands at 115 px. Proof points under the hero (rating, "100%
Canadian owned").

## UX principle

- **Show the product doing its one job in the first screen, on its own.** Granola's hero window performs the core
  action without a click and loops. The visitor learns the product by watching, not by reading.
- **Explain a sequence with a pinned index and a scrolling story.** The list says where you are; the content keeps
  moving, so the page never feels stuck. Questrade pins too, but only the picture swaps for three screens, and the
  page feels frozen (their own capture called it "like the page has stuck").
- **One idea per band.** Each band carries a single claim and a single demonstration.
- **Say what it is before anything else.** Questrade's hero is a slogan with no line under it, its top strip opens
  with promo jargon, and its noun marquee never says what the words are. All three slow a first-time visitor down.
- **Never move content before it can be read.** Questrade's story cards and columns advance on a timer, and the
  heading's last word changes at the same time.
- **Claims carry their proof where they are read.** Questrade's footnotes are behind a collapsed row at the very bottom.

## Visual principle

- **Restraint carries the personality:** two faces, a handful of colours, one accent used for one job, a short type
  scale. Personality comes from one bold device per section (the collage, the giant line, the lime band), not from many
  small decorations.
- **Art is hand-made print material, not decoration on every block:** paper panels, ink scribbles, ruler marks, a
  halftone burst, used in two places only (the opening and the close), so they book-end the page.
- **Product windows are drawn, not screenshotted**, and set on photographs, so they stay sharp and can animate.
- **Questrade's mistakes to avoid:** a see-through fixed header that lets big text pass behind the logo; 115 px
  statements that fill the window so they are read line by line; a 3D render as ornament; a comparison table that ticks
  every row in its own favour.

## Interaction principle

- Transitions between topics are **scroll-linked, not timed**: a giant line that a band slides over, a collage that
  drifts off as the window pins. They follow the scrollbar exactly and have no duration of their own.
- Timed motion lives only **inside** demonstrations (typing, a pill changing state), and runs when in view.
- Progress through a sequence is shown with **one thin bar**, not dots or numbers.

## Whose user is this?

Granola: knowledge workers in back-to-back meetings, on a laptop, comfortable with software. Questrade: Canadian
investors, many of them experienced. A FollowUp user is an owner or a small team, often on a phone, interrupted, not a
software person, who has been pitched hard by lead-gen tools. So: take Granola's calm and its show-don't-tell, and take
Questrade's lessons mostly as warnings. Anything that pins for long, moves on a timer, or relies on jargon costs us more
than it costs them.

## What FollowUp could learn

1. **Home: connect the hero to the next section by scroll**, not by sheets (R-073): the try-it card stays the one object
   that carries over, while whatever sits around it (the drifting messages) moves away.
2. **Home "How it works": a pinned index of the real sequence** (a message comes in → FollowUp answers → it checks in on
   the day → you step in when it matters) with a thin bar that fills, while the examples scroll past. Keep the pin under
   about two screens.
3. **One scroll-linked transition between big topics**: a single giant line that the next band slides over. Once on the
   page, not at every section.
4. **Our own print material, used twice** (opening and close): hand-drawn ink lines and flat paper panels in our light
   green. Not stripes, dots or hatching as background patterns (R-072), and not grain (R-071).
5. **A type-scale audit**: count our sizes and faces against "two faces, about six sizes".
6. **Not taken:** the floating pill nav (R-068), any marquee (R-047), timed carousels, a comparison table, 3D renders,
   giant wordmark footers (A-153 chose against it).
