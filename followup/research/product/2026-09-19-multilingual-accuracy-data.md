# What FollowUp needs to collect to reply accurately in every language

Researched 2026-09-19, at the founder's request: *"go and collect all the data which can help
FollowUp train accurately in every language"*, immediately after *"I want the replies to be in
the same language and same tone."*

Confidence grades follow the convention used elsewhere in `research/`:
**A** — primary source read directly. **B** — primary source seen via search snippet, or
corroborated across two independent secondary sources. **C** — single secondary source, vendor
marketing, or a self-reported figure.

The sibling document `research/customers/2026-09-08-sourcing-multilingual-test-coverage.md`
answers *"how do we get one native speaker to test this"*. This one answers the larger question
behind it: **what data would actually make the replies right, and which of it can we collect
ourselves.**

---

## 1. What FollowUp does today, read from the code

There is no language model of the lead anywhere in the system. Language is handled entirely by
passing the lead's own message alongside whatever is being written, and asking the model to
match it.

| Where | What it does |
|---|---|
| `localizeFixedText` (`src/lib/integrations/openai.ts:1072`) | Translates a fixed template into the lead's language, using up to 600 characters of their message as the only signal. Returns the input untouched for English or when unsure. Explicitly instructs romanized-script matching (Hindi/Punjabi in Latin letters stays romanized). |
| `generateInstantReply` | Gets the lead's raw inbound text. No language instruction at all — it answers in whatever language the message is in, implicitly. |
| `buildAckLine` → `checkAckShape` | A deterministic shape check described in its own comment as "language-neutral". |
| `assessAckRisk` | A model judge, prompted in English, judging a reply that may be in any language. |

**Three consequences worth stating plainly.**

1. **Nothing is stored.** `Lead` has no language column. Every message pays to re-infer the
   language from scratch, and nothing can be measured, filtered, or reported per language —
   including "how often is FollowUp wrong in Spanish".
2. **Formality is never specified.** Not in `generateInstantReply`, not in
   `localizeFixedText`, not in `draftDm`. The model picks a register per call, with nothing
   holding it steady between the acknowledgement and the follow-up three days later.
3. **The safety gates are English-shaped.** `assessAckRisk` judges non-English replies through
   an English prompt. §6 below is why that is the weakest link in the chain, not the strongest.

---

## 2. What "accurate in every language" actually breaks down into

Four separate problems that get collapsed into one word. Only the first is close to solved.

1. **Language** — which language to answer in.
2. **Script** — Hindi in Devanagari or in Latin letters; Arabic in Arabic script or Arabizi.
   Already handled in `localizeFixedText`, nowhere else.
3. **Register** — tú or usted, tu or vous, du or Sie, which level of keigo. §4.
4. **Voice** — the owner's own way of writing, which `getVoiceSamples` already learns from
   their sent messages, but only in whatever language those samples happen to be in.

A reply can be in perfect Spanish and still be wrong on 3 and 4, and 3 is the one a native
speaker notices instantly and a non-speaker cannot see at all.

---

## 3. The register problem, which is the biggest accuracy risk

This is the best-documented failure mode in production multilingual assistants, and it is
exactly what the founder asked for under "same tone".

> LLMs commonly get formality wrong — a Spanish reply using *usted* when the customer opened
> with *tú* is a named evaluation failure ("FormalityCorrectness"), and Japanese formal
> register "slips to informal mid-paragraph" without an explicit keigo-level instruction.
> **[Grade B — futureagi.com's 2026 multilingual evaluation playbook, corroborated by
> promptquorum's multilingual prompting guide.]**

> Telling a model to "use a formal tone" assumes it knows what formal means in each locale and
> applies it consistently. "It often doesn't — and this is one of the most common failure modes
> in production multilingual chatbots." **[Grade C — single secondary source
> (promptquorum.com), but consistent with the above.]**

Two recommendations recur across the sources:

- **Name the register explicitly per locale**, as data rather than as a vibe: "Use *Sie*
  throughout, never *du*"; "use standard Castilian *tú* for customer-facing text"; "keigo level
  X". Treated as part of a locale file, not part of the prompt's prose. **[Grade B.]**
- **Write the style instruction in the target language**, because what counts as "formal
  French" is a native expectation the English words do not carry. **[Grade C.]**

