# Product direction — build for 20-year survival, not just to ship features

## The main goal (CEO, 2026-09-07 — this wording and ordering are canonical)

**The problem: business owners are not able to follow up.** That is the main thing.
FollowUp exists because the owner can't, won't, or forgets to do the following up.

What FollowUp does about it, in order:

1. **No lead is lost because of no follow-up, late follow-up, or wrong follow-up.**
2. Rescuing cold, dead, or never-reached leads is one feeder into that, not the goal itself.
3. In every language, from every platform.
4. The end state is that no human does this job at all. The owner still closes the deal.

When anything below, or any research note, seems to say otherwise, this list wins.

Set by the CEO (2026-09-06). This is a standing filter, not a one-time memo — every
agent in `.claude/agents/` and every session working on this repo applies it before
adding anything, not just when it's freshly top of mind. `manager-agent.md` and
`product-ux-agent.md` point back here; if you're proposing a feature, a roadmap item, or
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

1. **Depth over breadth — on the job, not an industry.** (Originally "vertical depth";
   resolved 2026-09-06: FollowUp stays horizontal.) Go deeper on the one job — doing
   the follow-up an owner can't — than any generalist CRM will bother to. Features
   that are "a bit of everything for everyone" lose to platforms; features that make
   FollowUp the thing an owner can't run their inbox without don't.

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
  stays explicitly horizontal ("follow-up for anyone" — see `product-ux-agent.md`'s
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

## Follow-up is on by default (CEO decision, 2026-09-06)

New leads start in the **Assisted** tier and every business's "Auto follow-up on
silence" switch starts **on** (5-day window). Reasoning, in the CEO's framing: the
product's job is that the follow-up *gets done* without the owner remembering —
a default of OFF only moved the thing they forget from "write the email" to
"click approve." Rule 3 makes the default safe: the guarantee is stated in the
UI (nothing about pricing, terms, or a tense conversation without approval;
everything stops the instant the lead replies), and the owner can set any lead
to OFF or AUTONOMOUS. Validated the same day by the first outside tester (a
realtor): "amazing if it will be taking follow up from each and every one."

> **Timing corrected 2026-09-25 (founder's follow-up strategy).** "starts **on** (5-day
> window)" above, and "a lead who wrote and got no answer for N hours (default 24)" in the
> 2026-09-07 status below, no longer describe what runs. Now: a new message on any channel
> has its reply drafted and held on Today (or, on an account that sends without asking, a
> low-risk reply sent) within five minutes, at any hour. A quiet lead gets four different
> reminders — day 3, 7, 14 and 30 after our last message, or the owner's own silence setting
> for the first — then nothing until one welcome back at the dead-lead threshold (45 days).
> Reminders go out 8:00–20:00 local, at most one automatic reminder per lead per day. The
> switch still starts on. Detail: `design-brain/decisions/design-decisions.md`,
> "2026-09-25 — The follow-up strategy".

## Rule 1, closed (2026-09-06)

**Decision: FollowUp stays horizontal. No vertical.** Considered and declined —
see the resolution above and `research/market/2026-09-06-realtor-tool-landscape.md`
for why the closest candidate (real estate) turned out to be a contested,
AI-native-competitor-crowded space rather than an open gap. Don't re-litigate this
by defaulting back into a vertical pick from a future research pass; if new
evidence changes the calculus, that's a fresh CEO decision, not a reversion.

## Rule 1 re-confirmed against an outside brief (2026-09-15)

An external strategy brief (repositioning FollowUp as a multilingual AI lead-response
assistant, pasted into a session by the CEO for review) argued the strongest launch is to
narrow to one industry + region. Compared line by line against this document:

- Its core positioning and workflow (capture → qualify → score → book → human handoff, in
  every language) are not new — they're this document's mission, already shipped.
- Its "pick one vertical" advice directly re-argues Rule 1, already closed above with a
  documented reason (Structurely/Ylopo already own that exact pitch in real estate).

**No direction change.** This is a confirming note so the same advice doesn't get
re-litigated from scratch next time it shows up in different packaging — the evidence base
(`research/market/2026-09-06-realtor-tool-landscape.md`) hasn't changed.

Two things from the same brief *were* real, actionable gaps, logged separately rather than
here since they're not direction disputes: the multilingual claim has no defined tested
language set (Point 3 below already flags this), and no primary owner interviews are on
file (desk research only, so far).

## Where we are right now, against the main goal (updated 2026-09-07, end of day)

Measured against the four points at the top of this file, code-verified.

**Point 1 — no lead lost to no / late / wrong follow-up. Closed in code.**
Capture from Gmail (push within seconds once the Google Cloud topic is set up,
ten-minute poll as fallback, daily deep pass), Twilio SMS and voice, live AI
voice agent, WhatsApp, Instagram DM, widget, webhook, CSV, manual. Every new
lead gets an instant, fixed-template acknowledgement on the channel they used,
in their language, once, never over the owner's own reply. The silence check
runs hourly. Drafts can never state a fact absent from the conversation, and a
draft that does is held by the risk gate. 51 automated tests pin these promises
and run on every pull request.

**Point 2 — rescuing cold / dead / never-reached leads (a feeder). Built.**
The human-neglect trigger: a lead who wrote and got no answer for N hours
(default 24) is drafted, sent when safe or held for one-click approval, and the
owner is told either way. The rescue score ranks every open lead by neglect ×
intent × recoverability and the dashboard opens on "About to be lost." The
report "What FollowUp saved you this week" counts only replies to messages
FollowUp sent on its own, the owner is notified the moment a rescued lead
comes back, and a Monday digest emails the same numbers from the owner's own
Gmail. Still missing here: nothing structural; real usage will tune the score.

**Point 3 — every language, every platform. Partly.** Drafts, the instant
reply, voicemail transcription and the live voice agent all work in the lead's
language. Outlook is not built. No real non-English lead has been tested end
to end yet. Meta's free inbound agent on WhatsApp/Instagram (June 2026) means
FollowUp should ingest what it handles rather than compete on the first DM.

**Point 4 — no human does this job; the owner still closes. Architecture
ready, default still Assisted.** Per-lead OFF / ASSISTED / AUTONOMOUS, risk gate
before any autonomous send, audit trail of every action, credentials encrypted
at rest, admin-only settings. The step to "autonomous for low-risk replies by
default" is a product decision, not a build.

**So: Phases A and B of the plan are done. Next is Phase C (languages and
platforms) and the security roadmap's Level 2 remainder; Phase D (autonomy by
default, consent record) after real customers have watched Assisted work.**

