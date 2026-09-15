# The back-catalogue consent screen — copy and flow spec

**Date:** 2026-09-15
**Author:** product-ux (copy + flow only). **This is a handover document for `frontend-3d-agent`.**
No React was written and no file under `followup/src/**` was touched.
**Data source:** `followup/src/lib/reactivation.ts` — `ReactivationBatch`, `ReactivationBucket`,
`classifyQuietLeads()`. Nothing in this spec asks for a field that file doesn't already return.
**Working name / route:** `/catch-up`. Not a new nav item — see §1.2.

**Which PRODUCT_DIRECTION rule this serves:** Rule 1 (depth on the job — this is mission point 2,
"rescuing cold, dead, or never-reached leads", which no generalist CRM does) and Rule 3 (trust
ships like a feature — the STOP button and the consent record *are* the guarantee here).
**Moat or table stakes:** moat-leaning. The classification pass that tells a bought customer from
a dropped lead before anything sends is the hard part, and it is the part a bulk-email tool skips.

**Read before implementing:** `../../../CLAUDE.md`, `design-brain/decisions/rejected.md`,
`design-brain/decisions/approved.md` (A-003, A-005, A-006), `design-brain/components/states.md`,
`design-brain/decisions/design-decisions.md` D-007 and D-019. §8 lists every place this spec
collides with one of them.

---

## 1. The problem, stated once

An owner connects an inbox. FollowUp imports 90 days and finds 200 quiet leads. Some bought. Some
said no. Some moved to a phone call. Some were simply dropped. Asking "still interested?" of a
customer who bought six weeks ago is worse than sending nothing — it tells them the business
doesn't know who its own customers are.

So the screen has exactly one job: **get a real, informed yes or no on messaging the leads that
genuinely went quiet, without making the owner read 200 cards.**

### 1.1 What the owner is actually afraid of

Not "will this work." It's *"what is about to go out in my name, to people who know me?"* The trust
research on file says the same thing: 77% of consumers want human approval before an agent acts,
and 65.5% of business owners specifically fear AI making their business feel less authentic to
their own customers (`research/customers/2026-09-05-icp-pain-and-trust-objections.md`, §3 — note
that file's own caveat: search-snippet-sourced, not fetch-verified; steer by it, don't quote it on
a landing page). That fear is the reason the drafts sit *above* the buttons in §3, not behind them.

### 1.2 Where it lives, and when it appears

- **Route:** `/catch-up`.
- **Not a nav item.** The sidebar is already over-loaded (`research/product/2026-09-10-ux-simplification.md`
  §2 argues 7 → 4; D-007 already flagged nav pressure). Entry is one strip on Today.
- **Shown once, deliberately, right after the first import finishes** — as the hand-off from
  onboarding, not as a modal that ambushes the first dashboard view. A decision about messaging 43
  real people deserves a screen, not a dialog the owner dismisses to get to the app.
- **Always reachable afterwards** from the same Today strip, for as long as any bucket is non-empty.

**Today strip copy (the only entry point):**

> **200 old leads are sitting in your inbox. We've sorted them.**
> `Take a look →`  ·  `Not now`

`Not now` hides the strip for 7 days. It never disappears permanently while leads are waiting — but
it never nags twice in a day either.

---

## 2. Information hierarchy — what gets read, in order

| # | What | Why it's here |
|---|---|---|
| 1 | **The ask, in one sentence with a number** — "43 leads went cold. We've drafted a message for each." | The owner has 90 seconds on a phone (`brand-principles.md` 4). One sentence is the whole screen if they read nothing else. |
| 2 | **Three real drafts, in full, with the recipient's name and the reason above each** | This is the answer to the actual fear (§1.1). Proof comes *before* permission. An owner cannot press "Send all" without the words having been on screen. |
| 3 | **The three buttons** — `Review all 43` · `Send all 43` · `Not now` | The decision, immediately under the evidence for it. |
| 4 | **The second question: the people you never answered** | Separate consent, separate message, and the bucket where the business is at fault. See §5 — it is argued there that this goes *above* item 1 when it's non-empty. |
| 5 | **What we're not asking about** — closed, off-platform, unclear, still counting | Context that makes the number in item 1 legible. `reactivation.ts` argues this in its own comments: "43 went cold · 9 you never replied to · 112 look finished · 6 moved to a phone call" is a permission request; "43" alone is a number. |
| 6 | **The one thing that needs a human tap** — off-platform resolution | A real task, but a smaller one, and it can wait until the sending decision is made. |