**What this means for FollowUp specifically.** The right register is not a global constant, it
is a function of the lead's own opening message. A lead who writes *tú* gets *tú* back; a lead
who writes *usted* gets *usted*. That is a decision to make **once, on the first inbound
message, and then store** — because the acknowledgement, the day-3 follow-up and the day-7
follow-up must all agree, and today nothing makes them agree.

Sources: [futureagi multilingual eval playbook](https://futureagi.com/blog/llm-eval-multilingual-non-english-2026/),
[promptquorum multilingual prompting](https://www.promptquorum.com/prompt-engineering/prompting-across-languages),
[Locale on polite address forms](https://locale-to.medium.com/tu-or-vous-how-to-use-the-polite-form-of-address-in-different-languages-5ac6035a35cb)

---

## 4. Detecting the language at all is harder than it looks

FollowUp's inbound messages are the worst case for language identification: short, informal,
often code-mixed, frequently romanized.

- **Code-switched language ID is "harder than you think"** — a dedicated 2024 paper title, and
  the problem is closely tied to plain language ID; it is most common in exactly the social and
  messaging contexts FollowUp reads from.
  **[Grade B — [arXiv 2402.01505](https://arxiv.org/pdf/2402.01505).]**
- **Romanized Indic and Arabic text is a recognised open problem**, with dedicated benchmarks
  (Indi-RomCoM for romanized Indic-English instructions) and long-standing work on Arabizi.
  **[Grade B — [arXiv 2606.30790](https://arxiv.org/pdf/2606.30790),
  [ACL W16-4807](https://aclanthology.org/W16-4807.pdf).]**
- **Libraries exist that are built for short text specifically** — `lingua-py` advertises
  accuracy on short and mixed-language text; `chattylabs/language-detector` targets SMS/WhatsApp
  length text. **[Grade C — project READMEs, self-reported.]**
  Sources: [lingua-py](https://github.com/pemistahl/lingua-py),
  [chattylabs/language-detector](https://github.com/chattylabs/language-detector)

**The judgement call for FollowUp:** a library is not obviously better than what we already do.
The model already sees the whole message and matches script correctly today. What is missing is
not better detection — it is **writing the answer down** so it is stable and measurable. A
library becomes worth it only if we want detection without paying for a model call.

---

## 5. The data to collect, in priority order

### 5a. From our own users — free, ours, and the only source that reflects real leads

This is the highest-value category and it needs no vendor. The learning loop built on
2026-09-19 (`Business.allowModelTraining`, `FollowUp.draftText`, `deidentifyText`) already
captures draft-versus-sent. **None of it is keyed by language**, so it cannot answer a single
per-language question today.

What to add, all of it derivable from data already flowing through the system:

| Field | Where from | What it unlocks |
|---|---|---|
| `Lead.language` | Decided once, from the first inbound message | Stop re-inferring; filter every metric by language |
| `Lead.script` | Same call (`latin` / native) | The romanized case, already handled ad hoc in one function |
| `Lead.register` | Same call (`informal` / `formal`) | Consistency across the whole sequence — §3 |
| Language on the edited-draft record | Join through the lead | **"Which languages do owners rewrite most?"** — a direct, honest accuracy signal per language, from real businesses, at zero cost |

That last row is the important one. FollowUp already stores what it drafted next to what the
owner actually sent. Keyed by language, that is a per-language quality metric produced by real
users on real leads — the thing money cannot buy and every vendor dataset only approximates.
It is worth building **before** any dataset is downloaded.

### 5b. Sourced native-speaker judgement — small money, irreplaceable

The sibling doc costed this: $15–$40 per language on Fiverr for a native speaker to send a
handful of realistic messages and judge whether the replies read naturally.

The addition this research makes: **give them a register-specific rubric**, not "does it sound
natural". Ask explicitly whether the reply matched the tú/usted (or du/Sie, or keigo level) that
the tester themselves opened with, since that is the failure mode the literature names and the
one a generic "sounds fine" review will miss.

### 5c. Public datasets and benchmarks — useful for evaluation, not for tone

Searched specifically for multilingual customer-service corpora. Honest summary: **the public
material is weaker than it first appears for our purpose.**

| Resource | What it is | Use to us |
|---|---|---|
| CXMArena | Large synthetic customer-experience benchmark | **Limited** — its own paper says it is a single fictional domain, five tasks, "primarily within the English language" **[Grade B — [arXiv 2505.09436](https://arxiv.org/html/2505.09436v2)]** |
| Logistics intent benchmark | ~30K de-identified real customer-service queries; English/Spanish/Arabic seen, Indonesian/Chinese held out for zero-shot | **Closest match** — real logs, real multilinguality, but intent classification, not reply generation **[Grade B — [arXiv 2603.23172](https://arxiv.org/pdf/2603.23172)]** |
| μ-Bench (Sierra) | Open multilingual transcription benchmark from customer-service phone calls, five locales | **For the voice agent**, not for DMs **[Grade C — vendor blog]** |
| xDial-Eval | Multilingual open-domain dialogue evaluation | Method reference for how to evaluate, not training data **[Grade B — [arXiv 2310.08958](https://arxiv.org/pdf/2310.08958)]** |

**Conclusion: do not go dataset shopping.** Nothing public matches "first reply from a small
business to an inbound lead, in language X, at the right register". The nearest thing is our
own traffic (5a) and a handful of paid native speakers (5b).

---

## 6. How to measure this without a native speaker per language — and the honest limit

The tempting shortcut is an LLM judge. The 2026 literature is unusually direct that it is
weakest exactly where it is most tempting.

- **Judge agreement with humans is particularly weak for low-resource languages**, "raising
  concerns that LLM judges may be less reliable in lower-resource settings where automatic
  evaluation is especially tempting due to the scarcity of expert annotators."
  **[Grade B — [arXiv 2607.02235](https://arxiv.org/html/2607.02235).]**
- **Judges are not language-switching invariant** — the same judge picks the right answer in
  English and the wrong one in French on the same underlying question.
  **[Grade B — [arXiv 2606.14278](https://arxiv.org/pdf/2606.14278),
  [arXiv 2604.19405](https://arxiv.org/html/2604.19405).]**
- **Native annotators with inter-annotator agreement above 0.7 per language** is the
  recommended bar. **[Grade C — futureagi playbook.]**

This lands directly on `assessAckRisk`, FollowUp's own English-prompted judge standing between
a generated reply and a real lead. **The gate that protects non-English leads is the part of the
system least validated for them.** That is a finding, not a recommendation — fixing it is a
decision for the founder, not something to change quietly.

The practical middle path the sources support: **deterministic checks first, model judge
second.** `checkAckShape` is already deterministic and language-neutral, and a register check
(does the reply's second-person form match the lead's?) is the same kind of check — cheap,
testable, and not subject to the judge's own language bias.

---

## 7. What I would do, in order

1. **Store language, script and register on the lead, decided once from the first inbound
   message.** Cheap, unlocks everything else, and is the fix for "same tone" — consistency
   across a sequence is impossible while every message re-guesses.
2. **Key the existing learning loop by language.** The draft-versus-sent data is already being
   collected; without a language on it, the single most valuable per-language accuracy signal
   we will ever have is being thrown away as it arrives.
3. **Put the register in the prompt explicitly**, as a named instruction rather than left to
   the model, for the generated reply, the localized fallback and the DM drafts alike.
4. **Add a deterministic register check** alongside `checkAckShape`, for the languages with a
   clean formal/informal split (Spanish, French, German, Portuguese, Italian).
5. **Then, and only then**, spend $15–$40 per language on native-speaker review with a
   register-specific rubric — once there is something stable to review.
6. **Treat `assessAckRisk`'s English prompt as a known open risk** for non-English leads, and
   raise it as a decision rather than patching it silently.

Steps 1 and 2 are ours, free, and the foundation of everything else. Everything after them is
tuning.

---

## What this research could not establish

- **Whether a dedicated detection library beats the current model-based approach on real
  FollowUp messages.** No head-to-head on our own traffic exists; both library claims are
  self-reported. Testable once step 1 stores what we decided.
- **Which languages FollowUp's actual leads write in.** Nobody knows, because nothing records
  it. This is the first thing step 1 would answer, and it should inform which languages get the
  $15–$40 native review rather than guessing.
- **Whether `assessAckRisk` genuinely misjudges non-English replies**, or only might on the
  literature's reasoning. Establishing it needs the native-speaker pass in step 5.
