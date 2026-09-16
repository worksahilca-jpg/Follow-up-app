# What makes a short business message read as human — and what betrays it

**Date:** 2026-09-16
**Question:** In a two-to-three-sentence business reply, what actually separates human-written
from machine-written text, and which of those differences are checkable in code?
**Scope:** `generateFollowUpMessage`, `generateInstantReply`, and anything else in
`src/lib/integrations/openai.ts` that produces text a lead will read.
**Extends:** `2026-09-10-instant-ack-safety-gate.md` (the deterministic-gate pattern),
`2026-09-13-scoring-and-drafting-accuracy.md`, `2026-09-15-reaching-back-out-to-ignored-leads.md`.
**Changes nothing in `src/`.**

## Confidence key

Every claim below carries one of these. Nothing is stated without a source.

- **[VERIFIED]** — the paper/source exists, is named, and the finding was returned
  consistently by search. Search-snippet-sourced unless marked fetched; `arxiv.org`,
  `nlp.stanford.edu`, `aclanthology.org`, `koustuv.com` and
  `conversational-featurizer.readthedocs.io` were all EGRESS_BLOCKED in this sandbox, so no
  primary PDF was read end-to-end.
- **[SNIPPET]** — a specific number or direction taken from a search snippet of a real,
  named paper. The paper exists; the exact figure has not been read in context.
- **[REASONED]** — my analysis from the evidence plus the codebase. No external source.
  Argue with it freely.
- **[UNVERIFIED]** — plausible, commonly repeated, no source I could stand behind. Treated
  as not-evidence.

---

## 0. The short version, and the bet

The founder's goal is stated as "a lead must not be able to tell a model wrote it." The
evidence says that goal is already close to satisfied for reasons that have nothing to do
with FollowUp's prompt, and that the real risk is somewhere else.

Humans are at chance detecting AI-written short self-presentations — **50–52% accuracy
across 4,600 participants and 7,600 texts** — and the heuristics they use are the wrong ones:
they read first-person pronouns, contractions and concrete personal topics as proof of
humanity, which makes their judgement "predictable and manipulable" (Jakesch, Hancock &
Naaman, *Human heuristics for AI-generated language are flawed*, PNAS 2023). **[VERIFIED]**

So the bar "a lead can't tell" is low and FollowUp mostly clears it. The expensive failure
is a different one, from the same research group: the **Replicant Effect** (Jakesch et al.,
CHI 2019) — in three experiments on Airbnb profiles, trust dropped for profiles *suspected*
of being AI-written **only in the mixed condition**, where participants believed they were
seeing a set containing both human and AI text. In a set they believed was uniform, no
penalty. **[VERIFIED]**

A FollowUp thread is structurally the mixed condition. The lead reads the instant
acknowledgement, then a drafted follow-up, then a reply the owner typed on their phone, then
another drafted follow-up. Every message is evaluated against the others in the same thread.

**That reframes the target, and this is the single most useful conclusion in this document:**
the goal is not absolute humanness, it is **within-thread and within-account consistency**.
A draft that is 30% more formal than the owner's own typed replies is the thing that gets
noticed, even if every individual sentence would pass in isolation. A draft that is
*uniformly* a little stiff, in an account where the owner is also a little stiff, is safe.

This is good news for the architecture, because FollowUp already has the per-account human
baseline it needs: `src/lib/voice.ts` separates the owner's own writing from the machine's by
structure (send-record match, `source`, channel), and the `FollowUp` table records every
machine send. The baseline exists; nothing currently measures the distance to it.

**What I would bet on, in order:**

1. Measure register distance between each account's drafts and that account's own human
   outbound. Fix the largest gap per account. (§5)
2. Move the banned-phrase list out of the prompt and into a deterministic post-generation
   check, and add one *positive* structural requirement to replace what the ban is trying to
   do. (§2, §3)
