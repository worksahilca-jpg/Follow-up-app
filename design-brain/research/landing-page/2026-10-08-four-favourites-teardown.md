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

## Part 2 — Wispr Flow, the whole page (from the founder's Chrome, 21 screens, measured)

Doc: "FollowUp teardown – wisprflow.ai" (founder's Drive). Grade A for structure and measurements, B for motion
(screens taken a second apart plus the hover GIF).

| Part | Height | What happens |
|---|---|---|
| Hero (cream) | 792 | EB Garamond 96 px, one lilac button (`rgb(240,215,255)`, 8 px corners, 16×24, Figtree 16 w600); speech streams through the pill non-stop |
| Logo band (dark) | 375 | slides over the hero with 80 px rounded top corners; logos drift (40 s loop) |
| "4x faster" (green, pinned) | 6,691 | panel pinned; the Flow card (blurred photo) grows and squeezes the Keyboard card |
| Hand-over | — | the same photo card travels into the next section, wide → tall, background green → cream ("the strongest moment on the page") |
| 3 steps (pinned, scroll-snapping) | inside | Speak naturally → Edits as you speak → Use it anywhere; one sentence said → cleaned (filler words coloured, then removed) → sent; then cycles through apps |
| Features | 1,834 | only the middle item is dark (0.3 s colour fade); a demo card swaps to match |
| Privacy | 408 | one calm card, three lines, three badges |
| Customers (dark) | 4,680 | tilted cards drift diagonally; real names, photos, two numbers each; the last card sits straight |
| Questions | 865 | the FAQ is a chat: question as your message, answer as a reply bubble |
| Closing | 864 | the hero recipe louder: 120 px serif over a blurred photo, a small joke, the same button |
| Footer | 1,150 | link columns, then the logo across the full width |

Type scale 120/96/75/48/32 serif, 20/16/14 sans; content width 1,240 px; 80 px corners on every colour block;
transitions 0.2–0.3 s with a springy overshoot (`cubic-bezier(0.34,1.56,0.64,1)`), colour fades 0.3 s; GSAP +
ScrollTrigger (pinning, scrubbing, snapping); hover: the button label ripples letter by letter (0.3 s).

**Why it is "the best experience":** (1) pinning, one change per scroll step; (2) one object carries you across
sections, so the page reads as one film; (3) one sentence tells the whole story; (4) colour blocks slide over each
other with big corners; (5) even small parts speak the product's language (the FAQ is a conversation).
**For FollowUp:** pin the hero story and let scroll advance it (she writes → the reply is written → you tap Send →
she answers, one message throughout); the reply card travels from the hero into the Today screen; colour blocks
with big corners; **the FAQ as a conversation** (the question arrives like a customer's email, the answer comes back
as a reply written for you). Not taken: the hand-drawn underline (R-017/R-020).

**Seen in the screenshots** (the doc exported as PDF from Drive; 21 desktop screens; the images stay out of the repo):
the italic is always the human part of each headline ("Don't type, *just speak.*", "4x faster *than typing*",
"Your voice *stays yours.*", "Good *questions.*", "Now, *two.*"); the button is lilac with a thin dark outline,
everywhere; demo cards sit on a muted sage-grey with large corners and plain white UI inside; a very faint thick wavy
line behind the step tour; customer cards use a third face (bold condensed caps) for names only, big serif quotes,
one flat colour each; the FAQ is a deep green question list inside a sage card, answers as chat bubbles signed by the
Flow icon. **Not honest for FollowUp:** famous customers' faces/quotes (A-023, none yet) and compliance badges (we have
none; /security says so). **Asked the founder:** the italic human phrase reopens A-022 ("keep it plain").

## Part 2 — Superhuman, the whole page (founder's Chrome, 8 screens, measured)