## Instagram and Messenger follow-up is DM-only (CEO decision, 2026-09-16)

A lead who writes on Instagram is answered on Instagram. No automatic switch to email or
any other channel, ever. Messenger is treated the same (identical Meta rules; CEO has not
separately ruled on it — assumption, flagged).

Meta's constraint, accepted as the shape of the feature rather than worked around: no
automated DM after 24 hours from the lead's last message; nothing at all after 7 days
unless the lead writes first. Therefore:

- **Inside 24 h:** up to three automatic touches, each ending with an easy question, since
  any reply from the lead reopens the window. Stops on any reply.
- **Days 2–7:** one drafted message, sent by the owner with one tap under Meta's
  human-agent allowance (requires the App Review permission already being requested).
- **After day 7:** stop. Restart only if the lead writes.

Rule 3 (trust ships like a feature): the owner is told what went out, what is waiting on
their tap, and why nothing more will be sent. Rule 6: the day-1 automation is table
stakes; timing a follow-up *into* the window on purpose is the moat-leaning part (window
research §6.2). Build order and the rejected alternative: `design-brain/decisions/`,
entries dated 2026-09-16 (R-003).

## WhatsApp is the owner's own number, through Meta (CEO decision, 2026-09-19)

> "Nobody wants to bring or use a new number that is nowhere exposed for a business …
> Let's build WhatsApp, and then we'll go with all the features that we have right now.
> We'll leave Twilio for phone and SMS."

