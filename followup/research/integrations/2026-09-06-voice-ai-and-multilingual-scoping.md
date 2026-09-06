# Voice AI (real conversational agent) + multilingual support — scoping pass

Checked: 2026-09-06. This is a scoping/research pass per `PRODUCT_DIRECTION.md`'s "Next real
initiative" section — no product code touched. Follows the sourcing discipline of
`.claude/agents/integrations-research-agent.md` (cite + date every claim, separate hard
blockers from should-do-later, cross-check thin claims) even though this is new-capability
scoping, not an integration already in use.

**Current state confirmed by reading the code first** (not assumed):
- `src/app/api/twilio/voice/[secret]/route.ts` + `src/lib/twilio.ts`: inbound calls get a
  scripted `<Say>` greeting, then `<Record transcribe="true">` (Twilio's own built-in
  transcription, no separate API/cost) plus a missed-call SMS text-back. Nobody and nothing
  is answering the call live — it is a voicemail box, not an agent.
- `src/lib/integrations/openai.ts`: model is `gpt-4o-mini` for all four AI functions
  (`scoreLead`, `classifyAsProspect`, `assessSendRisk`, `generateFollowUpMessage`). No
  streaming/realtime usage anywhere — this is the batch chat-completions API, not a voice
  model.

---

## Part 1 — Real conversational voice AI

### Hard blockers before this is real

**1. Twilio's own `<Record transcribe="true">` (today's placeholder) is English-only —
this is a live, current bug for any non-English caller, not a future concern.**
Twilio's built-in call transcription (the exact feature `voice/[secret]/route.ts` uses today)
"is only supported in American English" per Twilio's own docs
(https://www.twilio.com/docs/voice/twiml/record — cross-checked against
https://support.twilio.com/hc/en-us/articles/223133027-Transcribe-entire-phone-calls-with-Twilio,
consistent). A Spanish- or Hindi-speaking caller leaving a voicemail today gets either a
garbled/empty transcription or one silently mangled into nonsense English words — the lead
still gets created (the call-landing logic doesn't depend on transcription), but
`scoreAndDraftForLead` then runs GPT-4o-mini scoring against garbage transcript text, and the
business owner sees a voicemail message that reads as noise. This is a real, currently-shipping
defect for any FollowUp customer already getting non-English callers, independent of whether
voice AI is ever built — worth a one-line fix note for backend-agent even outside this
research task's scope: either drop the built-in `transcribe="true"` for non-English-inferred
callers or move to Twilio's separate Conversational/Voice Intelligence transcription service,
which does support multiple languages (https://www.twilio.com/en-us/changelog/multi-language-voice-intelligence,
checked 2026-09-06).

**2. TCPA consent for an AI *answering* an inbound call is a genuinely unresolved,
lighter-but-not-zero bar — do not assume it's the same as outbound.**
This is the specific question `PRODUCT_DIRECTION.md` and the existing Twilio research doc
left open (the prior doc only covered AI-voice *initiating* calls). What's found:
- TCPA's heaviest obligations — prior express (written, for marketing) consent — target
  calls/texts the business *initiates*. When a caller dials in themselves, much of that
  consent burden is already satisfied by the fact that they called: consent is implied for
  the topic they called about, but is scope-limited to that reason and is **not** blanket
  consent to be marketed to on that same call by an AI voice (per multiple 2026 TCPA
  compliance guides: https://www.henson-legal.com/ai-voice-compliance,
  https://www.ringlyn.com/blog/tcpa-compliance-ai-voice-agents-2026/ — both agree on this
  point, cross-checked).
- However — obligations that are NOT consent-gated still apply regardless of who initiated
  the call: (a) disclosure that the caller is talking to an AI (several state laws, and a
  growing FCC/FTC posture, treat non-disclosure of an AI voice as a separate violation
  category from consent); (b) honoring an opt-out/"stop" mid-call; (c) call recording
  consent, which is a **separate, state-level** law from TCPA — several states (California,
  Florida among them) require two-party consent to record a call, and an AI agent that logs
  the conversation (as this would, to write it into the lead's history per Rule 2 of
  `PRODUCT_DIRECTION.md`) is recording it.
- There is an active wave of TCPA suits naming AI-voice-agent *platforms themselves*, not
  just their business customers (per the prior Twilio SMS/voice research doc, still true as
  of this check) — so FollowUp-as-platform carries some exposure here too, not just each
  connected business.
- **Bottom line: inbound is meaningfully lower-risk than outbound AI-voice calling, but "the
  lead called us, so anything goes" is not a safe reading.** At minimum: (1) an upfront
  disclosure line in the greeting ("You're talking to an AI assistant for ___"), (2) a
  two-party recording-consent disclosure before anything is logged (most states with
  two-party consent laws accept a spoken notice at call start as sufficient), (3) keep the
  conversation scoped to what the caller called about — don't let the agent pivot into
  unsolicited upsell/marketing content within the same call without that being flagged as a
  different consent tier. This needs real legal review before launch, same posture as the
  existing TCPA SMS notice — flagging the shape of the problem, not resolving it here.
  Sources: https://www.henson-legal.com/ai-voice-compliance,
  https://www.ringlyn.com/blog/tcpa-compliance-ai-voice-agents-2026/,
  https://www.retellai.com/blog/tcpa-compliance-playbook-voice-ai-outbound (checked 2026-09-06).

### Should do before scale, not before launch

- **Per-state call-recording consent logic.** One-party-consent states (most of the US) need
  nothing extra; two-party states need the spoken disclosure above. This can be inferred from
  the connected Twilio number's area code the same way quiet-hours logic would infer a lead's
  timezone (per the existing Twilio SMS research doc) — not built yet anywhere.
- **Fallback to a human/voicemail when the AI can't handle the call** (bad audio, caller
  hangs up on the AI, an unsupported language). Every vendor below supports a
  forward-to-number fallback; this should never be "the call just drops."