3. Per-channel length and shape targets. An email draft and an Instagram DM draft currently
   go through the same "two or three sentences" instruction. (§3.4)

**What I would not bet on:** burstiness, perplexity, lexical diversity, or any other
distributional stylometry as a per-draft gate. At 40 words those numbers are noise. (§1.2)

---

## 1. What separates human from machine in short messages

### 1.1 The features the literature actually names

The reliable, repeatedly-reported differences, with direction:

| Feature | Machine | Human | Source |
|---|---|---|---|
| Length | far longer | far shorter | *Emails by LLMs*, WebSci '25 **[SNIPPET]** |
| Sentence-length variance ("burstiness") | low, uniform | high, alternating | multiple detection surveys **[VERIFIED]** |
| Lexical diversity (TTR, hapax) | lower | higher | *Linguistic Characteristics of AI-Generated Text: A Survey*, arXiv 2510.05136 **[SNIPPET]** |
| Lexical density (content vs function words) | higher — fewer function words | lower | same survey **[SNIPPET]** |
| Part of speech | more nouns, determiners, adpositions; fewer adjectives/adverbs | the reverse | same survey **[SNIPPET]** |
| Pronouns | collective "we/us" | individual "I" | *Emails by LLMs* **[SNIPPET]** |
| Frame/transition markers | overused, especially clause-initially | sparse | *Metadiscourse in ChatGPT-generated and human-written research articles*, IJAL **[SNIPPET]**; *Word Overuse and Alignment in LLMs*, arXiv 2508.01930 **[VERIFIED]** for the general overuse finding |
| Specific vocabulary | measurable "excess vocabulary" post-2022 | — | Kobak et al., *Delving into LLM-assisted writing in biomedical publications through excess vocabulary*, Science Advances 2025 (arXiv 2406.07016) **[VERIFIED]** |

The single most quantified one is length, and it is not close. **[SNIPPET]** *Emails by LLMs:
A Comparison of Language in AI-Generated and Human-Written Emails* (ACM WebSci 2025,
doi 10.1145/3717867.3717872) reports AI email replies at **193.4 words vs 72.5 for human**
— 166.8% more — and **129.2% more sentences**, plus **19.2% higher subjectivity**. I could not
fetch the PDF; the figures came back consistently across searches and are attributed to that
paper.

Two things follow. First, **72.5 words is a real, sourced target number** for an email reply,
and it is the best single anchor this document produces. Second, FollowUp's existing
"two or three sentences, and two is usually the right answer… never write a fourth" is,
on this evidence, already the highest-leverage lever in the entire prompt, and it is already
pulled. Credit where due — most of the measured human/machine gap in email is length, and
the prompt closes it.

Kobak et al. deserves a specific note because it is the cleanest natural experiment on file:
14 million PubMed abstracts, 2010–2024, excess-word analysis, lower bound of ~10% of 2024
abstracts LLM-processed, up to 30% in some sub-corpora. **[VERIFIED]** What matters for
FollowUp is the *method*, not the finding: the signal was a shift in the frequency of
ordinary words ("delve", "intricate", "showcasing"), not the presence of any one phrase. That
is exactly the measurement FollowUp can run on its own corpus (§5) and exactly the
measurement a ban list cannot produce.

### 1.2 How much of this transfers to three sentences — the honest answer

**Almost none of the distributional features do.** This is the part of the question worth
being blunt about, because the published literature is overwhelmingly about essays,
abstracts and articles, and FollowUp writes none of those.

- OpenAI's own retired classifier was documented as unreliable below **1,000 characters**.
  **[VERIFIED]** A FollowUp draft is 150–400 characters.
- Misclassification concentrates in short texts, with reported false negatives around
  **14 words** and false positives around **34 words** — the length band FollowUp writes in —
  because short texts "do not provide sufficient linguistic or structural information for
  reliable feature extraction." **[SNIPPET]** (from a 2026 explainability paper returned in
  search; I could not read it directly, so treat the two word-counts as indicative.)
