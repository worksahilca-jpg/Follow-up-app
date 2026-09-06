# Scoping a real multilingual voice-AI follow-up agent

**Researched:** 2026-09-06, by the CEO's session directly (not a dedicated
research-agent run — the first attempt at this failed to an API rate limit
before producing findings; this is a leaner pass via direct `WebSearch`,
same sourcing standard as the rest of `research/`).

**Purpose:** the CEO's stated long-term direction (`CLAUDE.md`'s "Product
Direction") is a guarantee that no lead goes cold on any channel, in any
language, eventually without a dedicated human — including AI answering
phone calls. This scopes what that would actually take before any
engineering time gets committed to it.

---

## 1. This is not unclaimed territory — a real competitive check first

Before vendor/cost details: a live, low-price SMB category already sells
"AI answers your phone, bilingual" today. This matters more than the
pricing details below, so it's first.

- **AIRA**: $24.95/mo starter tier, English/Spanish detection **included at
  no extra cost on every plan**.
- **Allo**: ~$18/user/month, "unlimited English/Spanish agent included."
- **Rosie**: $49/mo, positioned as the low-friction solo-operator option.
- **Smith.ai**: $95/mo (≤50 calls) up to $800/mo (500+ calls), English +
  Spanish, bilingual agents on select plans.
- **Ruby**: English + Spanish on all plans, plus scheduling/payments.

