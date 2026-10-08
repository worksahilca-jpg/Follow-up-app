# The founder's four favourites, taken apart (part 1 of 2, 2026-10-08)

**Question:** the founder loves Wispr Flow (overall best: interface and experience), Macro and Linear (organised) and
Superhuman (design), and says "we both don't know UI/UX". What do those four actually do, measured, and why does it
work, so FollowUp's site is designed from evidence rather than taste?

**Readable version:** the private artifact "Four Sites, Taken Apart" (claude.ai/artifact/WMApVFFY8MUidUyRYHMmXn).
**Evidence:** the 20 screenshots and `design-facts.js` output from the founder's Chrome (2026-10-07, Google Doc
"FollowUp design references", screenshots on the private canvas's References page); what the companies published
about their own design (Wispr's rebrand post by its CMO, Sept 2025; Linear's "How we redesigned the Linear UI",
Mar 2024; Rahul Vohra's a16z talk on game design); nothing published was found on Macro's site. Grade A for what is
on the first five screens, C for the rest of each page and for motion (stills only). Part 2 adds every screen,
per-section measurements (`tools/design-teardown.js`) and GIFs of the motion.

## Measured

| | Headline | Body | Colours | Motion | Photos / video | Length |
|---|---|---|---|---|---|---|
| Wispr Flow | EB Garamond 96 px w400, −3 %, 2nd line italic | Figtree 20/26 | cream, near-black, deep green `rgb(3,79,70)`, lilac `rgb(240,215,255)` button only, one orange | GSAP + Lottie, 9 at load | blurred people behind demo cards; real customer portraits; no video | 20.2 screens |
| Macro | Roboto Slab 48 px w315 | system 17, grey on black | black, white, two greys | CSS, 62 → 87 | none; the real app embedded ("Try it") | ≈ 11 |
| Linear | Inter 64 px w510 | 15/24 grey `rgb(138,143,152)` | near-black, grey scale; colour only inside product UI | CSS only, 83 → 546 | none | 11.1 |
| Superhuman | Super Sans 64 px w540 | 16/24 w460 | warm off-white `rgb(247,245,242)`, warm near-black, one purple | 5 muted clips with Pause | mood film of people (hero), product clips | 7.3 |
| FollowUp today | Public Sans 64 px w300 | Public Sans 18 | white, ink, the wash | story in 6 s, nothing arrives on scroll | none | 6.7 |

## What the four share (the lessons)

1. **One idea, shown moving, repeated** (Wispr: speech → clean text in the hero, the green block and the pinned card).
   Wispr's CMO: the hardest part of the site was "conveying the power of Flow in seconds".
2. **"Organised" = one section template used every time** (Macro: centred serif title, one grey sentence, one scene;
   Linear: title left, sentence right, scene below).
3. **Each colour has one job** (Wispr's lilac only means "press me"; Linear's colour only appears in product UI).
4. **The product is the artwork**; photos, where used, are blurred people *behind* the product (Wispr, Superhuman).
5. **Motion directs attention**: one thing at a time, a spotlight (Macro), a scene per section (Linear), Pause on
   clips (Superhuman).
6. **A headline face with character**: a serif (Wispr, Macro) or in-between weights (Linear 510, Superhuman 540/460).
7. **Rhythm**: light/dark blocks taking turns (Wispr, Superhuman) or one dark world with a spotlight (Macro, Linear).
8. **A menu that stays** and **one main button repeated**.

## Where FollowUp stands

Has: one main button; honesty and calm (none of the four do "An example, not a real customer"). Partly: the one idea
(shown once, too fast), colour jobs, product as artwork, motion with Pause. Missing: one section template, a
headline face distinct from the body, rhythm, a menu that stays.

## For FollowUp (to confirm in part 2, then spec)

Our one idea: *a customer's message turns into your reply, waiting for one tap*: the hero and the recurring motif.
One colour for the button. Serif headlines (already loaded). One section template, sections named in the owner's
words. Colour only inside product pictures (the wash). Public Sans at in-between weights (≈450 body, ≈540 headings).
A menu that stays; a sticky "where you are". Product clips from the real app with Pause. Blurred photos of owners at
work behind our cards (R-030: never decorative). Not taken: Superhuman's mood film of people (R-011).
**Open for the founder:** a Macro-style "Try it" (a visitor types a customer message, sees FollowUp's reply), which
runs our AI for strangers (cost, limits): a product call.
