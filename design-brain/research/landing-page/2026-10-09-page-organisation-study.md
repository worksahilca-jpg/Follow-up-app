# How the best home pages are organised, and a page map for FollowUp (2026-10-09)

**Question:** the founder: *"Let's pull the research again: how they design their pages, what strategies they use,
how they differentiate… our theme colours look best now, we just need to organise it properly."* How do the best
product home pages order their sections and make each one look different from its neighbour? How should FollowUp's
page be organised without changing the colours?

**Readable version:** the private artifact "Home Page Organisation" (claude.ai/artifact/BTNeLePiYBWBFLtsmTUkWB).

## Evidence, honestly

- **Grade A (seen and measured).** Wispr Flow, Superhuman, Macro, Linear, Granola, Questrade, Attio, Stripe and
  Mercury were captured from the founder's Chrome on 2026-10-07 and 08. See `2026-10-08-nine-homepages-seen.md`,
  `2026-10-08-four-favourites-teardown.md` and `references/landing-pages/2026-10-09-granola-questrade-teardown.md`.
- **Grade C (other people's write-ups, read today).** The live sites and Mobbin could not be opened from Claude's
  container: the network blocks them, and Mobbin needs a paid plan. The write-ups read:
  - Webflow's homepage and scrollytelling guides;
  - Wispr's own rebrand post;
  - third-party design-system extractions (Refero, webdesignhot, DESIGN.md files) for Wispr, Linear, Stripe and
    Raycast;
  - SaaSFrame on Attio;
  - UX Planet and CSS-Tricks on Apple product pages;
  - agency blogs on SaaS section rhythm.

  Their details (hex values, section orders) are approximate. None measured whether varied rhythm converts better.

## What they all do (the strategies)

1. **The page answers the visitor's questions in order.**
   - The order: what is it, does it work, why care, how does it work, what else, can I trust it, questions, ready?
   - Every section has one job, and its title is that job in plain words.
2. **A small set of section types, taken in turns, never the same type twice in a row.** Roughly six:
   - **Open:** big type and a product picture on the page itself, no box. Linear and Stripe use this most.
   - **Colour room:** a full-width band of one flat colour with big corners, for the big moments. Wispr turns cream
     to deep green, Granola uses a lime band, Superhuman a teal band.
   - **Pinned story:** a step list that stays while the story scrolls. Granola, Wispr, Attio.
   - **Grid of tiles:** capabilities in tiles of different sizes, the main one biggest. Stripe, Linear.
   - **Quiet card:** trust and privacy as one calm card with three lines. Wispr.
   - **Conversation:** questions answered as chat bubbles. Wispr's FAQ, in its own product language.
3. **Photos are one type among several, not the default.**
   - Wispr and Superhuman put a blurred photo behind the product in one or two places.
   - Linear, Attio, Macro and Stripe use almost none; the product is the artwork.
4. **Rhythm comes from light and dark taking turns, with space as the pause.**
   - Wispr goes cream, then green, then cream.
   - Stripe separates sections with long white space and thin lines, not boxes.
5. **Size shows importance.** The main idea gets the biggest stage; smaller features get small tiles.
6. **One object carries you across.** Wispr's photo card and Granola's product window travel into the next section.
   The movement follows the scroll; it doesn't run on a timer.
7. **Book-ends.** The close repeats the opening recipe, louder. Wispr's close is its hero over a photo, Granola's
   collage returns, Superhuman's sky repeats its promise.
8. **Restraint underneath.**
   - Two typefaces and about six sizes.
   - Each colour has one job.
   - Small parts speak the product's language.

## FollowUp now (Version 95)

1. Hero: open.
2. Try it: photo stage.
3. Leads go cold: photo box.
4. Ticker: dark strip.
5. Today screen: photo box.
6. How it works: photo, pinned.
7. Your control: photo.
8. Your data: photo.
9. It gets better: open.
10. Close: photo box.
11. Footer: dark.

**The problem he named, measured:** seven of eleven sections are the same type, a dark rounded box on a blurred photo.
Sections 5 to 8 are four in a row. There is no colour room, no grid and no conversation. Sizes don't show what
matters most.

## Proposed page map (same colours; nothing built until he picks)

Ground #F4F5F3, ink, deep green #10221A, lime #C2F09A, app greens, and the blurred photos, kept where they earn it.

| # | Section | Visitor's question | Type | Change |
|---|---|---|---|---|
| 1 | Never lose a lead | What is it? | Open | keep |
| 2 | Try it yourself | Does it work for my messages? | Photo stage (the biggest) | keep |
| 3 | Leads go cold | Why does speed matter? | Open | cards sit on the page, no photo frame |
| 4 | No reply? It checks in | What if they go quiet? | Lime room | the journey on a full lime band |
| 5 | Nothing to learn / Today | What will I see each day? | Product alone | the app on the page, rising as you scroll |
| 6 | How it works | How, step by step? | Pinned story, photo | keep (A-196) |
| 7 | You stay in charge | Am I in control? | Deep-green room | the settings card (A-201) on deep green, not a photo (asks him) |
| 8 | Your data stays yours | Is my data safe? | Quiet card | the controls card (A-201) on the page |
| 9 | It gets better | Will it improve? | Grid of tiles | learned facts and new features, the main one biggest |
| 10 | Questions (new) | What about…? | Conversation | optional; see the risk below |
| 11 | Your customers are writing | Ready? | Photo stage (book-end of 2) | keep, Mac message cards |
| 12 | Footer | Anything else? | Dark | keep (made readable) |

Photos then appear four times, never twice in a row: Try it, How it works, the close, and the footer's dark base.

## Risks and conflicts, checked against the brain

- **R-084:** flat dark gradient panels were rejected. The deep-green room must be a flat colour, not a gradient. It
  replaces one photo, so ask him first.
- **R-094:** the v119 attempt was reverted. That is why this is a map for him to pick from, not a build.
- **"Do not copy Wispr":** the FAQ as a conversation is Wispr's signature device. It suits FollowUp, which is a
  messaging product, but it may read as copying. It stays optional, his call.
- **R-073 and R-069:** no overlapping sheets and no connecting thread line. Turns come from colour and space.
- **A-201 and A-196:** the approved formats keep their content. Only their ground changes, and only where he agrees.