- **STIR/SHAKEN is necessary but insufficient**, same as the existing Twilio doc already
  found for outbound — it stops the number being flagged as spoofed, does nothing for
  consent.

### The options, evaluated

**Option A — Twilio ConversationRelay + OpenAI Realtime API (build-it-ourselves on
Twilio infra already connected)**
- What it is: Twilio's own product for bridging a live call to a WebSocket, purpose-built to
  connect to an LLM's realtime/speech-to-speech API (OpenAI's Realtime API is Twilio's own
  documented reference integration:
  https://www.twilio.com/en-us/blog/developers/tutorials/product/integrate-openai-twilio-voice-using-conversationrelay,
  checked 2026-09-06).
- **Integration complexity with FollowUp's existing numbers: lowest of any option.** No
  porting, no importing into a third party — it's a different TwiML verb
  (`<ConversationRelay>`) on the *same* number already configured with FollowUp's per-business
  Twilio Account SID/Auth Token/webhook-secret pattern (`findBusinessByTwilioSecret` in
  `src/lib/twilio.ts` already resolves a business from an inbound Twilio webhook — the same
  routing plugs straight into a ConversationRelay handler with no new per-business
  onboarding step).
- **Latency:** ~200ms end-to-end (speech-end to agent-response-start) reported for the
  Realtime API path — genuinely conversational, not laggy
  (https://dev.to/ryancwynar/sub-200ms-voice-ai-bridging-twilio-and-openai-realtime-api-21g3,
  checked 2026-09-06).
