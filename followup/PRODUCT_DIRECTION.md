# Product direction — build for 20-year survival, not just to ship features

Set by the CEO (2026-09-06). This is a standing filter, not a one-time memo — every
agent in `.claude/agents/` and every session working on this repo applies it before
adding anything, not just when it's freshly top of mind. `manager-agent.md` and
`growth-agent.md` point back here; if you're proposing a feature, a roadmap item, or
a positioning change and haven't checked it against these six rules, you're not done.

## The mission — in the CEO's own words

> Every CRM has lead generation and lead sortation. Nobody is concerned about the
> leads that are going cold, the leads that have gone into the interstellar phase,
> or the leads that have never been reached. Gmail, Instagram DMs — people are
> spamming leads and nobody is answering them. We have to make sure no potential
> lead goes cold, and a business owner should not lose a lead because of not
> following up, not following up in time, or not following up correctly. I don't
> think any app is doing this. My main goal is to remove the position of the
> salesperson or follow-up person who is doing this manually — AI agents receiving
> calls, in every language, fetching and following up on leads in every language,
> not just English. This makes businesses more money, more productive, in less
> time.

Read literally, not softened: **the job is rescuing leads that would otherwise die
— buried in an inbox, an unopened DM, a missed call — and the end state is that no
human does this job at all**, in any language, not just English. Every existing
feature (multi-channel capture, AI scoring, approval-first drafting, the per-lead
Assisted/Autonomous tier) exists to walk toward that end state, not as the goal
itself. This is the actual filter every rule below serves — if a rule and this
mission ever seem to conflict, the mission wins; update the rule.

**On rule 1, resolved — staying horizontal, decided by the CEO (2026-09-06):** the
depth this needs isn't one industry — it's this specific job, done further than
any generalist CRM will bother to (rescuing dead/unreached leads, real autonomy,
every language). A generalist platform can't casually build this because their
own business model depends on there being a human seat to sell to; FollowUp's
ideal customer often can't afford that seat in the first place, so full autonomy
isn't a nice-to-have upgrade for them, it's the only way this job gets done.
**Going deep on one specific industry was considered and explicitly declined** —
see the realtor research below, which found real estate specifically to be a
contested, AI-native-competitor-crowded vertical rather than an open gap; the
home-services data point stays on file as evidence for the mission's framing (the
job, not any one industry, is underserved) but is not being adopted as a target
vertical. FollowUp stays horizontal by decision, not by default.

## The six rules

1. **Vertical depth over horizontal breadth.** Default to going deep on one industry
   (e.g. real estate, home services, insurance) over staying generic "follow-up for
   anyone." Features that only make sense "for everyone" lose to platforms; features
   that make this indispensable to one industry don't.

2. **Own the data, don't just view it.** Lead history, AI scoring reasoning, message
   templates, and outcomes must live in our own DB as permanent records — never just
   computed live from Gmail/Twilio/Instagram on each page load. Years of tuned
   history living only here is the real lock-in.

3. **Trust is a feature — ship it like one.** Every automation capability needs an
   explicit, user-visible guarantee about what it will never do, plus a test proving
   it. Model the "stops the instant a lead replies" guarantee. No automation ships
   silently.

4. **Don't build what Google/Salesforce will give away free.** Skip parity features
   big platforms are about to bake in for free. Spend effort on what's too
   vertical-specific or opinionated for them to bother with.

5. **Design for rising autonomy, not fixed human-in-the-loop.** Keep "AI drafts →
   human approves" swappable per lead/tier (like the Assisted/Autonomous selector
   already does) instead of hard-baked as permanent. More autonomy is coming — the
   architecture shouldn't need a rewrite to get there.

6. **Label every roadmap item "moat" or "table stakes."** Moat = hard for a
   competitor/platform to copy in 6 months. Table stakes = needed just to stay
   credible. Bias effort toward moat work once table stakes are covered.

**Before building a feature, state in one line which rule it serves.** If none, that's
fine — just flag it as short-term/table-stakes, not strategic. Don't retrofit a
justification onto a feature someone already wants to build; if it doesn't serve one
of these, say so plainly.

## Where this repo already stands against the rules, as of 2026-09-06

Not a self-congratulation pass — a real check, including the gaps.

- **Rule 1 (vertical depth) — resolved, staying horizontal by decision.** FollowUp
  stays explicitly horizontal ("follow-up for anyone" — see `growth-agent.md`'s
  thesis), not because a vertical was never considered but because it was
  weighed and declined. `research/customers/2026-09-05-icp-pain-and-trust-objections.md`
  found the strongest quantified pain signal of any research pass in home-services
  contractors (62% industry-wide missed-call rate, 391% conversion lift from a
  1-minute callback), but `research/market/2026-09-06-realtor-tool-landscape.md`
  found the closest adjacent vertical actually tried (real estate) to already have
  funded, AI-native competitors (Structurely, Ylopo) marketing almost exactly
  FollowUp's pitch — cold-lead rescue, multilingual, full AI autonomy — to that
  exact segment. Read together: "the depth is on the job, not the industry" (see
  the mission section above) is the CEO's actual, considered position, not an
  unexamined default.