- Authorship attribution — the closest formal analogue to "does this sound like the owner" —
  needs **2,500–5,000 words** for reliable attribution, method-independently, with **over 60%
  false attribution below 3,000 words** (Eder, *Does size matter? Authorship attribution,
  small samples, big problem*, DSH 30:2, 2015). Later work pushes the floor toward 2,000
  words and only for texts with a clear authorial signal. **[VERIFIED]**

A 40-word draft is roughly **1–2%** of the minimum viable sample for stylometry. Burstiness
computed over three sentences is a standard deviation of three numbers. Type-token ratio over
40 tokens is dominated by whether the message happened to repeat "the". **[REASONED]** Any
per-draft gate built on these will fire on real human messages constantly, which is the
precise failure mode `checkAckShape`'s design notes already warn against for word-level
deny-lists.

**Aggregate them and they come back.** A hundred drafts from one account is 4,000 words —
above Eder's floor. The same hundred messages from the owner's own hand is another 4,000.
That comparison is valid, cheap, and currently not being made. This is the whole argument
for §5.

### 1.3 What *does* survive at three sentences

Everything that is visible in a single token or a single structural slot. **[REASONED]**, but
it follows directly from §1.2: if a feature needs a distribution to be visible, it is gone at
40 words; if it is visible in one glance, it survives.

1. **The opener.** One stock opening phrase is recognisable in the first six words. The code
   comment in `HUMAN_VOICE_NOTICE` already makes this argument and it is correct.
2. **One punctuation habit.** The em dash rule is right for the same reason — it is a
   single visible token, not a distribution.
3. **The template shape.** Three sentences that each perform exactly one function reads as a
   form even when every sentence is individually fine. `generateInstantReply`'s comment at
   line ~1083 ("The count itself was the trap") already diagnoses this, and it is the best
   piece of register reasoning currently in the codebase.
4. **Pronoun choice.** "We" vs "I" is one token and it is a documented split. **[SNIPPET]**
5. **A sentence that does no work.** A purely phatic sentence in a three-sentence message is
   33% of the message. In a 500-word essay it is invisible.
6. **The ask.** How many questions, and how they are phrased. One token (`?`) and one modal.

Note what all six have in common: they are **countable in a regex**. Short messages are
*less* amenable to statistical detection and *more* amenable to deterministic shape rules
than long ones. That is a favourable structure for a product that already has
`checkAckShape`.

---

## 2. Assessment of the banned-phrase list

The question was: does a ban list change the register, or just the vocabulary? The honest
answer is **mostly just the vocabulary**, but the list is still worth keeping — for a
different reason than the one it was added for, and in a different place.

### 2.1 Why the register doesn't move

Register in a short message is produced by the **sequence of speech acts**, not by the
lexicon. The list bans nineteen English phrases plus "the closest equivalent in whatever
language you end up writing in." Count how many of them occupy the same functional slot:

> "I hope this email finds you well" / "I hope you are doing well" / "I wanted to reach out" /
> "I'm reaching out" / "just checking in" / "checking in" / "circling back" / "touching base" /
> "following up on my previous email" / "as per my last email" / "thank you for your inquiry" /
> "thank you for reaching out" / "I appreciate you taking the time"

Thirteen of nineteen are **pre-substance openers**. The list forbids thirteen ways to fill one
slot without removing the model's reason for wanting to fill it. The model's prior is that a
business message opens with a relational move before the transactional one — that is a real
property of the business-email register it learned from, not a defect — so it will fill the
slot with something unbanned. The founder's own framing in the brief ("a model told not to
write 'I wanted to reach out' writes 'I'm getting in touch about'") is exactly right, and the
list itself demonstrates the treadmill: "I wanted to reach out" and "I'm reaching out" are the
same phrase, banned twice, because the first ban produced the second phrase. **[REASONED]**