**Why not lead with the full catalogue breakdown?** Because five counts is five decisions, and the
owner only has one to make right now. The breakdown is *reassurance that the 43 is trustworthy*,
which is a supporting role, not the headline.

**Standing rule for every bucket on this screen: no bucket is ever only a number.** Every bucket is
expandable, and every row inside carries its `reason` line verbatim from the classifier. A count
with no reasons is not something a person can consent to.

---

## 3. The flow — every state, every button

### S0 · Loading (< 2s)
Skeleton in the shape of the real content. No spinner under 300ms (`states.md`). Nothing else.

---

### S1 · Still reading (nothing judged yet)
`unjudged > 0` and every bucket total is 0.

> **We're reading through 200 old conversations.**
> Working out which ones are finished, which went quiet, and which you never got back to.
> Nothing is sent while we do this.
>
> **12 of 200 read so far.** This keeps going if you close the page.
>
> `Show me what you have so far` (disabled until ≥ 1 bucket is non-empty) · `I'll come back later`

- **`Show me what you have so far`** → S2.
- **`I'll come back later`** → Today. Classification continues server-side.
- No progress bar. A bar implies a deadline the owner should wait on; classification is batched
  (`DEFAULT_CLASSIFY_LIMIT = 60` per run) and can take several runs on a five-year inbox. A sentence
  with two honest numbers says more and demands less. `states.md` allows progress "if measurable" —
  it is measurable, and it's stated as a count, not a bar.
- **This state must never look like an error or like work is stalled.** It is the product doing the
  careful thing.

---

### S2 · The consent moment (the main screen)

**Structure, top to bottom:**

```
[ If neverReplied.total > 0 — the apology block. See §5. ]

43 leads went cold.
We've drafted a message for each.

  Sarah Whitfield · last spoke 62 days ago
  They asked when you could start; you answered, then nothing.
  ┌ the draft, in full, as it will be received ┐

  Marcus Ruiz · last spoke 71 days ago
  They were comparing quotes and went quiet after yours.
  ┌ the draft, in full ┐

  Devon Blake · last spoke 88 days ago
  They asked for a Tuesday slot and never confirmed.
  ┌ the draft, in full ┐

  3 of 43, oldest first.   Show me 3 more

[ Review all 43 ]   [ Send all 43 ]   [ Not now ]

Anyone who replies is taken off automatically. Nothing else is sent to them.

—— What we're not asking about ————————————————
112 look finished — bought, delivered, or declined.   Show
6 moved to a call or a text.                          Sort these out →
9 we couldn't place.                                  Show
Still reading 30 more.
```

**Every string, exactly:**

| Element | Copy |
|---|---|
| Headline (cold) | `43 leads went cold.` |
| Sub-line | `We've drafted a message for each.` |
| Draft row — name line | `Sarah Whitfield · last spoke 62 days ago` |
| Draft row — reason | the `reason` string from the classifier, verbatim, no prefix, no quotes |
| Sample honesty line | `3 of 43, oldest first.` |
| Re-sample link | `Show me 3 more` |
| Primary row | `Review all 43` · `Send all 43` · `Not now` |
| The guarantee, under the buttons | `Anyone who replies is taken off automatically. Nothing else is sent to them.` |
| Section divider | `What we're not asking about` |
| Closed row | `112 look finished — bought, delivered, or declined.` → `Show` |
| Off-platform row | `6 moved to a call or a text.` → `Sort these out →` |
| Unclear row | `9 we couldn't place. We won't message these.` → `Show` |
| Unjudged row | `Still reading 30 more.` |

**What each button does:**

- **`Review all 43`** → S3 (one at a time). The existing Review pattern from D-007: one draft, full
  size, reason above it, thread one tap away. Per-draft: `Send` · `Edit` · `Skip this one`.
  Closing Review mid-way returns to S2 with the count updated (`Send all 38`) and a line above the
  buttons: `5 sent, 38 to go.`
- **`Send all 43`** → the button row is replaced **in place** (no modal, no new screen) by:
  > **Send 43 emails from manoj@riversideplumbing.com?**
  > They go out one at a time, not as one blast. You can stop at any point.
  > `Yes, send them` · `Cancel`

  `Yes, send them` → S4. `Cancel` → back to the three buttons, nothing sent.