WhatsApp connects through Meta's Cloud API with **Coexistence**: the owner keeps the number
that is in the WhatsApp Business app on their phone, keeps replying from it, and FollowUp
sees every message and replies from the same number. Twilio's WhatsApp path stays live for
anyone already on it but is no longer offered in Settings. Twilio itself is kept for phone
and SMS, which are postponed (`CARRIER_CHANNELS_AVAILABLE`), because those need either a
new number or a port. Scope and what is still unverified:
`research/integrations/2026-09-19-whatsapp-coexistence.md`.

## Sign-up is invite-only for now (CEO decision, 2026-09-18)

> **How the invite is given (2026-09-19, beta):** the founder adds a Google email on `/admin`
> ("Beta testers"); that email may sign in (`src/lib/auth.ts` checks `AccessRequest.status`),
> alongside the `ALLOWED_EMAILS` env list. There is no public request form — the founder's
> explicit call: "I don't want any unknown users to try my beta app and request access. I
> will personally be adding all the emails." Anyone not on the list is told it is invite-only
> and given contact@followupbase.io.

No public sign-up until the CEO says otherwise. A person gets in because
Sahil added them or an existing business invited them to its team. What "in" means
technically is Dipesh's lane (`src/lib/auth.ts`, the `ALLOWED_EMAILS` gate, and Google's
own OAuth testing-mode user list, which already limits sign-in today); what it means for
the product is that the Free tier exists for invited businesses, not as a public funnel.

> **The 14-day trial stays (CEO decision, 2026-09-28).** An invited business that upgrades to
> a paid plan gets 14 days free before the first charge (`TRIAL_PERIOD_DAYS`,
> `src/lib/billing.ts`). This line used to say "no free trial", which contradicted the code;
> Sahil: "keep the trial". Sign-up is still invite-only: the trial is on upgrading, not a way in.

> **Beta testers get Pro, free (CEO decision, 2026-09-19).** Free's 20-lead cap and its
> email/website-only channel rule would have left a tester's Instagram and WhatsApp leads
> unworked. So a business whose owner is on the tester list is put on the beta plan
> (`subscriptionStatus "beta"`, tier `pro`, no Stripe, nothing billed) at sign-in or when
> added on `/admin`, and taken back to Free when removed. A real subscription is never
> touched. `grantBetaPlan` / `revokeBetaPlan` in `src/lib/billing.ts`.

Three related defaults were confirmed the same day, recorded in
`design-brain/decisions/design-decisions.md` (2026-09-18): "Not now" from a lead ends the
DM sequence (A-007); up to three automatic touches inside Meta's 24-hour window; the Monday
digest goes to every business including Free.

## FollowUp asks Meta for DMs; it does not only wait to be told (CEO decision, 2026-09-19)

> **Do not remove the Instagram poller as redundant.** It is not a backup for a webhook
> that works. It is there because the webhook demonstrably did not.

The first real Instagram account, on the day it was connected: a Business account, listed
under its own `subscribed_apps` with the `messages` field, on a published app, both test
accounts holding app roles, the owner's "Allow access to messages" toggle on — and not one
webhook for a real DM, in either direction, across an afternoon. Meta's own test payload
for that same field arrived and processed fine, and `/api/instagram/diagnose` showed the
message sitting in the account's conversations, readable with the token already held.

So Instagram capture has two paths, as Gmail always has. The webhook stays and is still the
fast one. Alongside it, `/api/cron/instagram-poll` reads each connected account's
conversations **every three minutes** (the CEO's interval: "3 mins is good for now" — the
dial is cost versus how instant it feels, and nothing else depends on the number) and feeds
anything new through the same `processMetaEnvelope` the webhook uses. Whichever arrives
second is dropped on message-id uniqueness.

