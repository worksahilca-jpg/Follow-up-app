# Linear and Attio, studied deepest: how the page should feel, and how it should show the product

**Date:** 2026-09-26 · **Asked by:** Sahil ("yes study Linear and Attio next and make sure we are not missing any point
of all refrences of strategies from pdf") · **Status:** STUDIED, proposals pending approval. Sketch only (A-052).

**Questions (from the reference strategy, two of the five deepest):**
- **Linear:** how should the landing page *feel*?
- **Attio:** how should it *show the product*?

The earlier notes (`references/design-systems/2026-09-26-linear-calm-hierarchy.md` and
`references/crm/2026-09-26-attio-data-ui.md`) covered the app UI. This one covers the marketing page. It's checked
against the **sketched canvas** (Main.dc.html, Phone.dc.html), not the live site (R-019).

linear.app, attio.com, the Internet Archive and every design-breakdown site were blocked from this environment. The
sources are search summaries of Linear's and Attio's own pages plus third-party write-ups. They're graded **B**
(summary of the company's own page) or **C** (third-party write-up). Principles only; nothing is copied.

---

## Linear: what it does

- **The product is the demo (B/C).**
  - The whole homepage walks through the real product UI, with real-looking content and live activity.
  - There are no abstract illustrations and no stock dashboards.
  - Write-ups call it the most-copied B2B site of the year for exactly this.
- **One rhythm, repeated (C).** Each section has:
  - a small index label (like a figure caption in a technical document);
  - a two-column split: the title on the left, short body copy on the right;
  - then one full-width product frame.

  The pattern repeats at least four times. The sameness is what makes it read as calm.
- **The hero is a working product (B).** Directly under the headline, a real-feeling issue animates by itself as the
  work gets done.
- **Opinionated (B).**
  - Linear Method: "say no to busy work", "start simple", and flexible software "creates chaos". The product picks a
    default way of working, and the page says so.
- **Restraint in type and colour (B/C).**
  - Bold, tight display headings with lighter, roomier body text.
  - One accent.
  - Density is handled with shades of one ink, not with extra colours.
- **Proof (B).** A logo row right under the hero. No testimonials needed.

## Attio: what it does

- **One product frame, several tabs (C).**
  - A tabbed feature section switches the same frame between areas: Ask Attio, Data model, Workflows, Reporting.
  - It shows the depth without making the page longer.
- **Colour lives only inside the product (C).** The page chrome is black, white and grey. Colour appears only in the
  product preview (status dots, the one action), so the eye goes to the software.
- **Customer stories have a fixed shape (B).** For example, "Why Snackpass switched from Salesforce to Attio":
  - the outcome first, in one line;
  - the old pain;
  - the switch;
  - the customer's own words;
  - a specific result.
- **The hero plays on the category (B).** "Customer relationship magic": the headline plays on what CRM stands for.
  There are two actions, with logos and quotes lower down.

### The principles underneath

- **P1 (Linear):** Show the real product doing the real job. A drawing of it is weaker than the thing.
- **P2 (Linear):** One section rhythm, repeated. Label, title, one line, one product frame. Consistency is calm.
- **P3 (Linear):** Be opinionated out loud. Say what the product decides for you.
- **P4 (Attio):** Show depth in one frame with tabs, not in more sections. Simple outside, more underneath.
- **P5 (Attio):** The page is monochrome. Colour means "this is the product".
- **P6 (Attio):** Proof has one shape: outcome, before, switch, their words, their number.

## What FollowUp doesn't take

- **Live product UI under the hero headline (Linear's hero).** The founder rejected this twice: R-005 and R-009 ("I
  don't want app dashboard"). Our hero stays the lead-flow illustration. Product frames live further down, which R-009
  explicitly allows.
- **A logo row under the hero.** We have no real logos, and A-023 rules out fake ones.
- **Dark-mode-first and an indigo accent.** The sketched canvas is warm and light (R-019).
- **A category pun as the headline.** The founder's own headline stays (A-013).
- **Bold display headings.** The canvas uses Public Sans 300 (R-019, A-022).

---

## Where the sketched canvas stands (Main.dc.html, 2026-09-26)

The canvas landing runs:
1. Hero: headline, lede that explains, Start free and See it work, $0 / no card.
2. Works with.
3. The gap.
4. What changes: "Two minutes to connect. Then this changes."
5. Examples: how a normal week goes.
6. See it working.
7. Your control.
8. Pricing.
9. Questions.
10. Start free.

Against P1 to P6:
- **P1, partly.**
  - "See it working" and the hero fragment show the product.
  - "What changes" and "Examples" are cards of text, not product frames.
- **P2, no.** Each section has its own layout (text cards, a week table, an interactive frame, four promise cards).
  There's no shared rhythm, so the page reads as a set of different blocks.
- **P3, partly.** The promises say what it won't do. Nothing says what it decides for you ("It picks who comes
  first. You don't sort anything.").
- **P4, missing.** "See it working" already uses tabs, but for moments (the same job), not for depth. There's no
  section with the "simple outside, more underneath" idea. Follow-up plans, rules, the
  weekly report and Waiting on customers all exist as app boards, but none of them is on the landing page.
- **P5, yes.** The page is ink and grey, and the wash marks the product's own reply.
- **P6, partly.** ProofWaiting has before → after and their words, but there's no story shape for a customer who
  agrees to more.

---

## Proposals (ranked)

1. **"Simple on the outside" (P4 + the PDF's Product depth step).**
   - One section after Your control, before Pricing: one product frame with four tabs:
     - **Today**: who needs you;
     - **Follow-up plans**: when it checks in;
     - **Rules**: what waits for you;
     - **Your week**: the weekly email.
   - Each tab shows the real sketched screen (they already exist as app boards) with one caption line.
   - It uses the same tab device See it working already has, so nothing new is invented.
   - The phone shows the same four as a swipe, one at a time (R-015).
   - Heading: "Simple on the outside. The rest is there when you want it."
2. **How it works in three steps, as real frames (P1 + the PDF's How it works step).**
   - "What changes" becomes **Connect → Find → Follow up**. Each step is a small real frame:
     - the source switches;
     - Today with one customer and the reason;
     - the reply in the wash with Send.
   - This closes the gap the PDF names ("Connect → Find → Follow up").
3. **One section rhythm (P2).**
   - Every section below the hero uses: eyebrow → heading on the left, one line on the right → one full-width product
     frame.
   - Examples, See it working and Your control keep their content and move into the rhythm.
   - This is layout only. No words change.
4. **Say what it decides (P3).**
   - One line in See it working: "It decides who comes first and what to say. You decide what gets sent."
   - This says the opinion out loud and keeps the owner in charge.
5. **A proof story template, hidden until real (P6, A-023).**
   - Each ProofWaiting card opens a one-page story in a fixed shape:
     - "How [Business] stopped losing leads";
     - their number, before → after;
     - the old way, in their words;
     - the first week;
     - one screen from their account, shown with permission.
   - It renders only when every field is real and they've agreed in writing.

**Found while checking (not a proposal, a correction):** "What changes", card 3, says "Simple replies can go on
their own. Your choice." Since 2026-09-2x every reply waits for the owner by default and Autonomous is refused. The
card should say "Every reply waits for your OK." Truth outranks the old copy.

**Rejected-list check:**
- R-005 / R-009: nothing product-shaped goes near the hero. The frames are mid-page.
- R-015: the phone gets one tab or one step at a time.
- R-018: replies use the wash, not black.
- R-019: everything is in the canvas system.
- A-023: no logos, and proof is hidden until real.
- R-002 (keyboard-first): not used.

## Sources

- Linear:
  - [Linear homepage](https://linear.app/) (B, via search summary)
  - [Linear Method](https://linear.app/method)
  - [Linear Method: Principles & Practices](https://linear.app/method/introduction)
  - [A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh)
- Linear, third-party (C):
  - [Userpilot, SaaS landing pages 2026](https://userpilot.com/blog/saas-landing-pages/)
  - [Toimi, best SaaS website designs 2026](https://toimi.pro/blog/best-saas-website-designs/)
  - [Figma Blog, The Linear Method: Opinionated Software](https://www.figma.com/blog/the-linear-method-opinionated-software/)
  - [LogRocket, Linear design](https://blog.logrocket.com/ux-design/linear-design/)
  - [Viktor Shmatko, Why Linear's website works](https://viktorshmatko.com/blog/why-linears-website-works-so-well)
- Attio:
  - [Why Snackpass switched from Salesforce to Attio](https://attio.com/customers/snackpass) (B)
  - [Attio customers](https://attio.com/customers) (B)
  - [Attio: Customer relationship magic (Product Hunt)](https://www.producthunt.com/products/attio) (B)
- Attio, third-party (C):
  - [SaaSFrame, Attio landing page](https://www.saasframe.io/examples/attio-landing-page)
  - [Lapa Ninja, Attio](https://www.lapa.ninja/post/attio/)
  - [How Attio grows](https://www.howtheygrow.co/p/how-attio-grows)
