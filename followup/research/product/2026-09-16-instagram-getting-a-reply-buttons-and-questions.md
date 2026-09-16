# Getting a reply on Instagram and Messenger: buttons, last sentences, and the line we won't cross

**Date:** 2026-09-16. Branch `claude/followup-demo-to-production-4k39hr`. **No code changed.**
**The decision this serves:** `design-brain/decisions/design-decisions.md:1875-1914` — on Instagram
and Messenger, follow-ups are DM-only (`rejected.md:150-173`, R-003), Meta shuts the door 24 h after
the lead's last message, so inside those 24 h every message's job is to get *any* reaction, and
every DM will carry quick-reply buttons and end with an easy question. **This file does not
re-argue that.** It answers: what actually gets a reaction, what doesn't, and where "get a reaction"
turns into the spam tool.
**Which PRODUCT_DIRECTION rule:** Rule 1 (depth on the one job — this is the copy layer of the
"time the touch before the door shuts" moat in the window research §6.2b) and Rule 3 (the exit
button and the refuse-list in §5 are guarantees, statable and testable). Buttons themselves are
table stakes — Manychat has had them for years; *what they ask* is where the product is.

## What this builds on — not repeated here

| Prior doc | Settled there |
|---|---|
| `2026-09-16-meta-window-close-what-shipped-products-do.md` §1 (`:97-110`) | Only the *person's* action resets the clock. §2.2 (`:144-150`): the category has settled on an in-window follow-up at ~4 h. §6.2 the timing moat. |
| `2026-09-15-reaching-back-out-to-ignored-leads.md` | What a belated message says. Its constraints — one question, an explicit no-cost exit (`:549`, `:574-577`), never urgency (`:578-580`), never "last chance" (`:630-631`), stop after one unanswered rescue (`:659-660`) — are inherited wholesale. |
| `2026-09-16-what-makes-a-short-message-read-as-human.md` | ≤1 question mark (`:277`); the ask is one of six things visible at three sentences (`:168-170`); Instagram band 8–30 words (`:335-340`); indicative not counterfactual for trades, never open with "Please" (`:364-379`). |
| `2026-09-13-what-leads-actually-say-first-contact-patterns.md` | The three canonical DM questions — price, availability, "when can I see it" (`:45-47`); timeline is the strongest intent signal (`:94-98`); one qualifying question, never several (`:177-181`). |

## Evidence quality

`WebFetch` is EGRESS_BLOCKED here, as in every prior pass. **Every external claim is
WebSearch-snippet-sourced; no primary page was read in full.** Grades follow the window file's
scheme: **A** meta-analysis / large field experiment, named; **B** a single peer-reviewed study,
a regulator's or platform's own page, or several independent sources agreeing; **C** vendor or
practitioner claim, directionally useful, no methodology; **D** single source or contradicted —
recorded so nobody re-finds it and believes it, never quote; **Code** first-hand read;
**Inference** my reasoning, never quote as a finding. "**Not found**" means I looked and there is
nothing I would stake an account on — it does not mean the answer is no.

---

# 0. The short version

1. **Buttons work because they are cheap, not because they are clever.** The best evidence is not
   from chat at all: Pew finds open-ended survey items get ~18 % non-response against 1–2 % for
   closed items, because typing costs effort (**B**). A tap is the cheapest possible reply. Meta
   confirms a quick-reply tap is posted *as a message from the person* (**B**), which is the
   reset mechanic the whole strategy rests on.
2. **Two buttons that answer a real question, plus one honest exit. Never more than three.** No
   study compares 2 vs 3 vs 4 (**not found**); vendor design guides agree on 2–4 (**C**). The
   exit button is the best-evidenced part: a 42-study meta-analysis finds that telling someone
   they are free to refuse *raises* compliance, and the effect is strongest when the decision is
   immediate (**A**, with a 2023 re-analysis calling it a medium effect). A tap is immediate.
3. **The last sentence must be answerable in one word without the buttons.** Instagram renders
   quick replies on mobile only (**B**) and vendors report them intermittently not rendering at
   all (**C**). The text carries the question; the chips are a shortcut.
4. **The question has to be one whose answer changes what the owner does next.** That is the
   whole line between a follow-up and a timer-reset trick (§5). "Morning or afternoon?" passes.
   "Sound good?" fails.