The bounds matter as much as the mechanism, and each one exists because of a case already
seen: a never-polled account reads fifteen minutes back and never its history, so connecting
an account cannot acknowledge conversations that ended weeks ago; no tick reaches back more
than a day; a thread untouched since the cursor costs no request; and a read Meta refused
leaves the cursor alone rather than skipping a window nobody read. `src/lib/instagramPoll.ts`.

The general rule this sets, for every channel after it: **a push FollowUp cannot make arrive
is not a capture mechanism.** Where a platform will let us ask, we ask.

> **A minute or two before the first reply is the target, not a cost (CEO, 2026-09-19).**
> "We will reply after 1 or 2 mins so that it feels real." A reply that lands the instant a
> DM is sent reads as a machine, which is the one thing FollowUp must never read as. The
> two-minute head start the owner already gets (`DM_ACK_GRACE_PERIOD_MS`) is therefore a
> feature twice over, and shortening it is not an optimisation.

What this ruled out is the delays **stacking**. The acknowledgement's head start used to be
timed from the moment FollowUp noticed a message, which was the same instant it was sent
only while a webhook was the only way one arrived. Polled three minutes late, a lead waited
another two on top — five minutes, which is not a business that looks awake. A DM is now
timed from when the lead wrote it (`eventSentAt` in `src/lib/inbound/meta.ts`), so the head
start is spent by the time a late message is found, and the conversation timeline reads in
the order things were actually said.

## FollowUp's first value moment (CEO decision, 2026-09-26)

One definition, used by every screen, report and study (design brain A-047, from the Amplitude study):

- **First value:** a customer got a reply that FollowUp wrote. That is the first message a rule or a FollowUp draft
  produced that actually went out, whether the owner approved it or it sent by itself. The instant "got your
  message" acknowledgement doesn't count: it's the same line for everyone, not a reply.
- **Activated:** first value within 7 days of first signing in.
- **Proof:** that customer wrote back. Shown when it happens, not needed to count as activated.

In code this is `FIRST_VALUE_SEND` in `src/lib/firstValue.ts`. /admin measures who reaches it from FollowUp's own
records (no analytics SDK), and Today says it to the owner once, on the day it happens.

## First replies are written right after connecting (CEO decision, 2026-09-26)

Asked "When someone connects their email, write the replies for customers who never got an answer right away,
instead of within the hour?", the founder said: **"yes right away."**

Why: the first minutes decide whether a new owner believes the product. The proof screen (design brain,
2026-09-26, "Start · first value") shows a real customer from the last 90 days and the reply FollowUp wrote for
them. That only works if the reply exists when the screen loads.

What this does and doesn't change:
- Right after the first sync, FollowUp drafts replies for the **few most recent unanswered customers**, not for
  every lead in 90 days, so the AI cost per sign-up stays small.
- Every one of those drafts **waits for the owner's OK**. Hold-by-default is unchanged, and nothing is sent to an
  old lead on its own.
- The hourly automation still handles everyone else, as before.

Not built yet. This is the decision; the implementation is a backend change for when the start flow is built.

## The landing page "Try it" stays an example until the beta opens (CEO decision, 2026-09-26)

Asked whether to make the landing page's "Try it" box write a real AI reply to whatever a visitor pastes, the founder
said: **"wait until beta opens."**

Why: while sign-up is invite-only (R-012), a visitor who tries it can't become a customer, so each try is AI
cost with no possible conversion, and an open AI endpoint invites abuse. Until then, the box shows a fixed example
reply, clearly labelled "Example reply". Revisit when the beta opens; it will need per-visitor rate limits.


## Auto follow-up is the centre; only decisions go to the owner (founder, 2026-09-26)

> "I want this product to be more focused on auto because the main thing is that this product will be
> auto-following and handing over the human decision part to the users. Everything else will be done by follow-up."

Direction, recorded as said:
- FollowUp answers, checks in and follows up on its own by default.
- Only decisions go to the owner: a price, a date, a tense moment, or anything the risk gate isn't sure of.
- "Ask me before everything" becomes an owner switch instead of the default.

This reverses the 2026-09-21 hold-by-default for new accounts and points at the mission's end state ("no human does
this job").