Negative constraints also have a known asymmetry: they specify an infinite complement. "Don't
write X" leaves every non-X, including every near-synonym of X. Positive constraints specify
a target. There is no clean published measurement of this for instruction-following that I
could verify, so I am not citing one — but the structural argument stands on its own and the
prompt already contains the positive version of this instruction, one clause away:

> "Open on the substance, so the first sentence is the actual reason you are writing rather
> than a preamble to it."

That single clause does more register work than all nineteen bans, because it names the
*slot* rather than its fillers. **[REASONED]**

### 2.2 What the list is genuinely good for, and where it belongs

Per §1.3, phrase-level giveaways are exactly the class of signal that survives in a
three-sentence message. So a ban list is the **right kind of instrument**; it is in the
**wrong place**.

An exact string is the one thing a computer checks perfectly and a language model checks
unreliably. Putting the list in the system prompt spends ~250 tokens of instruction budget on
a constraint that is (a) probabilistic and (b) unverifiable after the fact. Putting the same
list in a post-generation regex makes it a hard guarantee, costs nothing per call, and frees
the prompt.

This is the identical architectural move already made once in this codebase, and the
reasoning in `acknowledge.ts` applies verbatim: *"deterministic, language-neutral shape check…
Pure and model-free on purpose: it costs nothing to run on every tier."* The follow-up path
has no equivalent — `stripFrame` is the only thing inspecting a follow-up body before it
reaches the composer, and it only handles greetings and sign-offs, as its own comment says.

**One caveat the ban list has that `checkAckShape` deliberately avoids:** it is
language-specific. `checkAckShape` excludes word-level deny-lists precisely because they are
"language-specific, trivially evaded by paraphrase." A ported ban list inherits that. The
resolution is to run the string check **only when the draft is confidently English** and let
the language-neutral shape rules (§3) carry every other language. Do not attempt a
multilingual ban list; that is the paraphrase treadmill in fifteen languages.

### 2.3 What I'd actually change

1. **Move the nineteen strings to a post-generation check** (English-only), on the same
   retry-then-fall-back pattern `acknowledge.ts` uses. Keep a one-line version of the notice
   in the prompt for steering — the check is the guarantee, the prompt is the nudge.
2. **Replace the bulk of the negative block with one positive requirement**: *the first
   sentence must contain a specific noun or detail taken from the lead's own most recent
   message.* This removes the model's motive for a pre-substance opener instead of
   confiscating its vocabulary, and unlike "open on the substance" it is checkable (§3.3).
3. **Keep the em-dash rule and the contraction guidance in the prompt.** Both are register
   properties, both are single-token-visible, and the em-dash one should also be enforced in
   code because it is a one-character regex.
4. **Drop "Never write a sentence whose only job is to be polite"** from the prompt in favour
   of the length ceiling, which subsumes it. In a two-sentence message there is no room for
   one. Instructions that are already entailed by a stronger constraint cost tokens and
   attention.

**The falsifiable prediction that decides this section**, measurable on FollowUp's own data
with no new instrumentation (§5): after 2026-09-15, occurrences of the nineteen banned
strings should drop to ~zero, while the share of drafts **whose first sentence contains no
content word from the lead's message** stays roughly flat. If both hold, the list changed
vocabulary and not register, and recommendation 2 is the fix. If the second number also fell,
the ban list is doing more than I think and I am wrong. **[REASONED]** Run this before acting
on §2.3.

---

## 3. Checkable properties — a proposed `checkDraftShape`