- **`Not now`** → Today. Nothing sent, nothing changed, no verdicts discarded. The Today strip stays.

**Rules that are not negotiable here:**

1. **The three drafts are on the screen, not behind a click.** This is what makes "Send all"
   defensible at all — see §8, collision 1.
2. **The sample is honest about being a sample.** "3 of 43, oldest first" plus `Show me 3 more`.
   Three hand-picked examples with no stated selection rule is a demo, not evidence.
3. **The number in the button is the number that will send.** It only ever covers leads already
   judged. If classification finishes more leads while the owner is reading, **they are not silently
   added** — the screen shows `+7 more since you opened this. Include them?` and the button count
   only changes if the owner taps it.
4. **One box level.** The draft is not a box inside a card inside a section (S-09, and the exact
   fault D-019 fixed in `ApprovalQueue`). Name, reason, message: one container, separated by
   spacing and one hairline, not by nested borders.

---

### S3 · Review, one at a time
Reuses D-007's shape; not redesigned here. Copy that is specific to this flow:

- Header: `43 to look at · 1 of 43`
- Under the draft: `Held for you because you asked to see them all.` (Not "held because risky" —
  that's a different, existing state and must not be confused with it.)
- Buttons: `Send` · `Edit` · `Skip this one`
- On the last one: `That's all 43. 38 sent, 5 skipped.` → `Done`
- Leaving early: `Leave the rest for now` → back to S2.
- **No keyboard shortcuts, no shortcut hints, no "fast once you learn it" framing** (R-002).

---

### S4 · Sending, with the STOP

The screen replaces the buttons with a live state. Nothing else on the page moves.

> **Sending. 12 of 43 gone out.**
> Sarah Whitfield, Marcus Ruiz, Devon Blake, and 9 more.
> Going out one at a time. This keeps going if you close the page.
>
> `Stop sending`

| Element | Copy |
|---|---|
| Counter | `Sending. 12 of 43 gone out.` |
| Who | the last 3 names sent, then `and N more` |
| Pace + persistence | `Going out one at a time. This keeps going if you close the page.` |
| The button | `Stop sending` |

**No copy on this screen states a send rate.** The shipped spacing is `SEND_SPACING_MS = 1200`
(`src/lib/reactivationSend.ts`), so a 43-lead batch is over in under a minute; any sentence
promising "about one a minute" would be false. "One at a time" is true at any spacing and survives
the constant being tuned.

- **`Stop sending`** → stops immediately. No confirm dialog: a stop button that asks "are you sure"
  is not a stop button. → S5.
- **The counter is the only moving element on the screen.** No animation on anything else (S-08).
- **`Stop sending` must also be reachable from Today** while a batch is live — one line in the same
  strip: `Sending to 43 cold leads — 12 gone out.` `Stop sending`. An owner who closes the tab
  expecting it to stop and comes back to 43 sent messages is exactly the ambush
  `brand-principles.md` 1 forbids; the copy above says plainly that it keeps going, and the stop
  stays within reach.
- **If a lead replies mid-batch**, they are dropped from the queue silently and the total drops:
  `Sending. 12 of 42 gone out. Marcus Ruiz replied — taken off.` That guarantee is the product's
  (PRODUCT_DIRECTION Rule 3); this screen is where it is most visible, so it gets said in words the
  moment it happens.

---

### S5 · Stopped partway

> **Stopped. 12 sent, 31 not sent.**
> The 12 are already out — those can't be pulled back.
> The other 31 haven't been touched. They're exactly as they were.
>
> `Send the rest` · `Look through them first` · `Leave them`

- **`Send the rest`** → S4 with the remaining 31.
- **`Look through them first`** → S3 scoped to the 31.
- **`Leave them`** → Today. The Today strip changes to `31 cold leads still waiting.`
- **Never a dead end** (`states.md` rule 1) and **never softened**. "The 12 are already out — those
  can't be pulled back" is the sentence an owner needs and the one a lesser product omits.

---

### S6 · Done

> **43 sent.**
> We'll tell you the moment anyone replies. Nothing else goes out to them.
>
> `Back to Today`

- **No celebration of volume.** No confetti, no "🎉", no large trophy number.
  `brand-principles.md` 7's test is literal: *does this screen make sending more messages feel like
  winning? Then it's wrong.* Messages sent is not a success metric; replies are. The reply, when it
  comes, is the thing FollowUp gets to be pleased about — and that already has a home ("came back"
  on Today, `outcomes.ts`).
- If some were skipped in Review: `38 sent. 5 you skipped are still sitting in Leads.`

---

### S7 · The off-platform pass (`Sort these out →`)

Six leads, one screen, one row each. Not a wizard — all six visible, answered in any order.

> **6 conversations moved off email.**
> We can't see what happened next. One tap each and we'll stop guessing.
>
>   Priya Raman · last spoke 34 days ago
>   You swapped numbers and the thread ends there.
>   `Won` · `Lost` · `Still open`
>
>   … 5 more rows, same shape
>
> `Done` · `I'll do this later`

| Element | Copy |
|---|---|
| Heading | `6 conversations moved off email.` |
| Body | `We can't see what happened next. One tap each and we'll stop guessing.` |
| Row reason | the classifier's `reason`, verbatim |
| Buttons per row | `Won` · `Lost` · `Still open` |
| After a tap | the row collapses to `Priya Raman — won.` with `Undo` for as long as the screen is open |
| Footer | `Done` · `I'll do this later` |
| All six answered | `All six sorted. That's your whole back catalogue accounted for.` |

- **`Won` / `Lost`** → the lead's stage is set, which permanently removes them from every future
  batch — `reactivation.ts`'s `OWNER_CONCLUDED_STAGES` already excludes WON/LOST from both the
  classify pass and every bucket. The owner's own answer outranking the AI's guess is already the
  code's rule; the copy should not imply anything weaker.
- **`Still open`** → the lead goes back into normal follow-up. Copy: `Still open — we'll treat them
  like any other live lead.` *(Behaviour note for the CEO: whether "still open" also re-queues a
  draft is a product decision, not a copy one. This spec assumes it does not send anything today.)*
- **`I'll do this later`** → Today. The row stays on S2.

---

### S8 · Nothing to ask about (all-clear)
Every messageable bucket empty, classification finished.

> **Nothing's been left hanging.**
> We read 200 old conversations. They all look finished or already handled.
>
> `Back to Today`

This is the **"genuinely clear" empty state** from `states.md`, not first-run and not "no results".
Calm success. No apology, no manufactured next step, no nag.

---

### S9 · Errors

| When | Copy | Action |
|---|---|---|
| Classification can't finish (API down) | `We couldn't finish reading your inbox. Nothing was sent and nothing was lost — we'll pick up where we stopped.` | `Try again` · `Back to Today` |
| Some sends failed | `39 sent. 4 didn't go out — Gmail rejected them.` | `Try those 4 again` · `Leave them` |
| All sends failed | `Nothing went out. Your inbox connection dropped.` | `Reconnect Gmail` · `Back to Today` |
| Inbox disconnected before send | `Your Gmail connection expired, so nothing can send yet.` | `Reconnect Gmail` |
| Batch already running in another tab | `You've already got a batch sending — 12 of 43 gone out.` | `Show me` (→ S4) |

**A silent failure here is an existential failure, not a cosmetic one** (`states.md`). Every count
on the done screen must be a real count of what actually left, never the count of what was queued.
Failures are never rolled into the sent number.

---

## 4. Colour, density, and the bits the frontend agent decides

Not my call to style, but A-006 sets hard constraints that a copy spec can hand over cleanly:

- **Colour never carries meaning alone.** Every coloured element names its state in words in the
  same box. Cover the colour and the screen still reads.
- **At most three hues, one per box:** `--coral` on the never-answered block (it genuinely needs
  attention now — A-005's meaning), `--gold` on the cold block (A-004: `--gold` is "going cold" and
  nothing else), `--slate` on the off-platform block ("unknown"). **Closed and unclear get no hue
  at all** — they are facts, not states needing action.
- **No legend, no key, nothing the owner has to learn** (A-006's hard constraint; R-002's failure
  mode).
- **Primary buttons are `--ink`** (A-003). `Send all 43` is not a marketing CTA and must not be
  styled as one. The accent is held back (A-006 axis 6) and if it is spent anywhere on this screen
  it is spent once.
- **`Stop sending` is not coral.** It is not an error or an alarm — it is the owner being in
  control, which is the calmest fact on the screen. D-019's whole lesson: reaching for the urgent
  treatment on a routine trust interaction teaches the opposite of what FollowUp is.
- **One box level. No card-in-card** (S-09, D-019 finding 2). The draft preview is the single
  likeliest place in the whole app to reproduce that fault.
- **This is not a hairline list.** R-001 is explicit that subtraction alone reads as unfinished to
  this founder. Dense, boxed, soft corners, real shadow (A-006 axes 1, 2, 5) — a designed screen,
  not a stripped one.

---

## 5. Where `neverReplied` goes — the recommendation and the argument

**Recommendation: same screen, its own block, its own consent, and placed ABOVE the cold block
whenever it's non-empty. No "Send all" is offered for it — `Review` is the only way these go out.**

### The block

> **9 people asked you something and never got an answer.**
> These need a real reply, not a check-in. We've written each one — read them before they go.
>
>   Ana Cardoso · wrote 47 days ago, never heard back
>   They asked what a full re-pipe costs. Nobody answered.
>   ┌ the draft, in full ┐
>
>   `Read all 9` · `Not now`

| Element | Copy |
|---|---|
| Heading | `9 people asked you something and never got an answer.` |
| Body | `These need a real reply, not a check-in. We've written each one — read them before they go.` |
| Row reason | classifier `reason`, verbatim |
| Buttons | `Read all 9` · `Not now` |
| Why no send-all (shown as one quiet line) | `We won't send these without you. An answer to a real question should come from you.` |

### Why not a separate screen
A separate screen is a screen this owner never opens. They get one first-run moment with 90
seconds of attention; the second destination gets found in month three, if ever. And these are the
**most wronged people in the catalogue** — they asked a question and got silence. Burying the
apology behind a second navigation step is the worst available outcome, and it happens to be the
most defensible-sounding one, which is why it needs naming and rejecting explicitly.
`reactivation.ts`'s own comment makes the structural half of the same argument: the buckets are
returned together on purpose, because the whole catalogue is what makes any one number legible.

### Why not merged into the cold "Send all"
Because it is a different message and a different risk. `reactivation.ts` says it plainly:
*"'Just checking in — still interested?' to someone whose question you ignored for two months is
not a follow-up, it's an insult."* The cadence research independently names "just checking in" and
"circling back" as the specific thing not to send to a cold contact
(`research/product/2026-09-09-followup-cadence-best-practices.md` §3, vendor-published sources —
directional, not precise). One consent covering both messages would be consent to something the
owner never read.

There's a second, harder reason: **the correct message here contains an actual answer** — a price,
a lead time, an availability. That is exactly the content FollowUp's risk gate already holds for
human approval on every other path. Offering "Send all" here would mean auto-sending 9 answers to
9 direct questions, which contradicts the product's own safety model rather than merely being
cautious.

### Why above the cold block, not below
This is the one place I've reordered the founder's own example ("43 leads went cold" as the
headline), so it's flagged rather than done quietly. Three reasons:
1. **It's the bucket where the business is at fault.** The other 43 stopped replying; these 9 were
   dropped. A screen that leads with the 43 and mentions the 9 underneath has its moral priority
   backwards, and an owner will notice.
2. **It's smaller and easier.** 9 is a yes a busy person can actually give; 43 is a decision.
3. **It is the mission, literally.** PRODUCT_DIRECTION's mission names "the leads that have never
   been reached" as the thing nobody is doing. This bucket *is* that sentence.

It is still **one screen and two questions** — not 200 cards, and not two screens. If the founder
reads the reorder as a deviation from "one question," the fallback is: keep cold first, keep the
never-answered block on the same screen directly beneath it. What must not happen either way is
merging the two consents or moving the 9 somewhere else.

---

## 6. What I deliberately left out

| Left out | Why |
|---|---|
| **Per-lead checkboxes / "select 30 of 43"** | The founder's first constraint is one question, not 200 cards. A 200-row multi-select on a phone is the generic CRM answer, and `Review` already covers "send some, not all." |
| **Bulk editing the drafts, or a template editor on this screen** | Editing one message that goes to 43 different people is a mail-merge, and a mail-merge is the blast tool (`brand-principles.md` 7). Editing is per-lead, inside Review. |
| **"Send all" on the never-answered bucket** | §5. It would auto-send answers to direct questions. |
| **Scheduling ("send these Tuesday 9am")** | A setting on a first-run consent screen. If it matters, it's a default, not a control. |
| **A confidence percentage on the classifier's verdict** | False precision, already excluded by D-007. The `reason` sentence is the honest version and it's already on every row. |
| **A colour legend or key** | Forbidden by A-006's hard constraint. |
| **Keyboard shortcuts through the review queue** | R-002, permanently closed for this ICP. |
| **Messaging `closed` or `unclear` at all** | The entire reason the classification pass exists. They are counted, shown with reasons on demand, and left alone. |
| **A progress bar during classification** | §S1 — two honest numbers demand less and say more. |
| **An estimated-revenue figure ("$48,000 sitting cold")** | It would be a fabrication — imported leads have no deal value — and the register is manufactured urgency, which `brand-principles.md` 2 inverts on purpose. |
| **Unsend / undo after a message has left** | It can't be done, so it must not be implied. S5 says so in plain words instead. |
| **Multi-touch reactivation campaigns from this screen** | The research supports 7–12 touches over 30–60 days for dormant databases (`2026-09-09-followup-cadence-best-practices.md` §3), but that is a Workflow, and enrolling 43 people in a 12-touch sequence from a first-run consent screen is precisely the thing this product promises not to be. One message, one consent. Sequences stay opt-in per lead. |
| **Any change to the daily approval queue** | This screen's batch consent is scoped to the back catalogue, once. It is explicitly **not** a precedent for "approve all" on the rolling daily queue — see §8. |

---

## 7. What's weak about this spec

Named rather than hidden, per `design-review.md`'s standard:

1. **Three drafts may not be enough proof for 43 sends.** `Show me 3 more` is a mitigation, not an
   answer. If the drafts turn out to be near-identical to each other, the preview proves less than
   it appears to — and nobody has looked at 43 real ones yet.
2. **Everything rests on `reason` being written in plain English.** D-007 flagged the identical
   risk for `scoreReason` and it is still unverified. If `classifyThreadOutcome` emits "engagement
   lapse detected" instead of "They asked when you could start; no answer", the whole screen fails
   and no amount of layout saves it. **Worth checking against real classifier output before build.**
3. **The reorder in §5 is a judgement call**, argued but not tested with the founder.
4. **The STOP button is real in code but barely reachable for a small batch.** The shipped loop
   re-reads the run's status before every single send (`runReactivationSend`), so Stop genuinely
   kills the rest mid-flight — but at `SEND_SPACING_MS = 1200`, 43 leads are done in ~52 seconds.
   An owner who taps `Send all 43`, reads the first line of the progress copy and reconsiders has
   almost no window. **This is a behaviour question for the CEO, not a copy fix:** the spacing
   constant is what makes the founder's request #3 meaningful in practice. A 200-lead catalogue
   (~4 minutes) is fine; a 20-lead one is over before the screen finishes rendering.
5. **The off-platform pass is the most skippable thing here** and probably the one that decays —
   six unanswered rows will still be sitting there in a month. No good answer in this pass.

---

## 8. Collisions with approved / rejected decisions — named, not worked around

**1. `Send all` vs. D-007's explicit exclusion of bulk approve-all.** D-007 ("Review") lists under
*deliberately excluded*: **"bulk 'approve all' (it is the blast-tool affordance, and S-13's
sibling)"**, and `brand-principles.md` 7 says *"no bulk-message-everyone as a primary action."* The
founder has explicitly asked for `Send all`.