**Status: direction only, NOT BUILT** (at the time; see "Built" below). The live product still holds every reply.

**Correction (2026-09-27, while building):** this entry said building it meant "allowing AUTONOMOUS again behind the
existing risk gate". That was wrong. AUTONOMOUS is the per-lead mode that SKIPS the risk check, which is the opposite of
"only decisions go to the owner". Automatic is the account-wide send permission (`holdAllForApproval = false`, stamped
`autoSendAllowedAt`) with every lead on the default ASSISTED tier: the risk check runs on every draft, low-risk ones send,
and the rest wait for the owner. AUTONOMOUS stays behind its own separate permission, unchanged. The
founder decides when (design-brain A-052: no live changes until the canvas is finalized). The landing page drawn for
this (canvas v53) must not ship before the product does this.

### Day one: the owner chooses Automatic or Assisted in onboarding (founder, 2026-09-26)

> "For the first day, the follow-up will be doing its job. It will be fetching all the leads and doing the basics.
> Mainly in onboarding, it will be asking the user whether they want the follow-up to follow up automatically or
> they want the assisted ones… Suppose they have many leads, and they will not be able to handle each and every
> single message, right? The follow-up will be doing that job… For the first time, it will be asking permission and
> stuff, and then whatever the user will say, it will be doing that."

What this means:
- **From the first sync, FollowUp fetches every lead and does the basics** (finds who is waiting, scores, writes
  replies).
- **Onboarding asks one explicit question: Automatic or Assisted.**
  - Automatic: FollowUp sends and follows up on its own. Decisions (price, date, tense, unsure) still come to the
    owner.
  - Assisted: every reply waits for the owner's OK.
- FollowUp then does exactly what the owner chose. The owner can change it later (the "Ask me before everything"
  switch).
- **Why:** an owner with many leads can't answer every message by hand. Automatic is what makes FollowUp worth having.
- **Assumed, not yet confirmed:** Automatic is the recommended choice on that screen.
- **Replaces:** hold-by-default (2026-09-21). The owner's own answer in onboarding now sets the default, instead of
  every account starting held.

Status: NOT BUILT. It needs:
- an onboarding step;
- the chosen tier stored per business;
- AUTONOMOUS allowed again behind the risk gate.

### Old customers wait for one tap; new ones go automatically (founder, 2026-09-26)

Asked whether, on Automatic, FollowUp should also message old customers (from the last 90 days, never answered) on
its own, the founder said: **"yes new ones automatic, old ones ask with one tap"**.

- **New customers** (who write after connecting) are handled automatically when the owner chose Automatic.
- **Old customers** found in the first sync are never messaged on their own. The owner sees one short list, e.g.
  "12 people never got a reply", with the replies already written, and sends them all with one tap. The owner can
  also open and skip any of them.
- **Why:** a message out of the blue to someone who wrote months ago is where an automatic tool looks like spam
  (trust outranks speed).
- It fits the 2026-09-26 "first replies written right after connecting" decision. Those drafts are exactly this list.

Status: NOT BUILT.

### A "we got you" message when a decision waits 30 minutes (founder, 2026-09-26)

Asked what should happen when a price or date question has come to the owner and the owner hasn't answered in 30
minutes, the founder chose **option 2**: FollowUp sends a short holding message.

- Example: "Thanks Sarah! Let me check and I'll send you the price soon."
- **When:** only if the owner hasn't answered the decision 30 minutes after it came in. If the owner answers first,
  nothing extra is sent.
- **Once per decision**, never repeated.
- It goes in the customer's language, from the owner's own address, in the business's voice.
- **It promises nothing:** no number, no day, no time. The decision still waits for the owner, with the real reply
  already written.
- **Price and date decisions only.** A tense moment (a complaint, an angry customer) gets no automatic message. It goes
  to the owner only. (My recommendation, stated with the options and not objected to. Confirm when building.)