(Source: [withallo.com/blog/best-bilingual-ai-receptionists](https://www.withallo.com/blog/best-bilingual-ai-receptionists), [skipcalls.com/blog/best-ai-phone-answering-service-small-business-2026](https://skipcalls.com/blog/best-ai-phone-answering-service-small-business-2026), checked 2026-09-06 via
WebSearch — vendor/review-site figures, not independently verified against
each provider's own pricing page.)

**Read for FollowUp:** "AI answers your phone in English and Spanish" is
not a differentiator by itself anymore — it's close to table stakes at the
SMB price point already. None of these are also a lead-scoring/follow-up/
sequencing product — they stop at "answered the call, took a message or
booked an appointment." **The actual differentiation has to be the
combination**: the same zero-lead-loss guarantee, scoring, and follow-up
logic FollowUp already has for email/SMS/DM, extended to voice — not voice
in isolation, and not "every language" as a headline claim when EN/ES
bilingual is already commoditized at this exact price point.

---

## 2. Vendor/architecture options for the underlying pipeline

Two different layers, easy to conflate:
- **SMB-facing answering services** above (AIRA, Allo, Rosie, Smith.ai,
  Ruby) — a finished product FollowUp would be *competing with*, not
  building on.
- **Developer voice-AI infrastructure** (Vapi, Retell AI, Bland AI,
  ElevenLabs Conversational AI) — what FollowUp would actually integrate if
  it builds this itself on top of the existing Twilio-per-business pattern
  already in `src/lib/twilio.ts`.

Published headline rates for the infra layer: Vapi ~$0.05/min, Retell AI
~$0.07/min+, Bland AI ~$0.09/min flat. **All three undersell the real
cost** — one comparison put realistic all-in pricing at $0.10–$0.30/min
once speech-to-text, the LLM itself, text-to-speech, and Twilio's own
telephony minutes are all added on top of the platform's own orchestration
fee; industry-wide the range cited was $0.07–$0.50/min depending on model/
voice tier. (Source: [medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute](https://medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute-578f38af3523), [ainora.lt/blog/ai-voice-agent-cost-per-minute-2026](https://ainora.lt/blog/ai-voice-agent-cost-per-minute-2026), [klariqo.com/blog/voice-ai-cost-per-minute](https://klariqo.com/blog/voice-ai-cost-per-minute/), checked 2026-09-06 — figures are
review-site/blog synthesis, not each vendor's own rate card verified
directly; treat as directionally right, not exact.)

**Rough cost-to-serve at FollowUp's likely scale** (a solo operator or
small team, dozens to a couple hundred calls/month, ~3-5 min/call): at
$0.15–$0.30/min all-in, that's roughly **$15–$150/month in raw voice-AI
cost alone** before any margin — a real number against the flat $29/mo
price, and one reason a BYO-Twilio-style model (the business pays its own
usage, same pattern as SMS today) is worth keeping rather than trying to
bundle voice minutes into the flat fee the way SMS already isn't bundled.

**Confidence:** medium — costs corroborated across 3+ independent
comparison sources but none are a vendor's own official rate card checked
directly; re-verify against Vapi/Retell/Twilio's actual pricing pages
before this becomes a real budget line.

---

## 3. Language coverage reality (not the marketing claim)

- **ElevenLabs**: Flash v2.5 model covers 32 languages; the newer Eleven
  v3 model covers 74; the platform overall is marketed at "70+ languages."
  (Source: [deepgram.com/learn/elevenlabs-languages-vs-accents-support](https://deepgram.com/learn/elevenlabs-languages-vs-accents-support), checked
  2026-09-06.)
- **Deepgram**: search results confirmed it's the STT-side industry
  leader (Nova-3) with a newer Aura-2 TTS model built for real-time voice
  agents, but did not surface Aura-2's specific language count — the
  common real-world pattern is Deepgram for transcription paired with
  ElevenLabs for the voice, rather than one vendor doing both well.
  (Source: [burki.dev/blog/43-deepgram-vs-elevenlabs-voice-ai](https://burki.dev/blog/43-deepgram-vs-elevenlabs-voice-ai), checked 2026-09-06 — the
  specific Aura-2 language count is an open question, not confirmed
  either way here.)

**Read for FollowUp:** major world languages (Spanish, Mandarin, Hindi,
Arabic, Portuguese, etc., matching `CLAUDE.md`'s framing) are genuinely
well covered by current top-tier stacks — this part of the vision is
buildable, not aspirational. "Every language" as a literal claim still
overstates it; low-resource languages/dialects are the honest gap, and
this research didn't find a source willing to name that gap precisely
(most vendor pages state a language count, not which languages are
merely "supported" vs. genuinely fluent).

---

## 4. Safety for voice specifically — sharper than the earlier report's finding

Section 3.1 of `research/customers/2026-09-05-icp-pain-points-trust-pricing.md`
already flagged that FollowUp's current `assessSendRisk()` is "an LLM
judging an LLM" — a real, named weakness. This pass found the voice-AI
industry's own answer to that exact problem, which is worth adopting
directly rather than re-deriving:

> Escalation rules like "if the caller asks for a refund, transfer to a
> human" living only in a system prompt are suggestions to the LLM, not
> guarantees — a sufficiently persistent caller can talk an agent out of
> them. **Code-level guardrails that operate outside the LLM are the part
> that can't be prompted around**, and are described as the real safety
> net, not the system prompt.

(Source: [autointerviewai.com/blog/guardrails-voice-ai-keeping-agent-on-script-2026](https://www.autointerviewai.com/blog/guardrails-voice-ai-keeping-agent-on-script-2026), checked
2026-09-06.)

Concretely, for a future FollowUp voice tier: risk-gating a live call can't
work the way the current email/SMS gate does (there's no "hold for
approval" once words are already spoken). The pattern this research
surfaced instead is **deterministic, code-level triggers** — specific
intents (payment disputes, cancellations, legal/medical topics, explicit
request for a human) force an immediate transfer, decided by matching
detected intent against a fixed list rather than trusting the model's own
judgment mid-call — plus a **context-rich handoff** (the human who picks
up gets the transcript, detected intent, and what's already been tried,
not a cold transfer). This is a concrete argument for building any voice
tier around a rules engine wrapping the model, not a copy of
`assessSendRisk()`'s "ask another LLM" pattern.

(Source: [usefini.com/guides/ai-voice-agents-warm-handoff-human-agents](https://www.usefini.com/guides/ai-voice-agents-warm-handoff-human-agents), [callmissed.com/blog/ai-agent-human-handoff-callmissed-escalation-guide](https://www.callmissed.com/blog/ai-agent-human-handoff-callmissed-escalation-guide), checked
2026-09-06.)

---

## Should re-verify before treating as settled

- All per-minute costs above are review/comparison-site syntheses — pull
  Vapi's, Retell's, and Twilio Voice's own current rate cards directly
  before this is a real budget number.
- Deepgram Aura-2's actual language count is unconfirmed here.
- The bilingual-SMB-competitor pricing (AIRA/Allo/Rosie/Smith.ai/Ruby) came
  from review/aggregator sites, not each vendor's own page — worth a direct
  check before using any of these numbers in a competitive battlecard.
- This is still a desk-research pass, not a build spike — no code in this
  repo was touched or prototyped against any of these vendors. A real
  next step, if this direction moves forward, is a small throwaway spike
  (one vendor, one phone number, one scripted call) rather than more
  reading.

## Sources (checked 2026-09-06 via WebSearch)

- [withallo.com/blog/best-bilingual-ai-receptionists](https://www.withallo.com/blog/best-bilingual-ai-receptionists)
- [skipcalls.com/blog/best-ai-phone-answering-service-small-business-2026](https://skipcalls.com/blog/best-ai-phone-answering-service-small-business-2026)
- [medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute](https://medium.com/@automation.labs/vapi-vs-retell-vs-bland-in-2026-the-true-cost-per-minute-578f38af3523)
- [ainora.lt/blog/ai-voice-agent-cost-per-minute-2026](https://ainora.lt/blog/ai-voice-agent-cost-per-minute-2026)
- [klariqo.com/blog/voice-ai-cost-per-minute](https://klariqo.com/blog/voice-ai-cost-per-minute/)
- [deepgram.com/learn/elevenlabs-languages-vs-accents-support](https://deepgram.com/learn/elevenlabs-languages-vs-accents-support)
- [burki.dev/blog/43-deepgram-vs-elevenlabs-voice-ai](https://burki.dev/blog/43-deepgram-vs-elevenlabs-voice-ai)
- [autointerviewai.com/blog/guardrails-voice-ai-keeping-agent-on-script-2026](https://www.autointerviewai.com/blog/guardrails-voice-ai-keeping-agent-on-script-2026)
- [usefini.com/guides/ai-voice-agents-warm-handoff-human-agents](https://www.usefini.com/guides/ai-voice-agents-warm-handoff-human-agents)
- [callmissed.com/blog/ai-agent-human-handoff-callmissed-escalation-guide](https://www.callmissed.com/blog/ai-agent-human-handoff-callmissed-escalation-guide)