- **Status matters:** D-007 is marked *"proposed — awaiting founder approval, not yet
  implemented."* It is a Claude-authored exclusion, not a founder rejection, and it is **not in
  `rejected.md`**. So this is not a dead idea being re-proposed — but it is a documented position
  being knowingly departed from, which is what this section exists to record.
- **How the spec reconciles them, rather than ignoring one:** (a) the drafts are on screen before
  the button, so "send all" can never be pressed blind — which is D-007's own stated resolution,
  *"the resolution is not friction: it is making the content unavoidable"*; (b) the send is paced
  and stoppable, so it is a queue at human scale, not a blast; (c) it is scoped to a one-time back
  catalogue with a finite, stated count, not a recurring bulk action; (d) it is explicitly **not**
  extended to the daily approval queue, where D-007's reasoning about training rubber-stamping
  still fully applies.
- **If the founder wants the stronger version**, the single change is to make `Review all 43` the
  only path and drop `Send all` entirely. That's his call, not mine, and it costs him the thing he
  asked for.

**2. Pacing and server-side sending — resolved in parallel, already built.** A real STOP that kills
the rest mid-flight is only possible if the send is a paced server-side queue. It is:
`src/lib/reactivationSend.ts` (uncommitted on this branch as of writing) implements
`startReactivationRun` / `runReactivationSend` / `stopReactivationRun`, re-reads the run status
before every send, re-checks eligibility per lead so a reply or a STOP mid-batch takes that person
out, claims each lead before drafting so nobody is messaged twice, and writes
`reactivation.batch_approved` / `batch_stopped` / `batch_completed` audit rows. That last one is
the consent record this screen's copy is promising, and it already exists — the screen should be
built against that lifecycle, not a new one. Two notes for whoever wires it up:
- `previewReactivationDrafts(businessId, n)` returns the first `n` sendable leads, oldest first,
  drafted through the same code path that would send them. `Show me 3 more` is that call with
  `n = 6`, rendering all six — which is why §3's sample line can honestly say "oldest first."
