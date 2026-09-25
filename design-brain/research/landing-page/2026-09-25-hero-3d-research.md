# Hero with 3D and motion: what the best sites do, and five directions for FollowUp

**Date:** 2026-09-25. **Status:** research only, for the founder to read before he sketches.
Nothing here is decided. Nothing in the code changed.
**Why this exists:** [[rejected#^R-014|R-014]]. The founder kept the concept of the A-012
diagram (messages come in from everywhere, go through FollowUp, customers get answered) but
rejected how it looks: *"very boring… not that advanced, and it is in the whole screen too."*
He wants the site to feel high-level, simple, minimal and trustworthy, and to use 3D and a
strong colour to draw people in.

**Read first, not repeated here:** `brand-principles.md` (all nine), `rejected.md` (all of
it), `approved.md` A-011 to A-015, `brand/motion.md`, `research/landing-page/2026-09-18-structure-v1.md`,
`followup/research/product/2026-09-13-landing-page-research.md` (§5, motion and visuals) and
`2026-09-14-landing-page-company-strategy.md` (what competitors lead with). Those cover copy,
structure and page order. This file only covers the hero picture: its object, size, motion
and colour.

**How sure this is — read before quoting anything.** Every direct page fetch was blocked by
this session's network policy (linear.app, stripe.com, vercel.com, raycast.com, tympanus.net,
supahero.io, blog.logrocket.com all refused). So every row below comes from **web-search
summaries** of design write-ups, not from looking at the live sites today. Treat it as
medium confidence for the big shapes, low for exact details. Front and Framer's own hero
could not be confirmed at all and are left out rather than guessed. Before anyone builds, the
founder should open three or four of these sites on his own phone. That takes ten minutes and
beats this table.

---

## 1. In plain words

1. The best sites use **one** moving thing in the hero, not a scene. One object, one idea.
2. When they use motion, it **tells one short story**, then stops or repeats slowly. It does not decorate.
3. Their strong colour shows up in **one place**, usually the hero, and the rest of the page stays quiet.
4. The picture sits **beside or under the headline and takes about a third to half of the first screen**. The headline stays the biggest thing.
5. Real 3D costs money and speed. The good sites load the words first and the 3D after, so the page never waits on it.
6. For our buyer (a shop owner on a phone), a picture they can **read** beats a picture that just looks clever.
7. So the job is: keep the story (messages in → FollowUp → customers answered), tell it with **one object, depth and a single colour**, in **half the space**.
8. Five ways to do that are below. Sketch the one that feels like FollowUp, or mix them.

---

## 2. What real sites do (checked 2026-09-25, via search results only)

| Site | Hero object | Screen share | Does motion explain the product? | Colour | The one principle to take |
|---|---|---|---|---|---|
| **Linear** | Big headline; framed real product view below it | Product frame is large, under the type | Little; the product view carries it | Near-black ground, one soft violet accent on the main button | The headline is the only loud moment; everything else is quiet shades of one tone [1][2] |
| **Stripe** | Animated gradient behind the type, plus moving product UI | Wide band behind the headline | Partly: the product UI moves; the gradient is mood | Bright gradient on a light page | The effect is tiny (about 10 KB) and **pauses when off screen**; it never competes with the five-word line [3][4] |
| **Vercel** | A 3D prism with light (first at Next.js Conf 2022) | Large, centred | No, it is a brand symbol | Dark, with a spectrum of light | An object can stand for one idea (light split into every colour = the web). **Not to be echoed: FollowUp must not use a prism or rainbow (S-16)** [5] |
| **Apple product pages** | One product, turning or opening as you scroll | Near full screen, but one object only | Yes: each scroll step shows one feature | Product colours on black or white | **Your own scroll moves the story.** The AirPods Pro page drew 148 still frames on a canvas as you scroll [6][7] |
| **Arc (The Browser Company)** | No object; oversized white type on a textured electric-blue ground | Colour fills the hero | No | One strong blue | A single strong colour can be the whole picture if everything else stays still [8] |
| **Raycast** | Red diagonal light streaks behind a centred headline | Full hero ground | No | Pure black; red used almost only in the hero | **A strong colour kept for one moment** feels premium, not loud [9] |
| **Superhuman (2025–26 rebrand)** | One dramatic purple gradient behind white type; photography further down | Hero band | No | Mostly white/cream page, one "twilight" colour | "A single dramatic gesture of colour" on a quiet page [10][11] |
| **Intercom / Fin** | Illustrated hero animations on nearly every page | Beside the headline | Partly | Brand palette | They wrote down what the motion must feel like first: "credible, playful, advanced yet simple, authentic" [12] |
| **Attio** | Crisp product visuals with animated previews | Beside/under headline | **Yes**: previews show the work being done | Neutral, blue only on actions | Motion that **shows the job happening**, not the logo spinning [13] |
| **Pitch** | 3D and 2D mixed (hands doing tasks) | Large | Loosely, by metaphor | Bright, playful | One motion style (same curves, same easing) used everywhere makes it feel designed, not assembled [14] |
| **Spline-built sites (general)** | Interactive 3D scene reacting to mouse or scroll | Varies | Often not | Varies | Load the 3D only when it is on screen; "a hero that causes a 4-second load isn't a feature" [15][16] |
| **Squarespace** (sells to small businesses) | One square turning in 3D, in rhythm | Brand-wide | No, it is identity | Black and white | One simple shape, moved with care, can be a whole identity [17] |
| **Mailchimp** (small businesses) | Serif headline, yellow button, product previews | Beside headline | Partly | One owned colour (yellow) on warm neutrals | A small business can own **one colour** and be remembered by it [18] |
| **Podium** (direct competitor) | Headline verified: "Turn more conversations into revenue with a 24/7 AI Employee…"; visual not verified | — | — | — | The category sells a loud "AI employee". A calm, honest picture is how FollowUp looks different [19] |

**Two cross-checks.** Research summarised from Nielsen Norman Group says moving elements pull
attention away from the task, and quotes a user: *"I just want to see the info without having
to wait for some cool movement."* (low confidence, second-hand) [20]. Speed guidance: the main
content should appear within 2.5 seconds, and a 3D canvas must never be what the page waits
for; show a still image first and start the 3D after [21][22].

---

## 3. Five directions for FollowUp

All five keep the approved story and the approved words (A-013, A-014). All five take **under
half the first screen**. In all five, **the one strong colour means "answered"**: messages
coming in are grey, and the moment a customer is looked after is the only thing in colour.
That gives the colour a job (principle 8: colour carries meaning) instead of painting the page.

Honesty rule for every direction: on email FollowUp can send; on Instagram and WhatsApp it
writes the reply and the owner taps send. So the coloured end state should read **"Reply
ready"** or **"Answered"**, never a number of messages sent (principle 7).

### D1 — The catch (one 3D object)
- **In one line:** a single solid FollowUp object catches messages and sends one answer out.
- **What it literally shows:** headline on the left. On the right, FollowUp's leaf mark as a thick, softly lit tile, slightly turned. Small grey message chips (Gmail, Outlook, Instagram, WhatsApp, website form icons) come out of the dark behind it, one at a time, and sink into it. Out of the front comes one chip, in colour: "Answered · 2 min". Then the next.
- **Screen share:** about 40% of the width, about 420 px tall.
- **Why it fits:** one object, one idea (Vercel, Apple, Squarespace lesson). Motion has a source and a destination (motion.md rule 4). Depth makes it feel "advanced" without adding things.
- **Risk:** the "3D logo on dark" look is a common startup-template move (S-15). The logo becomes the hero, so the mark itself must hold up large. Heaviest to load.
- **How to build:** three honest options. (a) Pre-rendered short video from Blender or Spline, with a still image first: best lighting, lightest to run, 3–4 days. (b) Live 3D with Three.js: most control, about a week. (c) Spline embed: fastest to try, heaviest file. (b) and (c) add a new library, which needs the founder's OK first (CLAUDE.md).

### D2 — The deck (readable cards with depth)
- **In one line:** real-looking messages land on a tilted stack; the top one turns over and its back is the reply.
- **What it literally shows:** under the headline, a small stack of message cards seen at an angle. Messages drop onto it from different sides (an email, a DM, a website form, a WhatsApp). The top card lifts, flips like a playing card, and its back shows the short reply and the time, with a coloured edge. It slides onto a neat "answered" pile. Then the next one.
- **Screen share:** a centred block about 560 × 340 px, roughly a third of the first screen.
- **Why it fits:** anyone can read it (principle 9). The flip explains the whole product in one move: question on the front, answer on the back. Closest to the concept he already liked.
- **Risk:** cards can slide back into card soup (S-09) or start to look like the app (R-009). A named customer playing out a chat was "awkward" in R-007, so keep messages to one short line, no full names.
- **How to build:** CSS 3D plus framer-motion, which the site already uses. No new library. 2–3 days.

### D3 — The pocket (one phone, calm lock screen)
- **In one line:** a phone fills up with messages from five apps, and FollowUp turns them into one calm line.
- **What it literally shows:** beside the headline, one phone turned slightly in 3D, showing only a lock screen. Grey notifications pile up from Gmail, Instagram, WhatsApp, a website form. They fold together into one FollowUp notification in colour: "Reply ready for Jane. Tap to send." That line is true today: FollowUp's phone alerts shipped on 2026-09-25 and say who is waiting.
- **Screen share:** a phone about 300 px wide, about 30% of the screen.
- **Why it fits:** it is exactly where the owner lives (principle 4: on a phone, 90 seconds). Showing "tap to send" puts the approval step in the picture, which is the top trust worry (77% want to approve first).
- **Risk:** a phone mockup is a template habit (S-15). It is a lock screen, not the app, but it sits near R-009, so ask before building. A pile of notifications is an urgency picture (principle 2); the fold into one calm line has to be the clear resolution.
- **How to build:** CSS 3D phone plus framer-motion, no new library, 3–4 days. A rendered phone from Spline looks richer and needs his OK for the dependency.

### D4 — Tangle to line (abstract, colour-led)
- **In one line:** tangled grey threads go in, one clean coloured line comes out.
- **What it literally shows:** a band under the headline. On the left, five grey threads, each starting at a small channel icon, knotted together. They pass through the FollowUp mark and leave as one smooth line in the strong colour, ending at a small "Answered".
- **Screen share:** a band about 260 px tall, under a third of the screen.
- **Why it fits:** the most minimal of the five. The strong colour gets the most room. "Noise in, calm out" is the brand's own promise (principle 2).
- **Risk:** abstract. A shop owner may not read it (principles 5 and 9); it depends on the icons to say "messages". It must not drift toward Vercel's light-through-a-prism (S-16): no glass, no light beams, no rainbow.
- **How to build:** SVG plus framer-motion, 2–3 days. Three.js tubes if he wants real depth, about a week plus the dependency OK.

### D5 — Told by your scroll (Apple's lesson, applied small)
- **In one line:** the hero shows the object still; your scroll plays the story.
- **What it literally shows:** the hero holds a small, still FollowUp object (D1 or D2's). As the reader scrolls, the next screen holds in place for one screen's height and plays three steps at the reader's speed: messages arrive, FollowUp catches them, customers answered. Then it lets go.
- **Screen share:** hero object about 25%; the story uses the second screen.
- **Why it fits:** nothing moves until the reader asks it to (motion.md rule 5). The top two screens carry most attention (structure v1, finding 1), so the story still lands early.
- **Risk:** pinned scrolling can feel like the page is stuck, especially on phones. Frame sequences are heavy. The hero alone no longer tells the story.
- **How to build:** framer-motion's scroll tools with CSS 3D (no new library, 4–5 days), or a rendered frame sequence (richer, 5–7 days, heavier).

### Rules for whichever he picks
- One thing moves at a time (motion.md rule 6). The entrance plays once. If it repeats, each loop is one real event, slow, and it pauses when off screen (Stripe's habit).
- Reduced motion: the finished picture, nothing moving (motion.md rule 7).
- The headline and button appear first and never wait on the 3D.
- On phones: the object goes under the headline and gets smaller. It is never cut.
- No phone call or SMS channel in the picture. A new customer cannot buy one today.

---

## 4. Checked against rejected.md

| | D1 Catch | D2 Deck | D3 Pocket | D4 Tangle | D5 Scroll |
|---|---|---|---|---|---|
| R-005 / R-009 app dashboard | Clear | Clear if cards stay messages, not app chrome | **Near the line**: a lock screen, not the app; ask | Clear | Clear |
| R-007 awkward named chat | Clear | **Watch**: one-line messages, no full names | **Watch**: one first name at most | Clear | Depends on object |
| R-011 photo of a person | Clear | Clear | Clear (no hand holding the phone) | Clear | Clear |
| R-010 no tone change down the page | Colour on the object only | Same | Same | Same | Same |
| R-014 flat and full screen | 40%, real depth | a third, depth | 30%, depth | under a third; flattest of the five | 25% plus one screen |
| S-03 glass / S-04 neon | Keep the tile solid, not glass | Clear | Clear | No glowing lines | Clear |
| S-07 unnecessary 3D | Earns it: depth shows in → out | Earns it: the flip is the product | Earns it lightly | Weakest case for 3D | Earns it if the steps are clear |
| S-13 AI gimmicks | No sparkles, no "thinking" glow | Clear | No typing dots on the phone | Clear | Clear |
| S-15 startup template | **Risk** (3D logo) | Low | **Risk** (phone mockup) | Low | Medium |
| S-16 copying | Clear | Clear | Clear | **Risk**: stay away from a prism or light beams | Uses Apple's principle, not its page |

**Colour, flagged honestly.** A strong colour is a new decision. A-011/A-012 approved a
monochrome charcoal page, and R-004 records that ten swatches in chips produced no pick. The
lesson there: build with a placeholder colour on the real hero and change one value when he
reacts. Putting the colour on the whole hero ground would be a top-to-bottom tone change,
which R-010 rules out. So in all five directions the colour lives on the object, not the
background, unless he reopens R-010.

**My read, marked as mine:** D2 is the safest (readable, cheap, closest to the concept he
liked). D1 is the one most likely to feel "advanced". D3 is the most on-brand for who buys
it but the nearest to a rejection. D4 is the most minimal and the most likely to confuse.

---

## 5. Three questions for the founder while sketching

1. **Should a stranger be able to read it, or just feel it?** Real words on the messages (D2,
   D3), or shapes, icons and colour (D1, D4)?
2. **Beside the headline or under it?** Beside means a split screen with the picture taking
   about 40% of the width. Under means a smaller band, and the headline alone owns the top.
3. **What is your one colour, and where does it live?** Only on the "answered" moment, on a
   charcoal page (fits every rule on file), or across the hero's background, which would
   reopen R-010?

---

## Sources (all via web search, 2026-09-25; no page could be opened directly)

1. VoltAgent, Linear DESIGN.md write-up — https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
2. Linear, "A calmer interface for a product in motion", 2026-03-12 — https://linear.app/now/behind-the-latest-design-refresh (title and summary only)
3. Bram.us, "How to create the Stripe website gradient effect" — https://www.bram.us/2021/10/13/how-to-create-the-stripe-website-gradient-effect/ ; Kevin Hufnagl — https://kevinhufnagl.com/how-to-stripe-website-gradient-effect/
4. Perfect Afternoon, hero section design — https://www.perfectafternoon.com/2025/hero-section-design/
5. Codrops, "From Rays to Meshes: Building Vercel's Prism with vgpu", 2026-09-03 — https://tympanus.net/codrops/2026/09/03/from-rays-to-meshes-building-vercels-prism-with-vgpu/ (summary only)
6. CSS-Tricks, Apple product page scroll animations — https://css-tricks.com/lets-make-one-of-those-fancy-scrolling-animations-used-on-apple-product-pages/
7. Ankit Trehan, AirPods Pro scroll animation (148 frames) — https://ankittrehan2000.medium.com/creating-scroll-animations-similar-to-apples-airpods-pro-page-bc5c1c0814df
8. Fudge, arc.net design — https://design.withfudge.com/share/arc.net-design ; SaaSFrame — https://www.saasframe.io/examples/arc-landing-page
9. Fudge, raycast.com design — https://design.withfudge.com/share/raycast.com-design
10. Refero, Superhuman design system — https://styles.refero.design/style/418b374a-be64-44f0-b17e-1d45308c7e62 ; oh-my-design — https://oh-my-design.kr/design-systems/superhuman
11. The Branding Journal, Grammarly → Superhuman, 2025-12 — https://www.thebrandingjournal.com/2025/12/inside-the-decision-to-rebrand-grammarly-as-superhuman-exclusive-interview/
12. Intercom, "What's up with the new website?" — https://www.intercom.com/blog/new-website/
13. DesignRush, Attio website analysis — https://www.designrush.com/best-designs/websites/attio-website-design
14. Pastel, "3D design for the web — a chat with Pitch.com" — https://usepastel.com/blog/exploring-3d-design-for-the-web-a-chat-with-pitch-com
15. MDX, "Best 3D websites of 2026" — https://mdx.so/blog/best-3d-websites-2026-examples
16. Spline, 3D web experiences — https://spline.design/solutions/3d-web-experiences
17. It's Nice That, DIA × Squarespace — https://www.itsnicethat.com/articles/dia-squarespace-brand-refresh-graphic-design-animation-041218
18. Fudge, mailchimp.com design — https://design.withfudge.com/share/mailchimp.com-design ; Fast Company — https://www.fastcompany.com/90692591/see-mailchimps-clever-new-branding
19. Podium homepage (headline via search summary) — https://www.podium.com/
20. NN/g, "Animations are distracting" — https://www.nngroup.com/videos/distracting-animations/ ; Concrete CMS summary — https://www.concretecms.com/about/blog/web-design/using-animation-to-improve-ux
21. OpenReplay, optimising LCP — https://blog.openreplay.com/core-web-vitals-optimize-lcp/
22. Mintec, "The hero video dilemma" — https://mintec.co/blog/video-lcp-hero-performance-2026/