Rules are graded **HARD** (safe to reject and regenerate), **SOFT** (log, surface in review,
don't block) or **TELEMETRY** (measure across the account, never per-message). The grading
follows §1.2: anything distributional is TELEMETRY by construction.

### 3.1 Language-neutral (safe on every draft, every language)

| # | Rule | Grade | Basis |
|---|---|---|---|
| 1 | Word count within a per-channel band (§3.4) | HARD | 72.5-word human mean **[SNIPPET]** |
| 2 | ≤ 3 sentence-ending marks (already in `checkAckShape`; not on the follow-up path) | HARD | existing precedent |
| 3 | ≤ 1 question mark | HARD | one ask per message; two reads as a form **[REASONED]** |
| 4 | Zero em dashes | HARD | single-token giveaway; already prompted, unenforced |
| 5 | If 3 sentences, at least one under 8 words | SOFT | cheapest available burstiness proxy at this length **[REASONED]** |
| 6 | Zero exclamation marks beyond the first | SOFT | register, not humanness |
| 7 | Sentence-length variance, words/message, sentence count | TELEMETRY | §1.2 — meaningless per draft |

Rules 1–4 are as language-neutral as `checkAckShape`'s digit and currency rules, and rule 3
in particular is the sort of thing that is obvious only once stated: a human answering from a
van asks one question.

### 3.2 English-only (skip when the draft isn't confidently English)

| # | Rule | Grade |
|---|---|---|
| 8 | No banned string from the list (§2) | HARD |
| 9 | No clause-initial "Additionally," / "Furthermore," / "Moreover," / "That said," | HARD |
| 10 | `count("I") >= count("we")`, unless the account's own voice samples show otherwise | SOFT |
| 11 | ≤ 1 hedge from a short closed list ("typically", "generally", "should be", "around") | SOFT |
| 12 | No three-item coordinate list in a message this short | SOFT |

Rule 9 is the transition-marker finding **[SNIPPET]**; rule 10 is the we/I split **[SNIPPET]**,
and it should be *account-relative*, not absolute — a four-person agency genuinely is a "we".
That is exactly the kind of thing §5's baseline answers per account.

### 3.3 The one rule I would build first

> **Rule 13 (HARD): the draft's first sentence must share at least one content word
> (non-stopword, length ≥ 4) with the lead's most recent inbound message.**

This is "Open on the substance" made deterministic, it is roughly language-neutral (stopword
lists exist for the languages FollowUp writes in, and the rule degrades gracefully to
"skipped" where one doesn't), and it is a direct structural attack on the pre-substance
opener that the ban list only attacks lexically. It also happens to reward the exact thing
Jakesch's participants used as evidence of humanity — concrete, specific, personal content
**[VERIFIED]** — and the exact thing `generateInstantReply`'s allow-list item (1) already
demands in prose.

It has a known false-positive mode: a legitimate reply that opens with a pronoun referring
back ("That works — I can be there Thursday."). Cap the damage by evaluating the first
*clause plus the second*, or by grading it SOFT for the first month and reading the rate
before promoting it to HARD.

### 3.4 Per-channel bands — the gap that currently exists

Email, Instagram DM and WhatsApp are different registers from the same person. The literature
here is thinner and softer than the detection literature, and I am reporting it as such:
instant messaging is consistently described as shorter, more conversational, more clipped,
with unconventional punctuation and frequent emoticons/abbreviations, against email's longer
and more formal norms **[VERIFIED as a direction, SNIPPET for any specific feature]** — e.g.
Alazzawie, *The Linguistic and Situational Features of WhatsApp Messages*, SAGE Open 2022.
One useful situational finding from the same body of work: **SMS is perceived as the more
formal channel and WhatsApp as the channel for people you're close to** **[SNIPPET]** — which
is counterintuitive and matters, because FollowUp's Twilio SMS and WhatsApp drafts should not
be identical.

Proposed bands, explicitly **[REASONED]** extrapolation from the 72.5-word email anchor, to be
corrected against FollowUp's own human outbound per §5 as soon as that measurement exists:

| Channel | Words | Sentences | Greeting | Notes |
|---|---|---|---|---|
| Email | 25–75 | 1–3 | added by `sender.ts` | closest to the sourced anchor |
| SMS (Twilio) | 10–40 | 1–2 | none | one ask, no preamble |
| WhatsApp | 8–35 | 1–2 | none | most conversational; contractions mandatory |
| Instagram / Messenger DM | 8–30 | 1–2 | none | shortest; a three-sentence DM reads as a brand account, not a person |

The concrete problem today: `generateFollowUpMessage` is documented as drafting "a follow-up
email" and prescribes "two or three sentences" regardless of channel, while `sequences.ts`
and `reactivationSend.ts` call it for every channel. A 60-word Instagram DM is the single most
machine-looking artefact this product can currently produce, and no rule in the codebase
prevents it. **[REASONED]** — worth verifying against real sends before treating it as fact.

---

## 4. Where "human" and "professional" actually conflict

Most of the time they don't, and the research says the free lunch is real: the features
readers use as evidence of humanity — first-person pronouns, contractions, concrete specifics
— cost nothing in professionalism (Jakesch 2023). **[VERIFIED]** FollowUp can take the whole
humanness win without spending any professionalism. Which means the genuine conflicts are
few, and they are these:

**a) Lowercase, typos, fragments.** The strongest humanness signal available and the one to
refuse outright. A typo in a message that will be read as coming from the owner is a defect
the owner did not commit and cannot retract. Brand principle: trust outranks sophistication.
The prompt is already right here ("never become sloppy, rude, or unprofessional just because
the lead was casual"). **Professional wins, all three personas, permanently.**

**b) The ask.** Politeness theory makes a concrete, checkable prediction: **counterfactual
modals** ("Could you send…", "Would you…") are a negative-politeness strategy and correlate
positively with perceived politeness — reported coefficient **0.47** in Danescu-Niculescu-Mizil
et al., *A computational approach to politeness with application to social factors*, ACL 2013.
**[SNIPPET]** — the paper is real and widely cited; I could not fetch it (both Stanford and ACL
Anthology were egress-blocked), so the coefficient should be re-verified before it is quoted
anywhere customer-facing. The same framework's more counterintuitive claim — that
**sentence-initial "Please"** patterns with *less* politeness than a later-positioned "please"
— I could only reach through secondary descriptions. **[SNIPPET, lower confidence.]**

Where this conflicts: a plumber does not write "Could you possibly send a photo of the
leak?" He writes "Can you send me a photo of the leak?" The indicative is more human *and*
more competent in that trade; the counterfactual reads as someone impersonating an office.
**Split by persona: trade → indicative. Realtor → indicative with a softener. Consultant →
counterfactual.** If any one rule is adopted product-wide, make it "never open a sentence
with 'Please'" — it is cheap, checkable, and the evidence points the same way as taste.

**c) Apology and delay.** This is the sharpest genuine conflict and the one FollowUp hits
constantly, because the product's core case is a lead who was ignored. The current prompt
says: *"Do not apologise unless there is a specific thing to apologise for, and then say it
once, plainly, with no grovelling."* That is right, and it is incomplete — it says how much to
apologise, not whether to give a reason. And the reason is where the persona split lives:

- **Tradesperson:** the concrete cause *is* the credibility. "Sorry, I was on site all week."
  A busy trade is a good trade. Naming it is more human and more professional at once.
- **Realtor:** partial. Busy is good; disorganised is not. "Sorry for the slow reply" with no
  cause, then straight to substance.
- **Consultant:** the cause is a liability. A consultant who was too busy to answer is a
  consultant who will be too busy for you. Acknowledge once, no reason, move to substance.

This is a real product decision, it is currently unmade, and it is the one place in §4 I would
actually change the prompt. **[REASONED]** — I have no customer-quote evidence for the
consultant case specifically and would want it before shipping.

**d) Contractions.** No conflict. Contractions are characteristic of email of all kinds,
business included (Mallon & Oppenheim's Enron work and Pérez Sabater et al. 2008, both
**[SNIPPET]** — referenced in secondary literature, no primary read, and neither gives a
percentage I could verify). Direction is unambiguous; the prompt is already correct.

**e) Length.** No conflict — and this is the most useful thing in §4. The prompt's claim that
"a shorter message reads as more human and more respectful of their time, not less
considerate" is the rare instruction where humanness, professionalism and the measured
human/machine gap (§1.1) all point the same direction. It should be treated as the load-bearing
rule and everything that merely restates it should be cut.