- `sendableWhere()` restricts sending to `quietOutcome: "COLD"` and **deliberately excludes
  `COLD_UNANSWERED`**, with the same reasoning as §5. The never-answered bucket has no bulk send
  path in code, which means §5's recommendation is not just a copy preference — implementing a
  "Send all" there would require changing that query, and it shouldn't be changed.

**3. S-09 / D-019 — the draft preview is a card-in-card trap.** D-019 found exactly this fault in
`ApprovalQueue` (a said-message box and a draft box nested inside a bordered card). Three drafts
stacked on a consent screen will reproduce it by default. One box level, spacing and a single
hairline for separation.

**4. R-001 — do not hand this over as a subtraction exercise.** A plain hairline list of names and
reasons satisfies every word of this spec and would still be rejected. Dense, boxed, soft corners,
real shadow (A-006).

**5. A-006's reference file is missing.** A-006 cites
`design-brain/decisions/2026-09-15-app-layout-plan.md` and D-023 as evidence; neither exists in the
repo as of this write-up. The six A/B answers in A-006 itself are enough to build from, but whoever
owns the design brain should either write that file or fix the reference.

---

## 9. Every string, in one table (for implementation)

| Key | String |
|---|---|
| `entry.strip.title` | `200 old leads are sitting in your inbox. We've sorted them.` |
| `entry.strip.cta` | `Take a look →` |
| `entry.strip.dismiss` | `Not now` |
| `classifying.title` | `We're reading through 200 old conversations.` |
| `classifying.body` | `Working out which ones are finished, which went quiet, and which you never got back to. Nothing is sent while we do this.` |
| `classifying.count` | `12 of 200 read so far. This keeps going if you close the page.` |
| `classifying.cta` | `Show me what you have so far` |
| `classifying.dismiss` | `I'll come back later` |
| `never.title` | `9 people asked you something and never got an answer.` |
| `never.body` | `These need a real reply, not a check-in. We've written each one — read them before they go.` |
| `never.nosendall` | `We won't send these without you. An answer to a real question should come from you.` |
| `never.cta` | `Read all 9` |
| `never.dismiss` | `Not now` |
| `cold.title` | `43 leads went cold.` |
| `cold.body` | `We've drafted a message for each.` |
| `cold.sample` | `3 of 43, oldest first.` |
| `cold.resample` | `Show me 3 more` |
| `cold.review` | `Review all 43` |
| `cold.sendall` | `Send all 43` |
| `cold.dismiss` | `Not now` |
| `cold.guarantee` | `Anyone who replies is taken off automatically. Nothing else is sent to them.` |
| `cold.newlyjudged` | `+7 more since you opened this. Include them?` |
| `confirm.title` | `Send 43 emails from manoj@riversideplumbing.com?` |
| `confirm.body` | `They go out one at a time, not as one blast. You can stop at any point.` |
| `confirm.yes` | `Yes, send them` |
| `confirm.no` | `Cancel` |
| `rest.title` | `What we're not asking about` |
| `rest.closed` | `112 look finished — bought, delivered, or declined.` |
| `rest.offplatform` | `6 moved to a call or a text.` |
| `rest.offplatform.cta` | `Sort these out →` |
| `rest.unclear` | `9 we couldn't place. We won't message these.` |
| `rest.unjudged` | `Still reading 30 more.` |
| `rest.show` | `Show` |
| `review.header` | `43 to look at · 1 of 43` |
| `review.held` | `Held for you because you asked to see them all.` |
| `review.send` | `Send` |
| `review.edit` | `Edit` |
| `review.skip` | `Skip this one` |
| `review.leave` | `Leave the rest for now` |
| `review.end` | `That's all 43. 38 sent, 5 skipped.` |
| `sending.counter` | `Sending. 12 of 43 gone out.` |
| `sending.pace` | `Going out one at a time. This keeps going if you close the page.` |
| `sending.stop` | `Stop sending` |
| `sending.replied` | `Marcus Ruiz replied — taken off.` |
| `stopped.title` | `Stopped. 12 sent, 31 not sent.` |
| `stopped.body` | `The 12 are already out — those can't be pulled back. The other 31 haven't been touched. They're exactly as they were.` |
| `stopped.resume` | `Send the rest` |
| `stopped.review` | `Look through them first` |
| `stopped.leave` | `Leave them` |
| `done.title` | `43 sent.` |
| `done.body` | `We'll tell you the moment anyone replies. Nothing else goes out to them.` |
| `done.partial` | `38 sent. 5 you skipped are still sitting in Leads.` |
| `done.cta` | `Back to Today` |
| `offplatform.title` | `6 conversations moved off email.` |
| `offplatform.body` | `We can't see what happened next. One tap each and we'll stop guessing.` |
| `offplatform.won` | `Won` |
| `offplatform.lost` | `Lost` |
| `offplatform.open` | `Still open` |
| `offplatform.open.note` | `Still open — we'll treat them like any other live lead.` |
| `offplatform.undo` | `Undo` |
| `offplatform.done` | `All six sorted. That's your whole back catalogue accounted for.` |
| `offplatform.later` | `I'll do this later` |
| `allclear.title` | `Nothing's been left hanging.` |
| `allclear.body` | `We read 200 old conversations. They all look finished or already handled.` |
| `error.classify` | `We couldn't finish reading your inbox. Nothing was sent and nothing was lost — we'll pick up where we stopped.` |
| `error.somefailed` | `39 sent. 4 didn't go out — Gmail rejected them.` |
| `error.somefailed.cta` | `Try those 4 again` |
| `error.allfailed` | `Nothing went out. Your inbox connection dropped.` |
| `error.disconnected` | `Your Gmail connection expired, so nothing can send yet.` |
| `error.reconnect` | `Reconnect Gmail` |
| `error.alreadyrunning` | `You've already got a batch sending — 12 of 43 gone out.` |

