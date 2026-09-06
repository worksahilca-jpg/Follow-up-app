# Twilio SMS/Voice — A2P 10DLC + TCPA production readiness

Checked: 2026-09-06. Current wiring: `src/lib/twilio.ts` does real signature validation
(`validateTwilioSignature`) and the SMS send/reply path is live; `src/components/TwilioConfig.tsx`
now shows a TCPA consent-obligation notice to the business owner. **A2P 10DLC registration is not
mentioned anywhere in the codebase** — no field, no settings-panel copy, no doc comment.

## Hard blocker before this can be real at volume

### A2P 10DLC registration — carriers block unregistered traffic outright
As of Feb 1, 2025 all three major US carriers (AT&T, T-Mobile, Verizon) block unregistered 10DLC
long-code SMS. This isn't a filtering/throttling nuance anymore — it's binary: an unregistered
Twilio number sending automated business texts will have messages silently dropped or heavily
throttled (industry estimates ~200-500/day before filtering kicks in, and T-Mobile in particular
is functionally closed to unregistered traffic in 2026). Every FollowUp business that connects a
Twilio number and relies on "Send now" / automated follow-up texts is exposed to this the moment
their message volume is noticed by carrier filters — this is not a someday problem, it's a
today problem for any customer already live.

**What's required (per Twilio's own docs):**
1. **Brand registration** with The Campaign Registry (TCR) — legal business name, EIN, business
   type, website. Twilio doc: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/quickstart
2. **Campaign registration** — use case, sample messages, opt-in language/URL, estimated volume.
   Twilio's use-case list: https://support.twilio.com/hc/en-us/articles/1260801844470
3. Since FollowUp is multi-tenant (each business owns its own Twilio number, not FollowUp acting
   as a shared/reseller sender), **each connected business needs its own Brand + Campaign** —
   this is not a one-time platform-level registration FollowUp can do once and be done. That's a
   real product/UX gap: today `TwilioConfig.tsx` only asks for Account SID / Auth Token / phone
   number, with no path for a business to actually register.

**Timeline:** Brand approval is typically minutes to 24 hours unless it needs secondary vetting
(up to 7 days on a data mismatch). Campaign vetting is currently running 10-15+ days per Twilio
support, and full cross-carrier approval (AT&T runs its own independent 2-4 week manual review
regardless of campaign quality) commonly takes 3-6 weeks end-to-end.
(https://support.twilio.com/hc/en-us/articles/4405758341659 ,
https://www.telphiconsulting.com/blog/twilio-a2p-registration-timeline — cross-checked, consistent
2-6 week range across both).

**Cost per business:** Brand registration ~$4 (sole proprietor) or ~$44-48+ (standard, includes
secondary vetting); campaign registration ~$15/mo plus a Twilio monthly campaign fee (~$1.50-$10
depending on use case) plus per-segment carrier surcharges (~$0.003 on AT&T/T-Mobile/Verizon).
(https://help.twilio.com/articles/1260803965530). At $29/mo flat pricing, this needs to be priced
in explicitly — it is a real, recurring, business-borne cost on top of FollowUp's own fee, which
the current UI doesn't disclose at all.

**Use-case classification matters for FollowUp specifically:** FollowUp's texts are follow-ups
to a lead who already messaged/called in (inbound-triggered), which likely qualifies for a
"Customer Care" / low-volume mixed use case rather than "Marketing" — this affects both the
consent standard (see TCPA below) and the throughput tier. This should be decided with actual
legal review, not guessed at in code — flagging it rather than assuming.

**Recommendation for backend-agent:** Twilio's Console supports registering Brand/Campaign via API
(Trust Hub), so this could eventually be a guided in-app flow (similar to how the Gmail OAuth
flow is embedded) rather than requiring every business owner to go register manually in Twilio's
console. Until then, the honest minimum is: (a) a hard warning in `TwilioConfig.tsx` before a
business enables SMS sending that unregistered numbers get blocked/filtered, with a link to
Twilio's registration flow, and (b) do not let this ship silently as "Connected" with no mention
that messages may simply not arrive.

## Should do before scale, not before launch

### TCPA — the consent notice is a good start but incomplete
What's already shipped (the TCPA note in `TwilioConfig.tsx`) correctly puts liability on the
business owner and prompts them to check with counsel — that's the right posture for a $29/mo
tool that can't practically vet every customer's consent records. Gaps worth closing later:
- **Consent standard differs by message type.** Marketing/promotional texts need *prior express
  written consent* (a specific, documented opt-in, not just an inferred one); purely
  informational/transactional messages need only *prior express consent*. FollowUp's follow-up
  texts are arguably a gray area (sales-oriented, but responding to an inbound inquiry) — this is
  a legal categorization question, not an engineering one, but the product's copy should not
  imply the two standards are interchangeable.
- **Opt-out handling isn't visibly wired.** TCPA requires honoring "STOP" (and FCC's April 2025
  rule broadened acceptable opt-out phrasing further) within a reasonable window. Check whether
  Twilio's Advanced Opt-Out feature is enabled at the messaging-service level, or whether
  FollowUp's own webhook handler needs to detect and suppress future sends to a lead who replied
  STOP — I did not find STOP-handling logic in `src/lib/twilio.ts`; backend-agent should confirm.
- **Quiet hours (8am-9pm recipient local time)** aren't things Twilio enforces for you — this is
  a FollowUp-side check based on the lead's timezone (usually inferred from area code / address)
  before an automated send fires overnight. Not built today.
- Statutory damages are real: $500-$1,500 per violation, and this is a currently very active
  plaintiff's-bar area (TCPA filings at near-record volume in 2025-2026) — this raises the
  liability stakes of shipping automated SMS at all without the above pieces before scale, even
  though it's the customer's stated legal responsibility, not FollowUp's.
Source: https://activeprospect.com/blog/tcpa-text-messages/ ,
https://www.nixonpeabody.com/insights/alerts/2026/05/13/a-loud-decision-on-tcpa-quiet-hours
(cross-checked against each other, consistent).

### Voice compliance (for when AI voice-calling ships — not built yet)
Flagging for later since growth-agent's copy already treats voice-calling as a stated future
pillar, not a current feature: as of the FCC's 2024 ruling, AI-generated voices in calls count as
"artificial or prerecorded" under TCPA — meaning an AI-voice follow-up call needs the same
prior-express-consent bar as a robocall, and prior express *written* consent if it's telemarketing
in nature. Twilio's numbers already carry STIR/SHAKEN attestation, which is necessary but not
sufficient — it stops the call from being flagged as spoofed, it does nothing for consent
compliance. There's also an active surge of TCPA suits specifically naming AI-voice-agent
platforms (not just their business customers), per a Twilio-side blog specifically discussing this
exposure. Nothing to build now, but backend-agent should read this before voice-calling design
starts, not after.
Source: https://www.voxtell.ai/blog/stir-shaken-tcpa-ai-calls-compliance-guide-telecom-resellers ,
https://www.henson-legal.com/newsroom/ai-voice-agent-compliance-platform-liability

## Note for growth-agent / anyone relying on current SMS copy
The TCPA banner in `TwilioConfig.tsx` is good and should stay, but it currently reads as if
consent is the *only* compliance gate on SMS. It isn't — A2P 10DLC is a separate, mandatory,
per-business registration step that determines whether the texts arrive at all, independent of
consent. Recommend a second, distinct notice (not folded into the TCPA one) once backend-agent
builds the registration flow, so businesses don't conflate "I have consent" with "my texts will
actually deliver."