---

## 5. What is measurable on FollowUp's own traffic today

No new instrumentation. Everything below is derivable from `Message`, `FollowUp` and
`Conversation` as they exist, using the same human/machine separation `voice.ts` already
implements (send-record body match, `source IS NULL`, non-speech channels).

**5.1 Per-account register distance — the one to build.** For each business, compute the same
feature vector over (a) its human outbound and (b) its FollowUp-sent bodies: words per
message, words per sentence, sentence count, contraction rate, question marks per message,
"I"/"we" ratio, em-dash rate, exclamation rate, first-sentence content-word overlap with the
preceding inbound. Report the per-account delta. This is a **within-account paired
comparison**, which controls for trade, language, region and customer type for free — the
strongest design available at zero cost. Per §1.2 it needs volume, not per-message precision:
~100 messages a side puts it above Eder's floor. Accounts where the drafts are consistently
more formal than the owner are the accounts at Replicant-Effect risk.

**5.2 The ban-list before/after.** The list landed 2026-09-15. Count the nineteen strings in
FollowUp-sent bodies before and after, and alongside it count drafts whose first sentence has
no content-word overlap with the inbound. This is the §2.3 prediction, and it is the cheapest
decisive experiment on this list.

**5.3 Reply rate, machine vs human send — with one confound to respect.** `FollowUp` already
carries `trigger` and `repliedAt`, so reply rate by trigger is a one-query result. **But
`trigger: "manual"` is not "the owner wrote it"** — `/api/leads/[id]/send` takes a `message`
from the client, so a manual row is *either* the owner's own words *or* an AI draft the owner
approved, and the two are indistinguishable in the schema. Anyone reading this table as
"human vs AI" is reading it wrong. It is still usable as *automated vs owner-initiated*, and
it must be stratified: automated sends go to colder, more-ignored leads by construction, so
an unstratified comparison will understate the machine.

**5.4 Per-channel reality check.** Words per message for human outbound, split by
`Conversation.channel`. This turns §3.4's reasoned bands into measured ones, and it is the
first thing I would run before hard-coding any number from this document.

**5.5 Language coverage.** What share of drafts are non-English? It decides how much the
English-only rules in §3.2 are worth. `2026-09-08-sourcing-multilingual-test-coverage.md`
exists; this number may already be known there.

**The one piece of instrumentation worth adding**, and it is small: on the approval path,
record whether the owner edited the draft, and the edit distance if so. `sending.ts` creates a
*new* `FollowUp` row with the final body and does not reference the draft it came from, so the
comparison is currently impossible. Owner edit distance is the closest thing to ground truth
this product will ever have for "does this sound like me" — the judge is the person whose
voice it is, and they are already in the loop. Every metric in §5.1 is a proxy for it.

---

## 6. What I'd bet on, what I wouldn't, and what would change my mind

**Bet on:**
- §5.1 (per-account register distance) and §5.2 (the ban-list prediction). Both are queries,
  not features. Neither can be wrong in a way that costs anything.