Doc: "FollowUp teardown – superhuman.com". Grade A for structure and CSS timings; motion mostly read from CSS (Chrome
reported the tab hidden after first load); no phone captures (window would not resize).
Order: announcement pill → sticky 67 px menu → hero (27 s looping film, no pause; frosted product cards; one
headline "Superpowers, everywhere you work" 64 px w540; one line; one dark button with a slowly rotating gradient
border, 10 s) → logos on warm paper `rgb(242,240,235)` in hairline boxes with hatched gutters → "Your Superhuman
suite" header + Mail / Grammarly / Docs / Go tabs, sticky (169 px) with scroll-spy → four identical product cards
(label, 48 px headline, one sentence, one link, four outcome bullets, a square demo clip that plays once with a
32 px "Pause animation" button; each product its own gradient mood) → deep teal story band → sky closing that
repeats the hero promise → maroon footer, tone-on-tone giant wordmark. 6.8 screens.
Motion: fades 0.3–0.5 s (`cubic-bezier(0.191,0.703,0.704,0.952)`), colour 0.2 s, no bounce, no lifts, no libraries.
**Lessons:** the calmest motion of the four (fits brand principle 2 better than Wispr's spring); one card template
per capability; a sticky "where you are" bar; outcome bullets; product clips play once with Pause.
**Positioning note:** Superhuman Mail's bullets include "Follow up on time, every time" and "Write with AI that
sounds like you": our promise in their words. FollowUp's page must make the difference plain: it is for an owner's
customers, it writes and checks in by itself, stops when they reply, and hands the owner the decisions.

## Part 2 — Macro, the whole page (founder's Chrome, 12 screens, measured)

Source: Google Doc "FollowUp teardown – macro.com" (2026-10-08), written by the founder's Claude in Chrome, read-only,
at 1230 × 868 (the side panel blocked 1440). Grade A for screens 1–4 and the GIFs (watched live); B for screens 5–12,
which are stills because Chrome hid the tab, so the three self-playing demos were not timed. No phone captures.
Screenshots stay on the founder's Drive and the private canvas, not in the repo.

**Measured.** Pure black ground; white text and white pill buttons (50% radius); body grey rgb(168,168,168).
Headlines Roboto Slab Variable at weight 315: 55/62 px statements, 39/49 px chapter titles, 34/41 px captions,
letter-spacing about −1.4 px. Body Inter 17/31 px, small 14/23 px. Columns 720–920 px; chapters 64 px top and bottom;
68 px fixed header. Reveals opacity + transform 0.6 s `cubic-bezier(0.22, 1, 0.36, 1)`; hero icons 0.9 s same curve;
hovers 0.18–0.2 s and nearly invisible. No animation library, no video, no canvas: all HTML and CSS, driven by scroll.

**The page, in order.** Hero (icons fly into orbit, then still) → "Replace 27+ apps with a single system", where the
outside apps shrink into the logo and Macro's 15 tools fan out, **tied to the scroll wheel** (freezes when you stop,
replays backwards) → the real app in HTML inside the page's first colour (a soft purple/teal/amber frame), 6 steps with
arrows, one caption each, never auto-advancing → quiet trust (GitHub stars, open source, investor, three badges, one
orange star as the only colour) → five chapters on one template (title with hairlines, two grey lines, a short chat
between named people, then a demo that plays once; one is a real spreadsheet you can type in, marked with a handwritten
"Try it"; one has Pause/Replay and a narrating status line) → one headline-sized quote → "Macro vs …" blog posts →
the header's "Open app" pill travels to the centre and grows ~3× into the final button; "Join 170k+ users. Free
personal account. No credit card required."; **no footer**.

**Lessons for FollowUp.**
1. Let the motion tell the pitch, and tie it to the scroll so the visitor controls it (ours: unanswered customers
   become answered as you scroll; it holds when you stop).
2. Neutral page, colour only where the product is (ours: the wash on FollowUp's reply, as A5 does) and for status.
3. Chapters as short exchanges between a customer and an owner with first names, labelled as examples (A-073's
   "An example, not a real customer" rule stays).
4. Hand over control: Pause/Replay and a status line on any self-playing demo; never auto-loop forever.
5. A live demo inside the page is the strongest proof (supports A4/A5's "Try it"). Their sheet traps the mouse wheel;
   ours must not.
6. One button from top to bottom; the header pill can become the closing button.

**Not to copy.** No footer (Google's OAuth verification needs a visible privacy-policy link on the home page; we keep
a small footer). Investor and compliance strip (we have neither; the honest "not done yet" list stays). Handwritten
"Try it" (R-017: no hand-drawn marks). The barely-there glow behind the icons (R-036: no shine). "Macro vs …" pages
are a marketing decision for the founder.

## Part 2 — Linear, the whole page (founder's Chrome, 12 screens, measured)

Source: Google Doc "FollowUp teardown – linear.app" (2026-10-08). Grade A for the first screen and GIF (a); B for the
rest (stills taken while Chrome's window was covered; motion read from the CSS). No phone captures.
**Measured.** Near-black rgb(8,9,10), text rgb(247,248,248). Inter Variable throughout: hero 64/64 at weight 510
(−1.4 px tracking), chapter titles 48/48, closing line 40/44, chapter paragraphs 24/32 in rgb(208,214,224), detail
13–15 px grey; Berkeley Mono for dates and captions. Light pill buttons rgb(229,229,230), 44 px tall. Content max
1364 px; chapters 128 px top and bottom; 73 px fixed nav. Hovers 0.1–0.16 s; slow moves 0.7 s on
cubic-bezier(0.32, 0.72, 0, 1). No library, no video, no canvas.
**The page.** Hero without a button; the real app plays a scripted story once (activity, an agent asked for help,
"Changed 2 files") and rests → logos → one two-tone paragraph → three FIG-captioned line drawings → four chapters on
one template (title left, paragraph right, two overlapping product cards with faded edges, a "Features +" index) → a
changelog timeline (newest with a red dot) → two bright quote cards → one centred ask → a five-column word footer.
**Lessons for FollowUp.** Let the product tell its story once and rest; statements as one paragraph, claim in ink and
explanation in grey; depth from overlapping product pieces, not glow (R-036); an honest "What's new" from our real
releases as proof of pace; colour only with a meaning; ask late and calmly.
**Not to copy.** Customer logos and quotes (we have none yet); a hero with no button (our Gmail button is approved,
A-081).