- **Applies on Automatic and on Assisted** (founder, 2026-10-01: "fix all" — yes to sending it on holding accounts
  too). It is the one message that goes out on an Assisted account without the owner's OK, and Settings, setup and
  Today say so in the same breath as the promise. Never on a thread FollowUp only inherited from the inbox import.
  Supersedes the 2026-09-26 assumption that it was Automatic-only.

Status: BUILT (`src/lib/holdingMessage.ts`; Assisted since 2026-10-01).

### A customer is named by how they sign, not by the account they wrote from (founder, 2026-10-01)

A lead took the sender's account name. When a couple shares an address, or someone writes from a partner's
account, the card showed the wrong person and the reply greeted them by it (the founder's demo: "Priya" wrote
from his inbox and became "Sahil"). Founder: "do it". Now, when the message ends with a clear closing and a
name-shaped sign-off ("Thanks, Priya"), that name is used; when the account name already carries the signed first
name ("Priya Sharma" signing "Priya"), the fuller account name stays; anything unclear leaves the account name
as before. Applies to Gmail and Outlook on the first message of a thread (`signOffName` in
`src/lib/sharedSenders.ts`).

Status: BUILT.

### Booking hours are the business's own (founder, 2026-10-01)

The booking link offered a fixed Mon–Fri 9–5 in New York time, for everyone. Founder: per-business days, hours and
time zone in Settings, default Mon–Sat 9am–7pm for everyone, existing accounts included (A-078). The time zone also
governs the 8am–8pm sending window.

Status: BUILT (`src/lib/bookingHours.ts`, `src/lib/booking.ts`, Settings → Email → the booking card).

### Default check-ins: days 3, 7, 14 and 30, then stop (founder, 2026-09-26)

Asked how many times FollowUp should check in on a customer who went quiet, the founder said: **"keep it, owner can
change it"**.

- **The default plan** is the existing recommended cadence (`RECOMMENDED_CADENCE`, workflows page): check-ins on
  day 3, day 7, day 14 and day 30, then it stops.
- It stops at once if the customer writes back (the stop-on-reply guarantee).
- On Automatic, this plan runs on its own for every new customer. Today it is a template the owner has to pick.
- The owner can change the days, the number of check-ins, or turn it off.

Status: NOT BUILT as a default. The template exists; making it the automatic default is part of the Automatic
build.

### Who it's for: anyone with more leads than follow-up (founder, 2026-09-26)

> "Any small businesses, or even big ones, can create teams, right? Any small businesses with teams, solo
> entrepreneurs, or realtors and consultants who are getting a lot of leads but are lacking in following up. This
> product is mainly for them."

- **The customer is defined by the problem, not the industry.** They get a lot of leads and fall behind on following
  up.
- This covers:
  - solo owners;
  - small businesses with teams;
  - realtors and consultants;
  - bigger businesses using teams.