- §3.3, rule 13 (first sentence must touch the lead's own words), shipped SOFT first.
- Moving the ban list into code (§2.3.1). Same architecture as `checkAckShape`, already proven
  in this codebase.
- Per-channel length bands (§3.4). The Instagram-DM case is the clearest current defect.

**Would not bet on:**
- Any per-draft statistical test. §1.2 says it cannot work at this length, and a gate that
  false-positives on real human phrasing will be turned off within a week.
- A multilingual ban list. The paraphrase treadmill, times fifteen.
- The 0.47 politeness coefficient as customer-facing copy until someone reads the actual
  table. It is load-bearing for §4b and it is **[SNIPPET]**-grade.

**What would change my mind:** if §5.2 shows the first-sentence-overlap rate *did* improve
after 2026-09-15, then negative instruction is doing more structural work than I've credited,
and §2's whole argument weakens. That is a two-hour query and it should be run before anyone
edits `HUMAN_VOICE_NOTICE`.

**Known weakness of this document:** every primary source was blocked at the network layer.
The papers named are real and consistently described, but I read search snippets, not tables.
Two figures in particular — the 193.4/72.5 word split and the 0.47 coefficient — are doing
real work here and are exactly the two someone should verify before they end up in a product
decision or a line of copy.

---

## Sources

- Jakesch, Hancock, Naaman. *Human heuristics for AI-generated language are flawed.* PNAS 2023. https://www.pnas.org/doi/10.1073/pnas.2208839120 — **[VERIFIED]**, snippet-read 2026-09-16
- Jakesch, French, Ma, Hancock, Naaman. *AI-Mediated Communication: How the Perception that Profile Text was Written by AI Affects Trustworthiness.* CHI 2019. https://dl.acm.org/doi/10.1145/3290605.3300469 — **[VERIFIED]**, snippet-read 2026-09-16
- *Emails by LLMs: A Comparison of Language in AI-Generated and Human-Written Emails.* ACM WebSci 2025. https://dl.acm.org/doi/full/10.1145/3717867.3717872 — **[SNIPPET]** for 193.4/72.5 words, 129.2% sentences, 19.2% subjectivity, we/I split. PDF egress-blocked.
- Kobak, González-Márquez, Horvát et al. *Delving into LLM-assisted writing in biomedical publications through excess vocabulary.* Science Advances 2025 / arXiv 2406.07016. https://www.science.org/doi/10.1126/sciadv.adt3813 — **[VERIFIED]**
- Eder. *Does size matter? Authorship attribution, small samples, big problem.* DSH 30(2), 2015. https://academic.oup.com/dsh/article-abstract/30/2/167/390738 — **[VERIFIED]** for the 2,500–5,000-word floor
- OpenAI. *New AI classifier for indicating AI-written text.* https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/ — **[VERIFIED]** for the 1,000-character reliability floor
- *Linguistic Characteristics of AI-Generated Text: A Survey.* arXiv 2510.05136 — **[SNIPPET]** (lexical diversity, lexical density, POS distribution). arXiv egress-blocked.
- *Word Overuse and Alignment in Large Language Models.* arXiv 2508.01930 — **[VERIFIED]** for LHF-driven lexical overuse
- Danescu-Niculescu-Mizil, Sudhof, Jurafsky, Leskovec, Potts. *A computational approach to politeness with application to social factors.* ACL 2013. https://aclanthology.org/P13-1025/ — **[SNIPPET]** for the counterfactual-modal coefficient and the sentence-initial-"please" finding. Both Stanford and ACL Anthology egress-blocked; **re-verify before quoting.**
- Alazzawie. *The Linguistic and Situational Features of WhatsApp Messages.* SAGE Open 2022. https://journals.sagepub.com/doi/full/10.1177/21582440221082124 — **[SNIPPET]**, direction only
- *Metadiscourse in ChatGPT-generated and human-written research articles in linguistics.* IJAL — **[SNIPPET]** for frame-marker overuse
- Mallon & Oppenheim (2002) on Enron; Pérez Sabater et al. (2008) on email informality — **[SNIPPET]**, via secondary literature only, no figures verified
- Internal: `src/lib/integrations/openai.ts`, `src/lib/voice.ts`, `src/lib/acknowledge.ts`, `src/lib/sending.ts`, `prisma/schema.prisma`; `research/customers/2026-09-05-icp-pain-and-trust-objections.md` (the 65.5% "AI makes my business feel less authentic" owner-worry figure, itself marked approximate there)