- **Cost:** Twilio telephony ~$0.0085–$0.014/min + OpenAI Realtime API token-metered pricing.
  `gpt-realtime-mini` (the cost-appropriate tier here, not full `gpt-realtime`) runs
  ~$10/million audio-input tokens, ~$20/million audio-output tokens
  (https://www.layer3labs.io/guides/openai-realtime-api-pricing, checked 2026-09-06) — in
  practice this nets out roughly **$0.08–$0.15/min all-in** for a mini-tier realtime model,
  comparable to or cheaper than the dedicated platforms below, though this wasn't found
  as a single stated blended rate anywhere and should be measured against real call volume
  before being quoted to customers.
- **Multilingual:** genuinely real, not just marketing — the Realtime API is the same
  natively-multilingual GPT-4o family already in use elsewhere in this codebase (see Part 2),
  and OpenAI's Realtime models handle multi-turn speech-to-speech in the input language
  without a translation step. Coverage is strongest in the ~15-20 languages GPT-4o itself is
  strongest in (see Part 2's findings on uneven coverage) — genuinely good for
  Spanish/French/German/Portuguese/Mandarin, weaker and less validated for
  lower-resource languages.
- **Build cost:** real engineering lift — this is a WebSocket server FollowUp has to write,
  host, and keep alive (Twilio streams audio frames to it, expects audio frames back), plus
  building the same trust-tier gating (`assessSendRisk`-equivalent for a live conversation:
  what can the agent commit to, when does it need to hand off) that text drafting already has
  for text. Not a weekend project.

**Option B — Vapi**
- **Integration:** import an existing Twilio number by handing Vapi the Account SID/Auth
  Token (https://docs.vapi.ai/phone-numbers/import-twilio, checked 2026-09-06) — no porting,
  sits alongside, Twilio Console webhook config gets pointed at Vapi instead of FollowUp's
  own route.
- **Cost:** $0.05/min platform fee is the headline, but real production stacks (Deepgram STT
  + GPT-4o-mini + ElevenLabs TTS + Twilio) land at **$0.10–$0.30/min all-in**
  (https://ainora.lt/blog/ai-voice-agent-cost-per-minute-2026,
  https://medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute-578f38af3523,
  cross-checked, consistent range — checked 2026-09-06).
- **Multilingual:** Vapi lets you pick STT/TTS providers independently, so non-English
  quality depends entirely on which third-party provider you wire up per language — "for
  major European languages results are generally acceptable" but accent-handling and
  non-native-speaker recognition are called out as real weak points in independent reviews
  (https://obsivara.com/blog/retell-vs-vapi, checked 2026-09-06). More assembly-required than
  ElevenLabs, more control if FollowUp wants to tune per-language later.
- **Latency:** competitive (~same ballpark as Option A) when using fast STT/TTS providers,
  but is only as good as the weakest link in the STT→LLM→TTS chain you assemble — a real
  operational burden, not a fixed number.

**Option C — Retell AI**
- **Integration:** same story — import via SIP/Twilio credentials
  (https://docs.retellai.com/api-references/import-phone-number, checked 2026-09-06).
- **Cost:** $0.055/min voice-infra floor + model/TTS/telephony on top, real-world
  $0.11–$0.25/min all-in (same sources as Option B, cross-checked). At 10,000 calls/month ×
  4 min average, ballparks to ~$2,800/month all-in
  (https://medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute-578f38af3523).
- **Multilingual:** more managed/opinionated than Vapi (less tuning, less control); reviews
  specifically flag it falling short of specialized regional providers for
  "complex-grammar languages" (Baltic, Nordic — case systems/declensions) — a real, named
  limitation, not vague marketing (https://www.coval.ai/blog/vapi-vs-retell-ai-which-voice-ai-platform-is-right-for-your-project,
  checked 2026-09-06).

**Option D — Bland.ai**
- **Cost:** flat $0.07–$0.12/min all-inclusive on enterprise plans (higher floor, no
  provider-shopping needed, simplest cost model of the three dedicated platforms) — checked
  2026-09-06, cross-referenced across two independent comparison posts, consistent.
- Less written specifically about multilingual quality than the other two in this search
  pass — treat that as a gap in available public evidence, not as a lack of the capability.

**Option E — ElevenLabs Conversational AI (ElevenAgents)**
- **Multilingual: the strongest, best-evidenced claim of any option, not just marketing.**
  70+ languages, and it's the platform independent reviewers specifically call out as
  sounding most natural in Spanish/French/Arabic "out of the box" vs. Vapi/Retell's
  provider-dependent quality (https://medium.com/@relinns_technologies_pvt_ltd/the-best-spanish-voice-agent-is-the-one-that-doesnt-sound-like-it-learned-spanish-from-a-dropdown-menu-935cd29aea9c,
  checked 2026-09-06 — a single source, but consistent with ElevenLabs' own product
  positioning and its origin as a voice-cloning/synthesis company first).
- **Latency:** sub-100ms on Flash-tier voices, ~75ms reported for production Flash v2.5
  (https://quiq.com/blog/elevenlabs-pricing/, checked 2026-09-06) — best latency number found
  in this pass, though it's a TTS-generation number, not necessarily the full
  speech-to-speech round-trip including the LLM's own thinking time.
  Note: sources vary on exact language coverage per model tier (Flash v2.5 cited at 32
  languages vs. the v3 model's 70+) — the two numbers are not interchangeable and depend on
  which underlying model tier is actually deployed for conversational (not just TTS) use.
- **Cost:** ~$0.08/min for the Agent/Speech Engine tier at current 2026 pricing (a 20%
  price cut landed May 2026) plus the underlying LLM cost if not using ElevenLabs' own —
  competitive with Retell, cheaper than a fully-assembled Vapi stack.
- **Integration:** ElevenLabs' conversational product is telephony-agnostic and documented
  to work over a SIP trunk/Twilio number the same way as the others — sits alongside, no
  porting required.

### Recommendation

**Build Option A first: Twilio ConversationRelay + OpenAI's Realtime API (the mini tier),
not a dedicated platform.** Reasoning, against `PRODUCT_DIRECTION.md`'s own rules:

1. **Rule 2 (own the data) makes this close to mandatory, not just cheaper.** Every dedicated
   platform (Vapi/Retell/Bland/ElevenLabs) is, architecturally, the same trap Rule 2 already
   warns against for Gmail/Twilio/Instagram: the actual conversation — the thing that should
   become permanent, scored, DB-owned lead history exactly like SMS/email conversations
   already are — would live first on a third party's platform and only reach FollowUp's DB
   as a secondhand webhook/transcript callback, subject to their retention and format
   choices. Building directly on Twilio (already the system of record here) keeps the raw
   conversation closer to FollowUp's own infrastructure from the start.
2. **It's the only option requiring zero new per-business onboarding.** Every dedicated
   platform needs each business's Twilio credentials handed to a second vendor and a second
   webhook re-pointed — meaningful UX/support surface for a self-serve $29/mo product, and a
   second place A2P/voice compliance now has to be configured and gotten right (echoing the
   existing Twilio research doc's finding that A2P 10DLC is *already* a per-business
   registration burden this product hasn't solved once — don't multiply that by a second
   vendor before the first is even solved).
3. **The multilingual quality bar is "genuinely conversational in FollowUp's realistic
   customer languages," not "best possible voice in 70 languages."** OpenAI's Realtime models
   share the same underlying multilingual strength already established (if unverified in
   practice — see Part 2) elsewhere in this codebase; ElevenLabs' edge is voice *naturalness*
   in more languages, which matters more for a consumer-facing voice brand than for a home
   services / small-business follow-up call where "understood correctly, responded
   sensibly, in the caller's language" beats "sounds like a native speaker."
4. **Cost is competitive or better,** and — more importantly for a company charging $29/mo —
   isn't stacked on top of a second platform's own per-minute margin on top of the LLM/TTS
   costs it's passing through anyway.
5. **The real cost of this path is engineering time, not vendor risk or lock-in** — which
   is the right trade for a company explicitly trying to avoid building "what Google/
   Salesforce/[a vertical SaaS] will give away free" (Rule 4) elsewhere, while investing real
   effort into the piece that's actually the moat (Rule 6): an AI voice agent that shares
   scoring/trust logic with the rest of the product (the same `assessSendRisk`-style tiering
   that already gates automated text/email sends) is a defensible extension of what's already
   built, not a bolt-on from a vendor with no visibility into FollowUp's lead data model.

**When to reconsider:** if engineering bandwidth for the WebSocket bridge + realtime
audio-streaming plumbing turns out to be the actual bottleneck (this is a genuinely different
skillset than the rest of this Next.js/Prisma codebase), Retell AI is the fallback — its
per-minute floor plus pass-through pricing is the most predictable of the dedicated
platforms, and Twilio-number import is a documented, low-friction path if this needs to ship
faster than an in-house build allows. Don't reach for Vapi first — its provider-assembly model
trades control for exactly the integration complexity this recommendation is trying to avoid,
and don't reach for ElevenLabs first either despite its multilingual edge — its strength is
voice naturalness, which is not FollowUp's actual bottleneck (correctly understanding and
routing a caller's need is).

---

## Part 2 — Does anything today actually work for non-English leads?

Verified against the real code, not assumed. Answer, stated plainly: **nothing has ever been
tested with non-English content, and there is at least one real, demonstrable gap already
found above (Twilio's English-only built-in voicemail transcription). For AI scoring/drafting
specifically, there's no hardcoded English-only instruction, but there's also no instruction
telling the model to respond in the lead's language — which is a real, separate gap in the
opposite direction from what you'd assume.**

### AI scoring/drafting (`src/lib/integrations/openai.ts`)

- **Model:** `gpt-4o-mini` for all four functions (scoring, prospect classification, send-risk
  assessment, message drafting) — a single constant (`const MODEL = "gpt-4o-mini"`), no
  per-language or per-tenant override.
- **No hardcoded "respond in English" instruction exists anywhere in the four system
  prompts** — read line by line, none of them say "always respond in English" or similar.
- **But there's no instruction to respond in the lead's language either — this is the actual
  gap, not a false negative.** `generateFollowUpMessage`'s system prompt (the one that
  produces the text actually sent to a lead) never tells the model what language the reply
  should be written in, and never instructs it to detect and mirror the conversation's
  language. GPT-4o-mini's default behavior, absent an explicit instruction, is typically to
  respond in the language of the most recent input — which would often work by accident for
  a lead writing entirely in, say, Spanish, but is unverified, untested, and not a designed
  behavior FollowUp can rely on or that a customer can trust. A mixed-language thread
  (common in real bilingual households/businesses) has no defined behavior at all today.
  This should be an explicit instruction ("write your reply in the same language as the
  lead's most recent message"), not left to model default — a one-line prompt fix, but a real
  gap as it stands.
- **Model capability itself:** GPT-4o-mini shares the GPT-4o-family tokenizer and training,
  which measurably improved non-English handling over GPT-3.5 — "50+ languages, covering 97%
  of global speakers" per OpenAI's own materials — but coverage is uneven in practice:
  strong for French/German/Spanish/Portuguese/major European and East Asian languages, with
  documented weaknesses in nuance/idiom for languages like Arabic (a cited example: GPT-4o
  translating a Arabic term of endearment literally rather than idiomatically) and for
  lower-resource languages generally, though the gap versus English has been narrowing across
  model generations (https://ucstrategies.com/news/gpt-4o-complete-guide-benchmarks-review-2026/,
  cross-referenced against arXiv model-comparison papers, checked 2026-09-06). No
  FollowUp-specific testing of any of this exists — say that plainly rather than assuming
  "the model probably handles it," per the task's own instruction.
- **`classifyAsProspect`'s prompt is written entirely in English and reasons about English-
  language signals** (sender-name patterns like "HR/recruiting-sounding name," phrases like
  "SIN/SSN," "work permit") — these heuristics are English/US-centric by construction (a
  Mexican lead's recruiter email or a Canadian SIN-related email would likely still be caught
  correctly since the model reasons semantically, not via keyword-matching, but this has
  never been tested against a non-English or non-US-context thread).

### Ingestion side — does capture mangle non-English/non-Latin content?

- **Database layer: no issue found.** `Message.body` (and `Lead.name`, etc.) are plain Prisma
  `String` columns with no `@db.VarChar` length cap (`prisma/schema.prisma`) — these map to
  Postgres `TEXT`, which is UTF-8 native. No truncation-by-byte-count or codepage issue at the
  storage layer.
- **Gmail sync (`src/lib/integrations/gmail.ts`):** `decodeBase64Url()` explicitly decodes
  with `Buffer.from(data, "base64").toString("utf-8")` — correct for non-Latin scripts
  (Cyrillic, CJK, Arabic, emoji, etc.), not a Latin-1/ASCII assumption. The one place that
  could bite: `stripQuotedReply()` and the various `.slice(0, N)` character caps (5000 chars
  in `processThreadRefs`, 1200 chars in `classifyAsProspect`'s pre-processing) truncate by
  JS string length (UTF-16 code units), which for most scripts is fine but can technically
  split a surrogate pair (rare emoji/rare CJK extension characters) mid-character at the exact
  cutoff — a real but extremely minor edge case, not something to prioritize.
- **Twilio SMS (`src/app/api/twilio/sms/[secret]/route.ts`):** Twilio delivers inbound SMS
  `Body` as UTF-8 form-encoded text regardless of whether it was sent as GSM-7 or UCS-2
  (Twilio handles the SMS-encoding-to-text conversion on their end before it ever reaches
  this webhook) — the route just trims and stores it as-is (`(formParams.Body ?? "").trim()`).
  No mangling found in this path. **Not independently verified against a real non-English SMS
  in this pass** (would require an actual test message from a non-English number) — flagging
  that as untested rather than claiming it's confirmed safe.
- **Twilio Voice transcription — confirmed broken for non-English, see Part 1's hard blocker
  #1 above.** This is the one ingestion path with a real, sourced, current defect: the
  built-in `<Record transcribe="true">` Twilio feature this codebase uses is English-only by
  Twilio's own documentation.
- **Instagram DM (`src/lib/instagram.ts`):** the file only handles sender-ID resolution,
  message sending, and lead upsert — it has no separate module in this codebase for
  *receiving* and parsing inbound DM text (that logic must live in
  `src/app/api/instagram/**`, not read in this pass since it wasn't in the requested file
  list — flagging as unread rather than assuming it's fine). Instagram's Graph API delivers
  message text as UTF-8 JSON, which is the same shape Gmail/Twilio already handle correctly,
  so there's no structural reason to expect a different outcome, but this specific file path
  was not verified end-to-end in this pass.

### Bottom line for Part 2

Say it plainly, as instructed: **non-English content has never been tested anywhere in this
product.** The database and Gmail paths look structurally sound (real UTF-8 handling, no
hardcoded English assumption). Twilio's voicemail transcription is confirmed broken for
non-English by Twilio's own documentation. The AI drafting layer has a real, fixable gap (no
instruction to reply in the lead's language) that happens to often work by LLM default
behavior but is unverified and undesigned. None of this should be represented internally or
externally as "multilingual support" until it's actually been run against real non-English
conversations end to end — which hasn't happened once.

## Summary table

| Path | Multilingual quality | Cost/min (all-in, realistic) | Integration w/ existing Twilio # | Latency |
|---|---|---|---|---|
| **Twilio ConversationRelay + OpenAI Realtime (mini)** — recommended | Real, same GPT-4o family already in product; strong in ~15-20 languages, uneven beyond | ~$0.08–0.15 (engineering estimate, not vendor-quoted) | Native — same number, new TwiML verb | ~200ms, genuinely conversational |
| Vapi | Provider-dependent, assembly required | $0.10–0.30 | Import via Twilio SID/token | Provider-dependent |
| Retell AI | Managed, weaker on complex-grammar languages | $0.11–0.25 | Import via SIP/Twilio | Competitive |
| Bland.ai | Least publicly evidenced | $0.07–0.12 flat | Documented import | Not separately verified here |
| ElevenLabs Conversational AI | Strongest evidenced multilingual/voice naturalness, 70+ langs (tier-dependent) | ~$0.08+ | SIP/Twilio, sits alongside | ~75-100ms (TTS-side) |