- **Teams are first-class** (Pro: shared customers, who's behind), not an add-on.
- **Design consequence:** the page's examples should be mixed (a home service, a realtor, a consultant), so no reader
  thinks "this is for plumbers only".

## The auto follow-up direction, complete (2026-09-26)

The five answers above settle the direction:
1. **Onboarding asks Automatic or Assisted.** FollowUp does what the owner chose.
2. **Old customers** get one list, sent with one tap. **New customers** are handled automatically.
3. **A price or date waiting 30 minutes** gets a holding message that promises nothing. Tense moments get nothing
   automatic.
4. **Check-ins:** days 3, 7, 14 and 30, then stop. It stops at once on a reply. The owner can change the plan.
5. **Who it's for:** anyone with more leads than follow-up, solo or team.

### Built (2026-09-27, one PR on the designated branch)
- **Onboarding** asks "How should FollowUp work?": Automatic (recommended) or Assisted. Automatic grants the send
  permission; Assisted keeps the hold. Changeable in Settings, which now names the same two modes.
- **Old customers:** the last onboarding screen writes their replies straight away and offers "Send all N" (the
  existing routine pile, `/api/approvals/send-safe`). Anything about a price or a date is never in that batch.
- **The 30-minute "we got you" message:** `src/lib/holdingMessage.ts`, cron every 5 minutes. The risk check now names
  the decision (price, date, tense, other), and only price and date get one.
- **Check-ins 3/7/14/30:** already the engine default (`QUIET_REMINDER_DEFAULT_DAYS`). No change needed.
- **Existing accounts are not changed.** Every account that exists today keeps holding until its owner chooses
  Automatic in Settings.

## The goal, restated: close more deals; the owner keeps the end (founder, 2026-10-09)

> "Our goal is to make this product so good that it does not just act like a chat box or something that automatically
> drafts anything. We'll be targeting this product to help the users close more deals by following up, keeping the
> lead warm, and qualifying them accurately. It saves the user's time, plus whatever he forgets, it just keeps
> nurturing them so that it keeps them warm, and then helps users book a meeting or close the deals. Maybe most of the
> business wants them to handle the end part, the sales and the pricing negotiation parts, to be done by the business
> owner. That part, we should not be getting more into it, but let's just keep training so that we are more accurate
> with our replies and what we are saying."

What this adds to the direction above (it confirms "only decisions go to the owner"):
- **The measure is deals closed, not messages drafted.** FollowUp follows up, keeps the lead warm, qualifies it
  accurately, and gets it to a booked meeting.
- **The end of the sale is the owner's.** Sales conversations and price negotiation stay with the owner; FollowUp does
  not go deeper there (the demo and the drafts pass negotiation to the owner).
- **Accuracy keeps improving** through what the owner teaches (facts from sent replies, edits) and weekly product work.
  This is not training an AI model on customer data (see `src/app/security/page.tsx`).

## Timing, qualification and closing, as the website now promises them (founder, 2026-10-09)

Said on the home-page draft (artifact comments), in his words:

> "'Reply in a minute' is not what we are aiming for. If we reply in a minute, it will sound like AI. We'll be telling
> them that we'll be using strategies so that we'll be using proper time gaps and the strategies according to the
> customers… We'll be doing that for real too."

> "We're trying to use a proper strategy to qualify the leads. We will get as much information as we can ourselves
> before handing it to the user to close the deal… the whole qualification will be handled by FollowUp only… end it
> like we just booked it, and then… 'Moved: the lead is closed, confirmed by the user.'"

> "You don't have to teach it; it will teach itself and reply as you want, in your own tone or language, or in the
> professionalism that they use."

What this adds:
- **Reply timing is a strategy, not a speed.** It extends the 2026-09-19 rule ("1 or 2 mins so that it feels real"):
  the gap is chosen per customer and situation, never instant, always within the window where they're still looking.
- **FollowUp qualifies before it hands over.** It asks the questions a good assistant would (what they need, when,
  budget, readiness) and hands the owner a qualified lead.
- **The end is the owner's.** FollowUp books; the owner closes and confirms it ("Moved: closed, confirmed by you"),
  matching the 2026-10-09 goal above.
- **It learns tone, language and formality by itself.** There is no setup to teach it.

What is built and what isn't is tracked in `research/product/website-promises-to-build.md`. The founder asked that
anything the site promises which the app doesn't do yet goes on that list.

## The funnel: from first message to booked (founder, 2026-10-09)

> "We have to make the qualification process so accurate… I don't think the owner will be able to reply to every
> single one… We'll be creating the funnel to qualify the leads that the business owner wants… That's why it is going
> to save time for the user."

1. Leads come in.
2. We catch the correct lead: is it even a lead or not?
3. We reply from the owner's perspective, voice and tone, to qualify the lead.
4. The qualification process starts; FollowUp handles it.
5. We qualify accurately; if they don't reply, we follow up again and again.
6. We hand the hot lead to the owner to close the deal.
7. We get the lead to the endpoint: a booked call, meeting or visit.

> "That's the main job… We can't make any mistakes in qualifying the leads."

Research and the proposed build: `research/product/2026-10-09-lead-qualification-strategy.md`.

