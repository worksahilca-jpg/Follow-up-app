# Wispr Flow's home page, read scroll by scroll (2026-10-09)

**Question:** how does wisprflow.ai make its sections feel connected? The founder asked for a deep read *"with the
whole scrolling"*. This answers what moves, what stays and what changes colour at each step.

**Method:** the live page (17,982 px tall at 1440×900) was copied through the session's proxy and rendered locally.
115 frames were taken, one every 150 px. A second pass took one every 100 px through the hand-over (2,400 to 4,600 px).
The page's own GSAP ScrollTrigger list was read for pin ranges, snap points and scrubbing. Screenshots stay out of
the repo (private reference); only the principles are written here. Grade A for structure and measurements, B for
motion, because these are frames rather than video.

## The page, top to bottom

| Scroll (px) | Ground | What happens |
|---|---|---|
| 0–780 | cream `rgb(255,255,235)` | Hero. A line of "spoken" words loops through a waveform pill and comes out as clean text on a black ribbon. |
| 995–1370 | near-black `rgb(26,26,26)`, 80 px rounded top | Logo band. It is a normal block tucked 80 px under the hero, so its round corners show cream behind them. |
| 1291–7302 | deep green `rgb(3,79,70)`, then cream | **The pinned chapter, about 6,000 px of scroll with snapping.** One photo card sits in the middle the whole way. See below. |
| 8204–10084 | cream | Feature list. One item is lit, the rest are faded grey. A small demo card beside it swaps to match the lit item. |
| 9949–10357 | cream with a sage card `rgb(228,228,208)` | Privacy: one calm card, three lines, three badges. |
| 10357–15069 | near-black, 80 px rounded top and bottom | People: tilted quote cards drift up on a diagonal, scrubbed to the scroll (1.5 s smoothing). The last card sits straight. |
| 15069–15934 | cream | Questions, built as a chat: the question list is on deep green, the answers are reply bubbles. |
| 15934–16798 | blurred photo block, 80 px corners | The close repeats the hero's recipe, larger. It peeks in under the questions before you reach it. |
| 16798–17982 | cream | Footer: two product cards, link columns, a giant wordmark. |

Only three grounds are used: cream, near-black and deep green. Sage is used for cards. The floating menu card is
always visible.

## The hand-over, measured (the strongest moment)

1. **2,400–3,000 px:** the photo card shrinks from wide (Flow beside Keyboard) to a tall card in the centre. The
   headline "4x faster than typing" stays put.
2. **3,100 px:** the green room starts scrolling away like the rest of the page. In the first 100 px its bottom corners
   grow from 0 to 80 px, so the edge turns round as it lifts. Cream shows underneath.
3. **3,100–4,000 px:** the card **does not move**. It is the only fixed thing on screen while the green room lifts
   away and the next headline, "Speak at the speed you think, in every app, on every device.", scrolls up *behind* it.
4. **4,200 px onward:** the same card becomes the three-step tour.
   - A step list appears on the left, with an orange marker on the current step.
   - A message box rises into the card.
   - The step's text appears on the right.
   - A pale wavy line runs behind everything.
5. **Steps:** each one snaps, so you never stop half-way.
   - Speak naturally: words appear in the card.
   - Edits as you speak: the photo turns to evening, filler words are coloured, then removed.
   - Use it anywhere: a desk photo and the clean message, then app cards tilt through.
6. **7,302 px:** the pin releases and the card scrolls away with the text.

**Why it feels connected:** for about seven screens, the thing you are looking at never leaves. Only the room around
it changes. Colour, headline, step list and text all move or change behind one still object.

## The six techniques

1. **One object holds the middle of the page.** A single card carries three sections: speed, the hand-over and the
   tour.
2. **The ground changes behind a still object.** The colour room scrolls away with a round edge; the object stays.
3. **The next thing peeks before it arrives.**
   - Round corners show the next colour coming.
   - The next headline passes behind the card.
   - The closing photo shows under the questions.
4. **One beat per scroll step.** Pin and snap; only one thing changes at a time.
5. **One thing lit at a time.** In the feature list, everything that is not current fades.
6. **One idea repeated.** Messy speech becomes clean text in the hero, in the card and in the language demo.

## What it means for FollowUp

- **Take:**
  - One customer's message as the object that holds the middle of our page.
  - The colour change behind it; this is already in preview 3.
  - One beat per scroll step; How it works already pins.
  - Showing the next section's title before you arrive.
- **Do not take:**
  - Colour blocks tucked under each other with round corners. R-073: the founder found overlapping pages odd. Our
    colour change happens behind the content instead.
  - Tilted cards drifting on a diagonal, without his yes.
  - Famous customers' quotes; we have none (A-023).
- **Open question for him:** one customer for the whole page. Nadia (the realtor already in Today and How it works)
  instead of Tomás in Leads go cold.