5. **Three touches in a day: no evidence either way on annoyance (not found).** What the evidence
   does say is that each touch must *do* something different (§4): touch 1 answers and asks for a
   timeline; touch 2 adds one useful thing and asks for the one fact needed; touch 3 asks for the
   least, with the exit in the text, not only on a chip.

---

# 1. The mechanics the copy has to fit (checked 2026-09-16)

| Fact | Grade | Source |
|---|---|---|
| Instagram quick replies: **max 13**, **20 characters each** (truncated after), **plain text only**, **mobile app only** — not shown on desktop. | **B** | Meta docs (two URLs, consistent across three searches): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies/ ; https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/quick-replies |
| A tap **dismisses the chips and posts the button title to the thread as a message from the person**; your `messages` webhook receives it with `text` = the title and a `quick_reply.payload`. | **B** | Same Meta pages; Sinch and CM.com channel docs agree. |
| The 24 h standard window opens when a person "sends a message to your Page or Instagram Professional account, clicks a call-to-action button like Get Started […], **reacts to a message**, or comments on a post." | **B** for Messenger; **C** for Instagram (Meta's combined policy page covers both, but no vendor explainer independently lists reactions for Instagram) | https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy — via search summary, not fetched |
| "When a user clicks a button or Quick Reply, the 24-hour messaging window opens." | **B** | Manychat help via chatimize/keyapi summaries; consistent with the window file §1. |
| Chips vanish once the person sends *any* message; whether a chip from touch 1 lingers after the business sends touch 2 is **not found** — Manychat community threads report chips lingering on Android as a bug. | **C** | SendPulse, Genesys docs; Manychat community. |
| Quick replies on Instagram sometimes **do not render** (vendors call it a Meta bug; also hidden until a message request is accepted). Manychat caps a text block with buttons at **640 characters**. | **C** | Manychat help "Instagram automation troubleshooting"; community threads. |
| Meta's policy page lists acceptable disclosures ("You are interacting with an automated experience") and requires disclosure "when required by applicable law", naming California and Germany, recommending it everywhere. A vendor paraphrase: the policy "prohibits […] using automation to deceive users into thinking they are interacting with a human." | **C** — vendor summaries of Meta's page; wording not read directly | Same policy URL; creatorflow, chatbotbuilder.ai summaries |
| A quick reply supplied with an emoji title, or attached to a `human_agent`-tagged send, is permitted | **Not found** | — |

**What the code does with a tap today (Code):** `sendInstagramMessage` sends `{ text }` only
(`src/lib/instagram.ts:118-122`); Messenger adds `messaging_type: "RESPONSE"`
(`src/lib/facebook.ts:49`). Neither attaches `quick_replies`. On the way in, a tap has `text`, so
`messageContent` (`src/lib/inbound/meta.ts:41-44`) treats it as a normal inbound message and
`createInboundMessageIfNew` records it (`meta.ts:176`) — which means **a tap already stops
automation and resets FollowUp's own window arithmetic with no new code**. It will not trigger a
second instant ack: `acknowledgeNewLead` refuses an acknowledged lead (`src/lib/acknowledge.ts:382`,
`:403`). What is lost is the `payload` — the system will see "Morning" as the lead's latest
message and not know which question it answered. A reaction carries no `text`, returns `null`
(`meta.ts:47`) and is skipped — so if a reaction reopens the window, FollowUp does not know, and
fails safe (declines a send it was allowed to make).

---

# 2. Q1 — Buttons: how many, what they say, and the exit

## 2.1 Why buttons get a reaction at all

- **Effort.** Pew Research (Decoded, 2021): open-ended items in their surveys ran ~18 %
  non-response versus 1–2 % for closed-ended; the stated reason is that composing an answer costs
  time and mental effort. **[B — Pew's own methods blog; survey context, not DM.]** *Survey
  Practice* reaches the same direction. The transfer to a DM is an inference, but the mechanism
  (a tap is cheaper than typing) is not in doubt.
- **They do not make it feel less human — in one study.** *Understanding the user experience of
  customer service chatbots* (Int. J. Human-Computer Studies, 2022, experimental): button
  interaction strengthened pragmatic and hedonic UX relative to free text and **did not change
  perceived anthropomorphism**. **[B — snippet only.]** This is the one finding that speaks to the
  founder's "must not read as a bot" concern, and it says chips per se are not the giveaway.
- **Vendor numbers, recorded so nobody quotes them:** "quick replies reduce response friction by
  70 % and lift completion 40–60 %" (thesocialcat / conferbot); "conversations under 4 messages have
  a 0.4 % qualification rate, 53 % die before message 3"; "two-message sequences see 2.3× downstream
  conversion." **[D — no methodology, no sample, vendor marketing. Do not use.]**

## 2.2 How many

- **Meta allows 13. Nobody serious uses 13.** Vendor design guides converge on 2–4 (conferbot,
  thesocialcat, SendPulse: "usually makes sense to limit to 3–5"; conferbot: "2–4, five or more
  causes decision paralysis"). **[C — agreement without data.]** A controlled comparison of 2 vs 3
  vs 4 buttons: **not found**.
- **Inference, and the recommendation:** **two real options plus one honest exit, three chips
  max; two is fine when the question is yes/no.** Reasons: (a) a 20-character chip on a phone
  is a small target and three fit on one row; (b) principle 8 — every chip that does not change
  the owner's next action is decoration; (c) a two-way question ("morning or afternoon") is
  answerable *without* the chips, which §1 says must be true.

## 2.3 Wording

- **Two-choice beats open.** Same Pew mechanism; and the repo's own finding that a good response
  asks "exactly one qualifying question" and that stacked questions reduce replies
  (`2026-09-13-…first-contact-patterns.md:177-181`, **C** there).
- **Specific ask vs. interest check — depends on whether they are already engaged.** Gong Labs
  (304,174 emails, cold outbound): an *interest* CTA ("worth a look?") booked at ~30 % against ~15 %
  for a *specific* ask (a time) and ~13 % for open-ended — but once a deal was live, the specific
  ask rose to ~37 %. **[C — vendor analysis, email, booking rate not reply rate.]** A DM lead who
  wrote first is *not* cold, so the specific two-choice belongs in touches 1–2; the interest check
  ("still looking, or sorted?") belongs in touch 3 and after silence. That split is used in §6.
- **Questions raise replies at all:** Boomerang's 40-million-email analysis — 1–3 questions,
  ~50 % more likely to get a reply than none; 50–125 words best; simplest reading level best.
  **[C — vendor data analysis, email, widely cited, no peer review.]**
- **Chip copy rules (Inference from §1 limits):** ≤ 20 characters, ideally ≤ 12 so it survives a
  small screen; the lead's language (`openai.ts:912-926` already decides language from the last
  inbound — reuse that decision for chips); plain words; a chip is the *answer*, not a command —
  "Morning", not "Choose morning"; never a chip whose tap the owner would have to interpret.

## 2.4 The "Not now" button — does an easy exit raise or lower the reply rate?

- **Direct evidence on a chat exit button: not found.** Nobody has published reply rates with and
  without a "No thanks" chip.
- **The strongest adjacent evidence says an explicit exit raises compliance.** Carpenter (2013),
  *A Meta-Analysis of the Effectiveness of the "But You Are Free" Compliance-Gaining Technique*,
  *Communication Studies* 64(1): 42 studies; telling the target they are free to refuse raised
  compliance across request types, and the effect **diminished when the decision was not made
  immediately**. **[A — meta-analysis; abstract-level.]** A 2023 re-examination in
  *Meta-Psychology* finds a medium effect and raises replicability concerns **[B]** — so treat it
  as "real, smaller than advertised". A chip is decided in the moment the message is read, which is
  the condition where the effect held.
- **The "no" is otherwise delayed or silent.** Rendle-Short (2015), *Discourse & Communication*,
  329 texting interactions: replies to a request delayed by more than a minute were much more
  likely to be a "no"; preferred answers come fast, dispreferred ones are delayed. **[B.]**
  **Inference:** a lead who is going to say "not now" says it late or never — which, on this
  channel, is the same as never, because the door closes. A one-tap exit makes the dispreferred
  answer cheap and immediate. It is a reaction (resets the clock) *and* it is honest data the owner
  can act on (stop). Both are wins; only one of them is the reason to include it.
- **The repo already requires it.** Every steer in the reactivation research ends with "an
  explicit, no-cost way to say it's no longer needed" (`2026-09-15-…:549`, `:575-577`).
- **What a "no" tap must do (design rule, not evidence):** stop every automatic touch for that
  lead, produce no day-2–7 owner draft, and tell the owner in one line. A "no" that only resets a
  timer so the machine can keep going is §5's first refused pattern.

---

# 3. Q2 — The last sentence

## 3.1 Shapes a busy person answers in one word

Ordered by how much of the evidence above each rests on. All are **Inference** applied to the
graded findings in §2, except where marked.

| Shape | Example | Why it works |
|---|---|---|
| **Either/or on a fact only they know** | "Morning or afternoon usually better?" | Closed (Pew), specific (Gong once engaged), answerable without chips. Not a business fact, so the instant reply may ask it (`openai.ts:1094-1101` forbids business facts there). |
| **Timeline in three bands** | "Is this for this week, or later on?" | Timeline is the strongest intent signal on file (`…first-contact-patterns.md:94-98`) — the reaction *is* the qualification. |
| **The one fact needed to answer them** | "Is it the whole bathroom or just the shower?" | Specific ask; the answer unblocks the owner's real reply. Must come from the thread, never invented. |
| **A photo request (Instagram-native)** | "Can you send me a photo of it?" | Not a word, but a reaction, and the most natural thing to send on Instagram. Trades only; never for a person. |
| **Interest check with the exit in the sentence** | "Still looking into this, or sorted elsewhere?" | Gong's interest regime for the disengaged; BYAF built in. Touch 3 and after silence only. |
| **Yes/no on a concrete next step already on the table** | "Want me to hold Saturday for you?" | Only when the owner has actually offered Saturday. |

Indicative, not counterfactual, for trades ("Can you…", not "Would you be able to…"); never
open the question with "Please" (`…read-as-human.md:364-379`, **[SNIPPET]** there).

## 3.2 Shapes that read as a bot and get ignored

**No study tests these closers specifically — not found.** Customer-service phrase guides (Hiver,
Gorgias) list them as "avoid"; **[C]**. The mechanism is the human-read research's own: a
sentence that does no work is a third of a three-sentence message (`:165-166`), and readers use
concrete specifics as their evidence of a human (`:39-40`, Jakesch 2023, **[VERIFIED]** there).
Refuse:

- "Let me know if you have any questions." / "Feel free to reach out." — no question, no work.
- "Is there anything else I can help you with?" / "How can I assist you today?" — the
  help-desk closer; and it is *not* answerable in one word.
- "Does that make sense?" / "Sound good?" / "Fair enough?" — agreement-fishing; the answer
  changes nothing (§5).
- "Are you interested?" — after they wrote to you, it asks them to restate what they already said.
- "Would you like to proceed?" — nobody types that from a van.
- Two question marks. One ask (`…read-as-human.md:277`).
- A question the thread already answers ("what are you looking for?" when they told you).

**Gap in the code, worth naming:** `HUMAN_VOICE_NOTICE` (`openai.ts:148-162`) bans nineteen
*openers* and zero closers. The last sentence is the sentence this whole decision turns on, and
today nothing in the prompt or in any post-generation check looks at it. The human-read research
already argues the ban list belongs in a regex (§2.2 there); the closers above are the list.

---

# 4. Q3 — Three touches inside the day

**Cadence on file:** ~2 min (`DM_ACK_GRACE_PERIOD_MS`, `acknowledge.ts:105`), ~3 h
(`UNANSWERED_FIRST_REPLY_HOURS`), ≤ 20 h (`UNANSWERED_META_DM_MAX_HOURS`, `metaWindow.ts:51`);
three is the ceiling (`design-decisions.md:1912-1914`).

**Does a third touch inside 24 h help or annoy? Not found, in either direction.** What exists:

- **Vendors run the same shape and cancel on reply.** ReplyRush: instant, +10 min, +24 h.
  InstantDM: 30 min, "a few hours", 24 h. Inrō: a 24-hour follow-up for non-clickers (window file
  §2.2). All state that any reply cancels the rest. **[C.]** None publishes a per-touch reply or
  block rate.
- **Over-messaging has a documented social cost — in a different setting.** *Journal of Social
  Media in Society* 13(2), 2024: people double-text to force a reply after a response-time
  expectation is violated, and over-texting signals lower perceived social value — in romantic
  pursuit. **[C for transfer.]** Read it as: the third message is where a business starts to look
  like it needs this more than the lead does.
- **Silence from the business also costs.** *Frontiers in Psychology* 2022: a delayed reply is
  experienced as lack of interest, with measurable arousal. **[B, different direction.]** Both
  findings point the same way — reply fast, then do not crowd.
- **The unanswered-rescue literature says one, then stop.** A second apology was worse than
  nothing in the Uber field experiment (`2026-09-15-…:659-660`, **A** there).

**Inference, and the recommendation — the touches must differ in kind, not just in time:**

| Touch | Job | Question shape | Never |
|---|---|---|---|
| **1 (~2 min)** | Prove the message was read; say the specifics are coming. No business facts (`openai.ts:1094-1101`). | Either/or or timeline on something *they* know. | Anything about price, slots, or availability. |
| **2 (~3 h)** | Add **one** thing that is useful *and* true from the thread or owner facts — the one detail they need to decide, or the one fact the owner needs to answer. | The single fact needed. Specific. | A restatement of touch 1; "just checking you saw this". |
| **3 (≤ 20 h)** | Ask for the least. Make stopping costless and say so in the sentence, not only on a chip. | Interest check with explicit exit. | Any deadline, any "last chance", any reference to the window, a fourth touch. |

**Whether the lead should be told touch 3 is the last automatic message:** Inference — no. "This
is my last message" is the breakup-email pressure move the reactivation research refused
(`:630-631`), and "Meta closes our chat" is jargon the lead did not ask for. The honest version is
in the sentence: "I'll leave it with you."

**Chip hygiene across touches (Inference from §1's unknown about lingering chips):** each touch
gets its own payloads; the handler treats a tap on a stale chip as an answer to *that* question,
not the latest; a tap of any kind stops the remaining touches.

---

# 5. Q4 — Rule 7: where "get a reaction" becomes manipulation

**The line, in one sentence:** *a question is legitimate when its answer changes what the owner
does next; it is manipulative when its only function is to reset a timer.* Test every last
sentence and every chip by asking "what does the owner do differently for each answer?" If the
answer is "the same thing", it is a fake question. Brand principle 1's test applies unchanged:
would the owner be comfortable if the lead saw the instruction that produced this message?

Named patterns to refuse. Where a pattern has a name in the dark-patterns literature it is given;
the rest are this product's own lines.

1. **Reset-farming.** A "Not now" tap that stops nothing. A tap must end the automatic sequence.
2. **Fake urgency or scarcity.** "Only two slots left", "prices go up Friday" — unless the owner
   stated it as fact in the thread. Reactivation research (`:578-580`) already bans it; Meta's
   policy on misleading content sits behind it.
3. **Manufactured deadline in touch 3.** "Closing your enquiry today", "last chance". Nothing
   closes; the lead can write any time and everything restarts (`design-decisions.md:1891`).
4. **Confirmshaming chips.** "No, I'd rather overpay." Deceptive.design defines confirmshaming as
   using shame to steer a choice; Mathur et al. (2019) found dark patterns on >11 % of 11 K shopping
   sites. **[A/B for the definition and prevalence.]** The exit chip says "Not now" and nothing
   else.
5. **Guilt.** "I took the time to write this", "haven't heard back from you", "did I do something
   wrong?" — the apology-backfire condition (`2026-09-15-…:98-110`, **A** there) aimed at someone
   who owes us nothing.
6. **Fake presence and fake feelings.** "Just saw this!", "typing from the van", "so excited to
   help" — invented facts about the sender. The human-read research is about *register*, not
   about claiming to be a person. Match how the owner types; never assert where they are or what
   they feel. And never deny being automated if asked (Meta's disclosure policy, **C**).
7. **Agreement-fishing.** "Sound good?", "Make sense?", "Fair enough?" — §3.2.
8. **Re-asking what the thread already answers**, to get a tap.
9. **Yes-only choice sets.** A yes/no question with two "yes" chips and no honest "no".
10. **More than one question, or more than three chips.** Volume is the spam signal
    (`meta-channels-production-audit.md:312-313`).
11. **Flattery and reciprocity bait.** "Loved your page", "quick favour" — and anything drawn
    from the lead's profile rather than the thread; Meta bars scraped personalisation (window
    file §2.3 q3, **B** there).

---

# 6. Q5 — Sets the draft generator can follow

Written as instructions to a model, in the register of `deadLeadMessageHint`. Each is selected by
**facts already in the database** (channel, touch number, whether the owner has replied, whether a
price or slot appears in an outbound message), never by the model's guess. Constraints that apply
to **every** set and should be repeated in the prompt rather than assumed:

> This goes out as an Instagram or Messenger DM. 8–30 words, one or two sentences, no greeting,
> no sign-off, no subject line. Exactly one question, and it is the last sentence. The question
> must be answerable in one word by someone walking, without looking at any buttons. Provide two
> or three button titles, each 20 characters or fewer, in the same language as the lead's last
> message, each one a plain answer to that question ("Morning", not "Choose morning"). If the
> question is yes/no, the last button is an honest no ("Not now"). Never a button the owner would
> have to interpret. Never a question whose answer would not change what the owner does next.
> Never a deadline, a "last chance", a slot count, or any fact not in the conversation. Never
> "sound good?", "make sense?", "let me know if you have any questions", "anything else I can
> help with?", "are you interested?".

**Set 1 — Price question, touch 1 (~2 min, no business facts available).**
> They asked what something costs. You cannot answer: you do not know the price. Say, in one
> sentence, that you'll come back with the price for the specific thing they named. Then ask
> **when they're looking to do it** — the only useful thing you can ask without knowing anything
> about the business. Buttons: "This week" / "This month" / "Just looking".
*Reasoning:* the instant reply may not state business facts (`openai.ts:1094-1101`); timeline is
the strongest intent signal on file; "Just looking" is the honest exit and still a reaction.

**Set 2 — Price question, touch 2 (~3 h, owner silent, price not in thread).**
> The owner hasn't replied. Do not apologise (nothing is late yet). Add the **one** fact the
> business would need to price this, taken from what pricing that kind of job obviously depends on
> and phrased as a question about *their* situation, not a menu of options. Trades: ask for a
> photo. Buttons only if the question has two natural answers ("Whole room" / "Just the shower");
> for a photo request, no buttons — the photo is the reaction.
*Reasoning:* touch 2 must add something (§4); the specific ask fits the engaged regime (§2.3); a
photo is Instagram-native and unblocks the real answer.

**Set 3 — Price question, touch 3 (≤ 20 h, still silent).**
> Last automatic message. Ask for the least: whether they still want the number, with the exit in
> the sentence. "Still want a price on this, or leave it?" Buttons: "Still want it" / "Leave it".
*Reasoning:* smallest ask; BYAF in the sentence (§2.4); no deadline.

**Set 4 — Price given by the owner, lead went quiet (gone quiet after a real exchange).**
> The price is in the thread, sent by the business. Do not repeat it and do not discount it. Ask
> the one thing that moves this forward and lets them say no: whether they want a slot held or are
> still deciding. Buttons: "Hold a slot" / "Still deciding" / "Not for me".
*Reasoning:* Gong's specific ask once engaged; "Still deciding" is the comparison-shopping state
(`…first-contact-patterns.md:131-134`); "Not for me" is the honest no.

**Set 5 — Availability question, touch 1 ("is it still available?", "do you have Saturday?").**
> You cannot confirm availability. Say you'll check the specific thing they named. Ask what half of
> the day usually suits them — a fact only they know. Buttons: "Morning" / "Afternoon" / "Either".
*Reasoning:* the founder's own example (`design-decisions.md:1908-1910`); no business facts; the
answer is used the moment the owner replies.

**Set 6 — Availability, touch 2, the owner has named slots in the thread.**
> Two slots the business actually offered are in the conversation. Offer exactly those two, in
> their words. Buttons: the two slots, shortened to fit 20 characters ("Sat 10am" / "Sun 2pm"), plus
> "Neither works".
*Reasoning:* concrete, from the thread only; "Neither works" is the honest no and still a reaction.
If no slots are in the thread, fall back to "Weekday or weekend?".

**Set 7 — General enquiry, touch 1 ("do you do X?", "can you help with…").**
> Name the thing they asked about so it is obvious you read it; say you'll confirm. Ask how urgent
> it is. Buttons: "Urgent" / "This month" / "No rush".
*Reasoning:* urgency is a timeline question the lead owns; it sets the owner's priority without a
single business fact.

**Set 8 — General enquiry, touch 2, owner has replied once and the lead went quiet.**
> The owner answered; they didn't come back. Read the owner's reply and offer the two next steps it
> makes available — a quote, a visit, a call, a booking — and only those. Buttons are those two
> steps in two words each, plus "Not now". If the owner's reply makes only one step available, ask
> a yes/no on it with "Yes" / "Not now".
*Reasoning:* next steps come from the thread, never invented; two options plus the exit.

**Set 9 — Any situation, touch 3 (≤ 20 h), after two unanswered touches.**
> Last automatic message. Two sentences at most. Say you'll leave it with them. Ask whether they're
> still looking into this or it's sorted elsewhere. Buttons: "Still looking" / "Sorted elsewhere".
> No third button, no deadline, no summary of what was offered.
*Reasoning:* the interest regime for the disengaged (§2.3); the Steer-D posture without a
"closing your file" line; both answers change what the owner does.

**Set 10 — After a tap (the lead answered with a button).**
> The lead's latest message is a one-word answer to a question you asked. Use the answer: confirm
> it in their word ("Morning it is") and say what happens next. **Do not ask another question**
> unless one specific fact is still missing to act on their answer. Never chain questions to keep
> them tapping. No buttons unless there is a genuine second question.
*Reasoning:* §5 pattern 1; the door is freshly open for 24 h and the owner is now the right
sender (timing-aware handoff).

**Set 11 — Any exit tap ("Not now", "Leave it", "Not for me", "Sorted elsewhere").**
> Not a drafting instruction — a stop. No further automatic message on this lead. No owner draft for
> days 2–7. One line to the owner: "{name} tapped '{button}' on Instagram, so FollowUp has stopped.
> They can write again any time."

**Set 12 — Day 2–7 owner-sent DM (out of window; human-agent tag; owner taps send).**
> Written to the reactivation rules: name the gap in one clause, lead with something concrete from
> the thread, one question, explicit no-cost exit, no apology (they stopped replying to us, not the
> reverse — `2026-09-15-…:633-639`). **Send as plain text until someone verifies that quick replies
> are permitted on a human-agent-tagged message** (§1, not found).

---

# 7. What I could not verify

1. Any measured reply-rate difference for 2 vs 3 vs 4 chips, or with vs without an exit chip.
2. Whether a reaction reopens the window **on Instagram specifically**; Meta's combined policy
   page says yes for "Page or Instagram Professional account", no vendor corroborates for IG.
3. Whether chips from touch 1 remain tappable after the business sends touch 2.
4. Whether quick replies render at all on a `human_agent`-tagged send, and whether emoji titles
   are accepted.
5. Any evidence on a third same-day touch — help or harm — in a business context.
6. Meta's disclosure policy wording, read directly. The vendor paraphrases agree; the page was not
   fetched. This matters for §5 pattern 6 and should be read by a human before copy claims
   anything about it.
7. Everything in §1 is checked on 2026-09-16 only, in a policy area that changed twice in a year.

---

# 8. Handover — what PR B should do

- **Attach `quick_replies` on Instagram and Messenger sends** (`instagram.ts:118-122`,
  `facebook.ts:49`): ≤ 3 chips, ≤ 20 chars, `content_type: "text"`, a payload that encodes
  `{touch, question, answer}` so a tap is recorded as an answer, not a bare word.
- **Have the drafter return `{ body, buttons[] }` for DM channels**, with §6's shared constraint
  block in the prompt and the situation set chosen by DB facts (channel, touch number, whether an
  outbound contains a price or slot) — never by the model.
- **Add a post-generation shape check for DM drafts**: exactly one `?`, it is in the last sentence,
  8–30 words, no banned closer from §3.2, ≤ 3 buttons, each ≤ 20 chars. Same pattern as
  `checkAckShape`.
- **An exit-button tap stops everything** (Set 11): no further automatic touch, no day-2–7 draft,
  one plain notification to the owner. Pin it with a test — this is a Rule 3 guarantee.
- **A tap on any chip cancels the remaining touches** and hands the lead to the owner as "answered
  you, needs you"; Set 10 governs the only automatic message allowed after a tap.
- **Touches 1/2/3 must use distinct payloads**, and the tap handler must treat a stale chip as an
  answer to the question it belonged to (§4 chip hygiene).
- **Record reactions** (`message_reactions`) as a window-opening event *without* treating them as
  a lead message — today they are dropped at `meta.ts:47`. Fail-safe until §7.2 is resolved.
- **Do not put "last message", a deadline, or any slot count in touch 3**; do not tell the lead
  about the window. Copy for touch 3 is Set 9 as written.
- **Send day-2–7 owner drafts as plain text** until §7.4 is checked.
- **Founder decision needed before merge:** whether "Not now" also suppresses the day-2–7 owner
  draft (this file says yes) — it is the one place the reaction strategy and the rescue strategy
  disagree.

---

## Sources checked 2026-09-16 (search summaries only; nothing fetched)

**Meta (grade B where the fact is a documented limit; C where a vendor paraphrases policy)**
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies/
- https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/quick-replies
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages/quick-replies
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy

**Peer-reviewed / methods (A–B, abstract level)**
- Carpenter (2013), *Communication Studies* 64(1) — https://www.semanticscholar.org/paper/5ad367ae86a6266e13e1f484d11ecf37cde82384 ; 2023 re-examination, *Meta-Psychology* — https://open.lnu.se/index.php/metapsychology/article/view/2640/3402
- Pew Research Center, Decoded (2021), open-ended item nonresponse — https://www.pewresearch.org/decoded/2021/10/14/why-do-some-open-ended-survey-questions-result-in-higher-item-nonresponse-rates-than-others/ ; *Survey Practice* — https://www.surveypractice.org/article/2859-open-ended-survey-questions-item-nonresponse-nightmare-or-qualitative-data-dream
- *Understanding the user experience of customer service chatbots*, IJHCS 2022 — https://www.sciencedirect.com/science/article/pii/S1071581922000179
- Rendle-Short (2015), *Discourse & Communication* — https://journals.sagepub.com/doi/10.1177/1750481315600309
- *Journal of Social Media in Society* 13(2), 2024, double-texting — https://thejsms.org/index.php/JSMS/article/download/1077/721/6555
- *Frontiers in Psychology* 2022, response delay and arousal — https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2022.840845/full
- Mathur et al. (2019), *Dark Patterns at Scale* — https://webtransparency.cs.princeton.edu/dark-patterns/ ; confirmshaming — https://deceptive.design/types/confirmshaming/
- Nielsen Norman Group, *The User Experience of Chatbots* (n = 8) — https://www.nngroup.com/articles/chatbots/

**Vendor analyses and guides (C; D where marked in text)**
- Gong Labs cold-email CTA study — https://www.gong.io/blog/this-surprising-cold-email-cta-will-help-you-book-a-lot-more-meetings
- Boomerang 40M-email analysis, via HubSpot — https://blog.hubspot.com/sales/ideal-length-sales-email
- Manychat: https://help.manychat.com/hc/en-us/articles/14281157129116-Quick-Reply-Buttons ; https://help.manychat.com/hc/en-us/articles/14281308423452-Instagram-automation-troubleshooting ; https://manychat.com/blog/quick-replies-flow-builder/ ; https://help.manychat.com/hc/en-us/articles/23358636027932-Understanding-messaging-windows
- SendPulse — https://sendpulse.com/knowledge-base/chatbot/quick-replies ; Genesys — https://help.genesys.cloud/articles/work-with-quick-replies-in-bot-conversations/
- conferbot — https://www.conferbot.com/blog/chatbot-ui-design-best-practices ; thesocialcat — https://thesocialcat.com/glossary/quick-reply-dm-chatbot-feature (D for numbers)
- ReplyRush — https://www.replyrush.com/post/instagram-follow-up-dm-automation ; InstantDM — https://instantdm.com/blog/instagram-auto-reply-how-it-works-whats-allowed-best-practices-2026 (D for conversion numbers)
- chatimize — https://chatimize.com/instagram-dm-rules/ ; keyapi — https://www.keyapi.ai/blog/instagram-messaging-api-policy/ ; creatorflow — https://creatorflow.so/blog/instagram-dm-compliance-meta-rules/
- Hiver, Gorgias phrase lists — https://hiverhq.com/blog/customer-service-phrases ; https://www.gorgias.com/blog/customer-service-phrases