- **Rule 2 (own the data) — already true, verified, not assumed.** Lead conversations
  (`Conversation`/`Message`), AI scoring reasoning (`Lead.scoreReason`/`scoreFactors`),
  drafted messages (`Lead.suggestedMessage`), and outcomes (`FollowUp.repliedAt`,
  `Deal`) are all real Prisma-backed rows, not recomputed live from Gmail/Twilio/
  Instagram on page load. This has been true since the schema was first built, not
  something added for this rule — worth stating plainly rather than re-verifying
  every time it comes up.
- **Rule 3 (trust ships like a feature) — the strongest rule already in practice.**
  "Stops the instant a lead replies" (sequences), approval-first-by-default,
  per-lead Assisted/Autonomous, the TCPA and A2P 10DLC notices, and three
  concurrency-safety fixes this session (rapid-engagement dedup, missed-call
  text-back cooldown, the Ponds claim race) are all real, user-visible guarantees —
  but none of them currently ship with an automated test proving the guarantee
  holds, which the rule explicitly asks for. That's a real gap, not just a nuance.
- **Rule 4 (don't build free-platform parity)** — no violations found yet; nothing
  built so far duplicates what Gmail/Salesforce/HubSpot would give away. Worth
  re-checking whenever a "smart inbox" or "AI email assistant" style feature is
  proposed, since that's exactly the terrain Google is moving into.
- **Rule 5 (rising autonomy, not fixed human-in-the-loop)** — already the actual
  architecture: automation tier (OFF/ASSISTED/AUTONOMOUS) is a per-lead column, not
  a global flag, and every automation path already checks it per-lead rather than
  assuming one mode business-wide. No rework needed to raise the autonomy ceiling
  later.
- **Rule 6 (moat vs. table stakes)** — hasn't been applied retroactively before now.
  Rough first pass, to be refined as the vertical decision lands:
  - **Moat-leaning:** the visible-reason AI scoring (a real, defensible bet on
    trust-through-transparency, not just a score); the per-lead autonomy tier
    (structural, not cosmetic); Smart Views + Ponds (workflow-shaped, not feature-shaped
    — cheap for a competitor to clone the *idea* but the shared-pool + saved-filter
    combo is stickier once a team's real filters live in it).
  - **Table-stakes:** multi-channel capture (every competitor has this), Stripe
    billing, rate limiting, TCPA/A2P compliance notices (necessary to be credible,
    not a differentiator), the mobile app shell.
  - **Unclear until the vertical is picked:** almost everything proposed from here
    forward — a vertical-specific feature is moat by definition; the same feature
    built generic is table stakes at best.

## Next real initiative: AI voice agents + real multilingual support

**Update (2026-09-06): the voice AI half is built, Phase 1, shipped opt-in and
off by default.** `src/app/api/twilio/voice/[secret]/route.ts` now branches on
`Business.voiceAgentEnabled` — on, a call gets `<Connect><Stream>`'d to a
separate always-on bridge service (`/voice-agent` at the repo root, its own
Vercel project — Twilio's Media Streams need a persistent connection a Next.js
route can't hold) that relays the caller's audio live to OpenAI's Realtime API
and back, so the caller has an actual spoken conversation instead of leaving a
voicemail — in whatever language they speak, per the multilingual-instruction
fix (see point 2 below, and `buildInstructions()` in
`voice-agent/api/stream.js`). The finished transcript is handed back to
`/api/twilio/voice-agent-callback/[secret]/route.ts`, which owns it the same
way every other channel does (Rule 2) — a real Lead/Conversation/Message, not
data left sitting on a third party. Off is still the original voicemail flow,
unchanged, for every business that hasn't opted in.

What Phase 1 does NOT cover, on file rather than assumed solved:
- Per-state call-recording consent nuance (one spoken disclosure everywhere
  today, not tailored to two-party-consent states).
- A live handoff to a real human mid-call.
- The AI-disclosure line itself is always spoken in English, even though the
  agent then replies in whatever language the caller actually speaks.

The two biggest gaps between what's built today and the mission above, named
plainly rather than assumed solved:

1. ~~No real voice AI exists yet.~~ **Built, Phase 1 — see above.** A missed
   call when the agent is off still gets the original recorded greeting +
   `<Record>` transcription + a text-back, unchanged. Its own TCPA exposure is
   real and only partly resolved — see
   `research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md`
   Part 1 for the inbound-specific compliance findings this build followed
   (disclosure + recording-consent notice before anything connects, keep the
   conversation scoped to what the caller called about).
2. **Nothing has been built or tested for non-English leads.** AI scoring and
   drafting (`src/lib/integrations/openai.ts`) has never been checked against a
   non-English lead; Gmail/Twilio/Instagram capture has never been verified to
   handle non-English content correctly end to end. This isn't a small toggle —
   it needs real verification, not an assumption that "the model probably handles
   it."

Both needed a real research/scoping pass (current voice-AI platform options,
cost, latency, multilingual quality, compliance) before any code got written —
see `research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md`.
Point 2 (non-English testing end to end, not just the model-instruction fix
already shipped) is still open.

## Rule 1, closed (2026-09-06)

**Decision: FollowUp stays horizontal. No vertical.** Considered and declined —
see the resolution above and `research/market/2026-09-06-realtor-tool-landscape.md`
for why the closest candidate (real estate) turned out to be a contested,
AI-native-competitor-crowded space rather than an open gap. Don't re-litigate this
by defaulting back into a vertical pick from a future research pass; if new
evidence changes the calculus, that's a fresh CEO decision, not a reversion.