All numbers and the email address above are placeholders rendered from real data. No string on this
screen states a count that isn't a live count.

---

## 10. Sources

**Internal, read first-hand this session:**
- `followup/src/lib/reactivation.ts` (the data contract and every argument in its comments)
- `followup/src/lib/reactivationSend.ts` (read-only — another agent's in-flight work on this branch;
  the run lifecycle, the per-send stop check, `SEND_SPACING_MS`, and the audit consent record)
- `followup/src/lib/outcomes.ts`, `followup/src/lib/automation.ts` (constants only)
- `followup/PRODUCT_DIRECTION.md`
- `CLAUDE.md`, `design-brain/README.md`, `design-brain/brand/brand-principles.md`
- `design-brain/decisions/rejected.md` (R-001, R-002, S-01…S-16)
- `design-brain/decisions/approved.md` (A-001 … A-006)
- `design-brain/decisions/design-decisions.md` (D-007, D-019)
- `design-brain/components/states.md`
- `followup/research/product/2026-09-10-ux-simplification.md`
- `followup/research/product/2026-09-09-followup-cadence-best-practices.md` §3
- `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md` §3

**External:** none. Every behavioural claim in this spec is either cited to one of the internal
research files above (each of which carries its own "search-snippet-sourced, not fetch-verified"
caveat, which travels with the claim) or is marked as my own inference. No new statistic, quote, or
user research was invented for this document.
