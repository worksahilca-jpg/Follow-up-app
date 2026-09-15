# What makes an owner trust an AI to message their customers — and what makes them switch it off

**Date:** 2026-09-15
**Question:** What earns a non-technical small-business owner's permission for software to send
messages to their customers in their name, and what revokes it permanently?
**Scope:** (1) how comparable products earn that permission, (2) the undo/regret path, (3) disclosure
— legal and commercial, (4) the first-run moment. Ends with a ranked change list.

## Method and honesty

- **`WebFetch` is egress-blocked in this sandbox.** Confirmed twice today, not assumed: a direct
  `curl` to `intercom.com` returned `CONNECT tunnel failed, response 403`, and the `WebFetch` tool
  returned `EGRESS_BLOCKED` for `www.intercom.com`. **I did not read any external page in full.**
  Everything external below is a search-result snippet.
- **Every claim is graded.** `OBSERVED` = I read it myself (in this case: only this repo's code and
  docs). `REPORTED` = a source outside the repo says so, via snippet. `INFERRED` = my reasoning,
  marked as mine.
- `REPORTED` claims carry a source-quality letter, same scale as
  `research/product/2026-09-10-instant-ack-safety-gate.md`: **A** primary doc read in full (none here
  — see above), **B** official vendor/government doc text via snippet, consistent across sources,
  **C** vendor marketing / third-party review / practitioner blog via snippet, **D** single thin or
  unclear source.
- **I am not a lawyer.** Section 3 is a list of statute names and what to ask a lawyer, not advice.
- Where evidence is thin I say so rather than padding. The strongest material in this document is
  section 4 and the code reads — those are `OBSERVED`.

## What I read first, so this extends rather than repeats

`PRODUCT_DIRECTION.md`; `research/customers/2026-09-05-icp-pain-and-trust-objections.md` (the 77%
human-approval stat, the 65.5% "my business will feel fake" stat, TCPA exposure);
`research/customers/2026-09-15-owner-interview-guide.md` (no owner interviews exist yet — this
document is desk research plus a code audit, same limitation);
`research/product/2026-09-10-instant-ack-safety-gate.md` (the comparable-vendor guardrail survey —
Conversica, AiSDR, Structurely, HighLevel, Podium, Birdeye, Intercom Fin, Drift — and the
Moffatt v. Air Canada liability point; I do not repeat those vendor rows, I extend them with the
*rollout and recovery* dimension they didn't cover);
`design-brain/research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`;
`design-brain/brand/brand-principles.md`.

**Rule check up front (`PRODUCT_DIRECTION.md`):** everything recommended here serves **Rule 3**
(trust ships like a feature — an explicit, user-visible guarantee plus a test) and **Rule 5** (design
for rising autonomy — a trust *ladder* is the mechanism that raises the autonomy ceiling without a
rewrite). Nothing here is Rule 4 terrain: Google/Salesforce give away send-scheduling and undo-send
inside their own clients, not a cross-channel permission ladder for a third party sending as you.

---

## 1. How products that act on your behalf earn the permission

Six mechanisms recur. They are not alternatives — the products that get this right stack most of
them, in roughly this order.

### 1.1 The agent runs where it is harmless before it runs where it isn't

Intercom Fin has **previews** that don't require Fin to be set live and incur no charge, an internal
**testers audience** you preview as, and explicit guidance to roll out in stages by customer segment
(e.g. lower-tier customers, or by region) so you can "supervise Fin closely"; deployment carries a
**rollout percentage** that must be above 0% for a time period before anything happens.
`REPORTED (B — Intercom help-centre article titles and snippet text, consistent across several of
their own articles, checked 2026-09-15)`

Salesforce ships a **Testing Center** — a low-code framework to simulate and evaluate agent behaviour
*before* deployment, plus sandboxes for the Einstein Trust Layer and an audit trail that logs agent
actions and outputs. `REPORTED (C — CIO article and Salesforce Trailhead module titles/snippets,
2026-09-15)`

The practitioner version of this is **shadow mode**: the agent processes real production inputs,
generates outputs and logs decisions, but writes are stubbed to log-only and humans remain the
decision-maker; then a canary at 5% → 10% → 25% → 100%. `REPORTED (C/D — developer blogs
(dev.to, brightlume.ai), not a vendor doc; treat the specific percentages as illustrative, not
standard)`

**The pattern, not the screenshots:** the first autonomous action happens somewhere the user can
watch it without consequences. "Somewhere harmless" can mean a fake recipient, an internal recipient,
a small segment, or a small percentage.

### 1.2 Suggest first, send later — and the graduation is explicit

HighLevel's Conversation AI has Suggestive mode (drafts for a human to send) and Autopilot (sends
with no review). A third-party setup guide states plainly that a common failure is switching to Auto
**before reviewing at least 50 conversations in Suggestive mode**, because the AI doesn't know the
business well enough yet. `REPORTED (C — getautomized.com / autogencrm.com guides via snippet,
2026-09-15; the "50" is one practitioner's number, not a vendor-published threshold — do not quote it
as a standard)`

Zendesk's recommended path is the same shape: start in draft mode and run the agent as a suggestion
engine for humans for the **first two to four weeks**, fixing wrong drafts in the knowledge base
rather than in the prompt. `REPORTED (C — eesel.ai guide via snippet, 2026-09-15 — a competitor's
guide to Zendesk, not Zendesk's own doc)`

Regie.ai sells both Auto-Pilot ("zero human intervention required") and an **approval-gate model**,
explicitly positioned for "leadership that won't let an autonomous agent send unsupervised email
under your domain." `REPORTED (C — regie.ai marketing pages plus a third-party review, 2026-09-15)`

**The pattern:** autonomy is a *state the user graduates into*, and the vendor names the evidence
that justifies graduating. Nobody credible ships "trust me" as the first screen.

### 1.3 Some products refuse to send at all, and make that the pitch

Fyxer AI drafts replies in your voice and **never sends** — drafts land in your drafts folder, you
press send; the drafts improve as you review and send them. `REPORTED (C — fyxer.com product/help
pages and third-party reviews via snippet, 2026-09-15)` One commentary piece frames the stakes in a
line worth internalising: a draft that is 90% right but sounds nothing like you is "worse than
useless," and you "stop trusting the tool after two bad drafts." `REPORTED (D — a single personal
blog (kenashe.ai), dated 2026-09-14; it is one person's framing, not research — but it names the
failure mode this task is about)`

**The pattern, and the tension for FollowUp:** draft-only is the highest-trust posture and also the
posture FollowUp's own mission rejects (`PRODUCT_DIRECTION.md`: "a default of OFF only moved the
thing they forget from 'write the email' to 'click approve'"). That tension is real and shouldn't be
resolved by pretending Fyxer's approach is timid. It's a legitimate competing bet. FollowUp's answer
has to be that the *first touch is fact-free by construction* (which is already true and already
tested — see `checkAckShape` in `src/lib/acknowledge.ts`), not that owners don't mind.

### 1.4 The safety net is structural, not semantic

Already established in `2026-09-10-instant-ack-safety-gate.md` §2 (turn caps, sleep timers, pause on
human reply, exception-based approval). One thing to add from this pass: HighLevel's own public idea
board carries a customer request titled **"Have Ai bot turn off permanently on a contact when staff
replies."** `REPORTED (B — the request exists on ideas.gohighlevel.com; I saw the title and URL, not
the vote count or body, 2026-09-15)` Users also report the bot treating a returning customer as a
brand-new lead days later, which "looks unprofessional." `REPORTED (C — third-party review guides via
snippet)`

**This is direct evidence that FollowUp's stop-on-reply guarantee is a real differentiator**, not a
hygiene feature: a category leader's customers are *asking for it by name*. Worth using in copy —
carefully, as "what customers of other tools ask for," never as a named-competitor attack.

### 1.5 The approval gate degrades if it's the only mechanism

The counterweight to "just make them approve everything": approval gates decay into rubber stamps.
Automation bias is described as the single biggest threat to human-in-the-loop, with a "recognition
bottleneck" — reviewers see the action, rationalise it, and normalise the agent's framing. An
adjacent finding: reviewers given **clear explanations deferred more heavily** to the AI, because
explaining does the cognitive work for them. The EU AI Act's Article 14 names over-reliance on AI
output explicitly for high-risk systems. `REPORTED (C — practitioner essays (tianpan.co,
dev.to, Medium) summarising studies I could not read; the Article 14 reference is checkable and
consistent with the statute's known text, the intervention-success percentages are not verifiable
from a snippet and I am not quoting them as fact, 2026-09-15)`

**Why this matters here, and it cuts against a comfortable assumption:** FollowUp's design brain
already says the approve-a-draft screen is the most important surface in the product. That's right,
but "more approvals" is not automatically more trust — a queue the owner clears in eight seconds on a
phone between jobs is a rubber stamp with extra steps, and it transfers blame to them without
transferring understanding. `INFERRED.` The mechanisms that survive a distracted user are the
structural ones (what it will never say, what stops it, what it does after the fact), not the
attentional one.

### 1.6 The ask is timed and explained, not front-loaded

From the mobile-permissions literature, which is the closest well-studied analogue to "may I act as
you": opt-in rates reportedly swing from under 30% to over 70% based on *when* the prompt fires;
prompting immediately on app open produces the lowest rates, often below 15%; explaining the specific
reason before asking substantially raises grant rates. `REPORTED (C — several mobile-marketing vendor
blogs (mobiloud, batch.com, pushwoosh) converging on the same direction; the specific percentages come
from vendor case data and one blog's citation of a Pew figure I could not verify — use the direction,
never the numbers, 2026-09-15)`

**The pattern:** a pre-permission screen that says what will happen, in the user's terms, immediately
before the irreversible step.

---

## 2. The undo/regret path

### 2.1 What exists in the world

- **Gmail's Undo Send is a delayed-send buffer, not a recall** — 5 seconds by default, configurable
  to 10/20/30. `REPORTED (B — Google's own blog post plus several consistent guides, 2026-09-15)`
  Thirty seconds is the *maximum a mail provider will give a human*, which is a useful calibration
  point for how much buffer is tolerable before it stops being "instant."
- **For an already-delivered message, nobody has an undo.** The practitioner consensus is
  containment, not reversal: pause the agent, reduce its permissions, route output to human approval,
  then investigate; "sending an email is not meaningfully reversible," so the plan for irreversible
  actions is prevention plus compensation. `REPORTED (C — dev.to / codebridge.tech / cohesivity.ai
  practitioner posts via snippet, 2026-09-15)`
- **Recovery is a named owner and a scoped blast radius**: who can stop it, who owns the repair, and
  identifying which customers received what and whether any acted on it. `REPORTED (C — same set)`

**Nobody does this well.** That is the honest finding. The entire category's answer to "the AI said
something I hate" is a kill switch plus a log. The differentiated move is not inventing undo — it's
making the *thirty seconds before* and the *sixty seconds after* better than anyone else's.

### 2.2 What FollowUp actually does today — code read, `OBSERVED`

| Question | Answer in code |
|---|---|
| Is there a cancellation buffer before an automated send? | **No.** `src/lib/automation.ts` sends inline the moment a lead is eligible and in the send window. `src/lib/sendWindow.ts` only defers out-of-hours sends to the next 8am–6pm local hour; in-window, there is zero delay. |
| Does Gmail's own Undo Send cover it? | **No.** Sends go out through the Gmail API (`src/lib/integrations/gmail.ts`), and Undo Send is a Gmail-client delayed-send feature. `INFERRED — high confidence, but verify before putting it in customer-facing copy.` |
| Is the owner told after an autonomous send? | **Only sometimes.** `src/lib/automation.ts:~465` calls `notifyNeglect` **only when the trigger is `unanswered`**. A **silence**-triggered send and a **dead-lead reactivation** send create no `Notification` at all. The owner finds out by opening `/activity` or the lead. |
| Can the owner see what went out? | **Yes.** `src/lib/activity.ts` builds a chronological feed including the actual sent message body, and `src/components/LeadTrustPanel.tsx` renders a per-lead "What FollowUp did here" log off permanent `AuditEvent` rows. This is genuinely good and better than what most comparables document. |
| Can the owner stop it fast? | **Per lead**, via `LeadAutomationToggle` on the lead page ("I'll do it myself"). **Business-wide**, via a master toggle in Settings that sits behind navigating to Settings and scrolling. There is no stop control on the notification, the activity feed, or the dashboard. |
| Can the owner correct it? | **No dedicated path.** They can open the lead and write a message like any other. There is no "that was wrong — send a correction" affordance, and nothing captures *why* it was wrong. |

**The regret path today is: find out by accident → navigate to the lead → change a three-way toggle
→ and if it keeps happening, find Settings and kill everything.** The last step is the one that ends
the customer relationship, and it's the only one the product makes easy at the business level.
`OBSERVED + INFERRED (the consequence is my inference).`

One real mitigation already in place, worth not underselling: the instant acknowledgement is
structurally incapable of stating a fact about the business — `checkAckShape` rejects any digit,
currency symbol, URL, phone, email or clock time not present in the lead's own message, for **every**
tier including AUTONOMOUS, before any model judge runs (`src/lib/acknowledge.ts`). The message class
most likely to be sent unreviewed is also the class least able to say something regrettable.
`OBSERVED.`

---

## 3. Disclosure

### 3.1 What FollowUp discloses today — `OBSERVED`

- **Voice: yes.** `src/app/api/twilio/voice/[secret]/route.ts:153` speaks
  `"You're speaking with an AI assistant for {business}. This call may be recorded."` before
  connecting. (`PRODUCT_DIRECTION.md` already flags that this line is always English even when the
  agent then replies in another language.)
- **Email, SMS, WhatsApp, Instagram, Messenger: no.** An automated email is
  `greeting + body + sign-off` with the owner's first name (`composeFollowUpEmail` in
  `src/lib/sender.ts`) — no AI notice, no business identification block, no unsubscribe link.
  Outbound SMS (`sendSms` in `src/lib/twilio.ts`) appends nothing; inbound `STOP` **is** honoured
  (`STOP_KEYWORDS`, `optedOutAt`, surfaced in `LeadTrustPanel`), but no message carries opt-out
  instructions.

So FollowUp's disclosure posture is currently **channel-inconsistent by accident, not by decision**.
That's the thing to fix first — inconsistency is harder to defend than either position.

### 3.2 What to ask a lawyer about — statute names, not advice

All of the following are `REPORTED` from secondary sources via snippet; none of the statutory text
was read directly.

- **CASL (Canada, S.C. 2010, c. 23).** Three requirements for a commercial electronic message:
  consent, identification information (your name, on whose behalf, physical mailing address, and a
  phone/email/URL), and an unsubscribe mechanism honoured within 10 business days and valid for 60
  days. Administrative monetary penalties up to **$1M per violation (individual) / $10M
  (organisation)**. `REPORTED (B — CRTC FAQ/guidance pages and a Gowling WLG guide, consistent,
  2026-09-15)` **Ask a lawyer:** does a reply to an inbound inquiry fall inside CASL's
  response-to-request exemption or the implied-consent-from-inquiry window, and does the identification
  requirement apply to that reply? This matters most for FollowUp because Canada is the home market
  and because the identification block is the one thing genuinely absent from every outbound email.
- **CAN-SPAM (US, 15 U.S.C. §7701 et seq.).** Opt-out model, not opt-in; requires a clear opt-out
  mechanism honoured within ten business days; civil penalties reported at **up to $53,088 per
  violating email**; more than one party can be liable for the same message. `REPORTED (B for the
  framework — FTC compliance guide is among the results; C for the dollar figure, which comes from a
  vendor blog citing the 2025 inflation adjustment, 2026-09-15)` **Ask a lawyer:** is a one-to-one
  reply to an inbound lead a "commercial electronic mail message" whose primary purpose triggers
  these duties, or a transactional/relationship message?
- **TCPA (US, 47 U.S.C. §227) for SMS and voice.** The FCC confirmed in February 2024 that TCPA
  restrictions on "artificial or prerecorded voice" cover AI-generated voices. Statutory damages are
  consistently reported at **$500–$1,500 per call/message**. A **Fifth Circuit decision,
  *Bradford v. Sovereign Pest Control of Texas*, 25 February 2026**, is reported to hold that the
  statute requires only prior express consent, not prior express *written* consent, for
  artificial-voice calls — binding in that circuit only. `REPORTED (B for the 2024 FCC ruling, which
  appears as an fcc.gov result; C for the 2026 case, which comes from vendor compliance blogs — if
  this case matters to a decision, have a lawyer read the opinion, not a blog, 2026-09-15)`
  **Ask a lawyer:** does FollowUp's live AI voice agent *answering an inbound call* implicate the
  artificial-voice rules at all (they're framed around calls made), and what does the two-party-consent
  recording gap already on file in `PRODUCT_DIRECTION.md` require per state?
- **EU AI Act Article 50 — now in force.** Transparency obligations became applicable **2 August
  2026** (i.e. six weeks ago). Providers must ensure people are informed they are interacting with an
  AI system, unless it is obvious to a reasonably well-informed, observant and circumspect person;
  the obligation attaches to the *function* (conversational, generative), not to a risk tier. A
  limited grace period to 2 December 2026 applies only to marking/detection of AI-generated content
  for systems on the market before August. `REPORTED (B — artificialintelligenceact.eu and the
  European Commission's own digital-strategy FAQ appear in results and agree, 2026-09-15)`
  **Ask a lawyer:** whether FollowUp is a "provider" and the business a "deployer," and whether any
  EU-resident lead is in scope today.
- **US state chatbot-disclosure laws — a live 2025-26 wave, broader than the California B.O.T. Act
  already on file.** Five states enacted chatbot-specific laws in 2025: California SB 243 (effective
  1 Jan 2026, includes a **private right of action** — greater of actual damages or **$1,000 per
  violation** plus fees), New York S-3008C, New Hampshire HB 143, **Utah HB 452** (the AI Policy Act,
  as amended, requires disclosure whenever a user *asks* whether they're talking to AI, and in
  high-risk health/financial/biometric interactions), and **Maine LD 1727** (effective 24 Sept 2025 —
  notify users they are not interacting with a human where a reasonable consumer couldn't tell).
  `REPORTED (C — multistate.ai, Orrick, FPF and Troutman summaries via snippet; several of these are
  aimed at "companion chatbots" specifically and may not reach a business's lead-reply agent at all,
  which is precisely the question for a lawyer, 2026-09-15)`

### 3.3 The commercial cost of disclosing

There is real evidence that disclosure costs you something. Schilke & Reimann, *"The transparency
dilemma: How AI disclosure erodes trust,"* **Organizational Behavior and Human Decision Processes**
(2025) — thirteen experiments, across tasks from communication to analytics to creative work, and
across actor types; **actors who disclose AI usage are trusted less than those who do not**, mediated
by reduced perceptions of legitimacy. `REPORTED (B — the paper exists at a real journal with an
author-hosted PDF and multiple independent indexes (SSRN, NSF PAGES, ScienceDirect); I read the
abstract-level summary in snippets, not the paper. A 2026 follow-up by the same authors on
legitimacy exists in Social Psychology Quarterly.)`

This sits directly against the repo's existing finding that **65.5% of owners fear AI makes their
business feel less authentic** and **79% of customers would prefer a human**
(`2026-09-05-icp-pain-and-trust-objections.md`, itself snippet-sourced).

**How I'd read the two together, marked as mine.** `INFERRED.` These are not in conflict; they're the
same fact from two sides. Disclosure lowers trust in the *sender*, which is exactly why the owner is
afraid of it — the owner's fear is *well-founded*, not irrational, and telling them "customers
appreciate transparency" would be selling them something the best available evidence contradicts. The
resolution is not to hide the machine and not to stamp "🤖 AI-generated" on a reply. It is:

1. **Make the disclosure true and minimal where law requires it**, channel by channel, after legal
   review — and make the *owner*, not FollowUp, the one who decides the wording, since they carry the
   liability (the Moffatt v. Air Canada point already on file: the business is bound by what its bot
   says).
2. **Never make the message performatively robotic.** The first touch defers every fact by
   construction; a lead who receives "I've got your message about pricing for next week — I'll come
   back to you shortly" and then hears from a human has been treated well, disclosed or not.
3. **Own the difference between disclosure to the recipient and disclosure to the owner.** The second
   one is unambiguously good and is where FollowUp should be maximal: the owner should never be
   surprised by a message sent in their name. Section 4 is about that.

---

## 4. The first-run moment — the gap, verified

### 4.1 What actually happens to a brand-new business, in order — all `OBSERVED`

1. **First sign-in.** `src/lib/auth.ts:119` creates the business with three automations already
   `enabled: true`: *Auto follow-up on silence* (5 days), *Instant reply to new leads*, *Reply for me
   when I haven't* (24h). No screen has been shown yet.
2. **Onboarding step 1** (`src/components/OnboardingForm.tsx`): business name, industry, team size.
   Nothing about messaging.
3. **Onboarding step 2 — the consent moment.** The only description of the product before the OAuth
   click is: *"This is the whole point — FollowUp reads your sales conversations and tells you who
   needs a follow-up today. Without it, the dashboard stays empty."* **That sentence describes a
   read-only product.** The owner grants Gmail access, including send scope, on the strength of
   "reads" and "tells you."
4. **Immediately after connect**, an effect fires `POST /api/integrations/gmail/sync`, which pulls up
   to 100 threads from the **last 180 days** (`q: ...newer_than:180d`, `maxResults: 100` in
   `src/lib/integrations/gmail.ts:764`). Each imported lead gets `lastContacted` set to the **real**
   date of the last message in that thread, and `automationTier` defaults to `ASSISTED`
   (`prisma/schema.prisma:250`).
5. The screen says *"Pulling in your first leads… Found N leads."* Still nothing about sending.
6. **Dashboard.** The empty state does say the true thing: *"FollowUp is watching your inbox. The
   moment a lead writes, it replies within a minute and shows you here."* — but it is inside
   `{leads.length === 0 ? … }` in `src/app/(app)/dashboard/page.tsx:94`. **An owner whose Gmail sync
   found leads — the successful case — never sees that sentence.** The better the import worked, the
   less the owner is told.
7. **Within the hour**, the cron-driven `runAutomationForBusiness` runs. Two things to note:
   - The dead-lead reactivation rule defaults to **enabled when its row is absent**
     (`const deadLeadEnabled = deadLeadRule?.enabled ?? true` in `src/lib/automation.ts`), and
     `auth.ts` never creates that row. Threshold: 45 days. So **every imported thread between 45 and
     180 days old, not marked WON/LOST, is immediately eligible for a "reactivation" message** written
     with the dead-lead hint ("it's been about a month since we last talked about…").
   - Under ASSISTED these drafts pass `assessSendRisk` first, and anything touching price/terms/tension
     is held. But a draft the model rates **low risk is sent, with no human ever seeing it, and —
     because the trigger is `dead_lead_reactivation`, not `unanswered` — no notification is created
     either.**
   (Gated by `requireActiveBilling`, so this needs an active trial or subscription; a 14-day free
   trial satisfies it.)

**So the realistic worst first day is:** an owner clicks a button that says FollowUp *reads* their
inbox, and within an hour FollowUp sends messages in their name to people they emailed four months
ago, and doesn't tell them it did. That is the exact scenario in the task description that "kills the
company," and it is reachable today by a user doing nothing wrong. `OBSERVED for every step; the
composite scenario is INFERRED but each link is code-verified.`

### 4.2 What the first-run moment should say and show

Two changes, and they're different kinds of change.

**(a) Before the OAuth click — a presentation change, safe.** The consent screen has to describe what
is actually being consented to. Proposed copy for `OnboardingForm.tsx` step 2, replacing the current
paragraph:

> **Connect Gmail**
> FollowUp watches for new leads in your inbox and answers them for you — within a minute, in your
> name, in whatever language they wrote in.
> It never states a price, a date or anything about your business it wasn't told. It stops the moment
> the lead replies. You can read everything it sent, and switch it off for any lead or all of them.

Three sentences, three facts, no jargon, no AI vocabulary — passes brand principle 3's test (remove
every AI-referencing word and it still reads). It is not a wall of terms; it is the smallest honest
version. `INFERRED from section 1.6's "explain immediately before the irreversible step" pattern.`

**(b) After connect, before anything sends — a behaviour change, needs the founder's call.** The
strongest single idea in section 1 is that the first autonomous action should happen somewhere the
owner can watch it. FollowUp already has the component for this: **"Send a test lead to myself"**
(`src/components/TestLeadButton.tsx` → `POST /api/leads/test-lead`), which runs the *real* instant-ack
path against the owner's own address. Today it's buried in a dashboard empty state that successful
imports never render.

The proposal: make that the **third onboarding step**, not a fallback — the owner sees the actual
message FollowUp will send, arriving in their own inbox, signed with their own name, before a single
real lead is touched. It is Intercom's preview and Salesforce's Testing Center, at solo-owner scale,
built from parts that already exist. That step also becomes the natural place to state the one
sentence that should govern the first week (see the ranked list, item 2).

---

## What I'd change in FollowUp, ranked

Each item: the file or screen, and **presentation** (safe to do — copy/visibility only) vs.
**behaviour** (changes what the product does; founder decision per `PRODUCT_DIRECTION.md`).

**1. Don't reactivate a business's back catalogue in its first hours.** — **BEHAVIOUR**
`src/lib/automation.ts` (`deadLeadEnabled = deadLeadRule?.enabled ?? true`) and `src/lib/auth.ts:119`.
Two independent defaults combine into the worst possible first impression: absence-means-on for
dead-lead reactivation, plus a 180-day Gmail import. Options, cheapest first: (i) create the
`dead_lead_reactivation` row explicitly at signup with `enabled: false` so absence stops meaning on;
(ii) suppress any automated send to a lead whose entire history predates the business's Gmail
connection date, until the owner opts in once; (iii) keep it on but require approval for the first
batch regardless of risk level. My recommendation is (ii) — it's the one that generalises to Outlook
and CRM import too. Serves **Rule 3**. This is the highest-value item in this document.

**2. Tell the owner what will happen, on the screen where they grant permission.** — **PRESENTATION**
`src/components/OnboardingForm.tsx`, step 2, copy in §4.2(a). Currently the only pre-consent
description says FollowUp "reads" and "tells you." Serves **Rule 3**. (Per `CLAUDE.md` this is copy
that carries UX weight — it belongs in `design-brain/decisions/design-decisions.md` when done, and
`rejected.md` should be checked first.)

**3. Notify on every autonomous send, not just the `unanswered` one.** — **BEHAVIOUR (small)**
`src/lib/automation.ts` — `notifyNeglect` is called only when `unansweredIds.has(lead.id)`. Silence
and dead-lead sends notify nobody. "No surprises" is brand principle 1 and Rule 3; a send the owner
learns about only if they go looking is exactly the "we sent 47 messages" surprise the brand
principles forbid. Cheapest correct version: one notification per send, naming the lead and the
trigger, linking to the lead.

**4. Put a stop control where the surprise happens.** — **BEHAVIOUR (small) + presentation**
Notification rows, `/activity`, and `LeadTrustPanel`. Today the only way to react to a message you
didn't like is to navigate to the lead and find a three-way toggle; the only fast global action is in
Settings, which is the one that ends the relationship. A per-lead "stop messaging this person" on the
notification and the activity row converts a company-level kill into a lead-level one. Structure and
interaction are `frontend-3d-agent`'s; the words are mine. Serves **Rule 3** and **Rule 5** (a ladder
needs rungs going down as well as up).

**5. A short, visible send buffer on the first N autonomous sends.** — **BEHAVIOUR**
`src/lib/automation.ts` / `src/lib/sending.ts`. Gmail gives humans up to 30 seconds; FollowUp gives
its owners zero, and Gmail's own Undo Send doesn't cover API sends. A 60-second hold on a business's
first (say) ten autonomous sends, with a push notification carrying a "hold it" action, is the only
real undo available in this category — and it costs almost nothing against the speed pitch because the
speed claim is "within a minute." I'd scope it to the *learning period* rather than forever, which is
also how it stays consistent with the mission. Serves **Rule 3** and **Rule 5**.

**6. Make "send a test lead to myself" the third onboarding step.** — **BEHAVIOUR (flow)**
`src/components/OnboardingForm.tsx` + existing `TestLeadButton` / `/api/leads/test-lead`. §4.2(b).
The component already exists and already runs the real path; this is mostly a placement decision.
Serves **Rule 3**. UX-flow decision → record in `design-brain/decisions/design-decisions.md`, built
by `frontend-3d-agent`.

**7. Resolve the disclosure inconsistency deliberately.** — **BEHAVIOUR + legal**
Voice discloses; email, SMS, WhatsApp and the Meta channels don't (`src/lib/sender.ts`,
`src/lib/twilio.ts`). Separately, no outbound email carries the business identification block CASL
describes, and no outbound SMS carries opt-out instructions even though inbound `STOP` is honoured.
This needs a lawyer and then a founder decision on wording per channel — not a silent agent pickup.
Note honestly in that decision that the best evidence says disclosure has a trust cost to the sender
(Schilke & Reimann), so this is a compliance decision with a known commercial price, not a free win.

**8. Replace the sparkle icon on the test-lead button.** — **PRESENTATION**
`src/components/TestLeadButton.tsx` imports and renders `Sparkles`. `design-brain/brand/brand-principles.md`
principle 3 bans sparkle icons by name, and the repo's own research says every sparkle feeds the
documented "my business will feel fake" fear. Trivial, but it's on the screen this document is
proposing to promote into onboarding. Icon choice is `frontend-3d-agent`'s call within the token
system; flagging it, not picking it.

**9. Don't rely on the approval queue as the main trust mechanism.** — **No file; a position**
Section 1.5. The queue matters, but a distracted owner on a phone approving in seconds is a rubber
stamp. The mechanisms that actually survive this ICP are the structural ones FollowUp already has —
the fact-free first touch, stop-on-reply, the audit trail — plus items 1, 3, 4 and 5 above. Worth
recording so a future session doesn't "improve trust" by adding more approvals.

**Not recommended:** a general undo/recall for delivered messages (doesn't exist in any channel;
promising it would be the dishonest kind of trust feature), and disclosing AI authorship on every
message voluntarily ahead of legal advice (costs sender trust per §3.3, with no established benefit).

## What this document does not settle

- **No FollowUp user said any of this.** Every external finding is category-level and
  snippet-sourced. `research/customers/2026-09-15-owner-interview-guide.md` question 7 ("what would
  make you comfortable letting it send without you checking first?") is the direct test for items
  1–6 — the interviews remain the missing input.
- **No number in this document is fetch-verified**, so none of it may go on a screen or a landing
  page. Per the design brain's own standard: strong enough to steer design, too weak to quote.
- **The 2026 TCPA case and the state chatbot laws are the shakiest citations here** — both matter
  enough that a lawyer should read the primary text before anything is built on them.
- Whether Gmail's Undo Send genuinely doesn't apply to API sends is an inference I'd verify before it
  appears in any customer-facing claim.

### Sources checked 2026-09-15 (all via WebSearch snippet; WebFetch confirmed egress-blocked)

- https://www.intercom.com/help/en/articles/7837527-preview-and-test-fin-before-rolling-it-out-to-customers
- https://www.intercom.com/help/en/articles/12599471-use-fin-previews
- https://www.intercom.com/help/en/articles/14077180-simulations-vs-batch-tests-vs-previews
- https://www.cio.com/article/3610142/salesforce-adds-testing-center-to-agentforce-for-ai-agents.html
- https://trailhead.salesforce.com/content/learn/modules/trusted-agentic-ai/explore-agentforce-guardrails-and-trust-patterns
- https://brightlume.ai/blog/shadow-mode-rollouts-ai-agents-pilot-production
- https://www.eesel.ai/blog/a-complete-guide-to-zendesk-ai-agents-setup-costs-and-best-practices
- https://getautomized.com/gohighlevel-conversation-ai-setup/
- https://autogencrm.com/gohighlevel-ai-review/
- https://ideas.gohighlevel.com/conversation-ai/p/have-ai-bot-turn-off-permanently-on-a-contact-when-staff-replies
- https://www.regie.ai/auto-pilot and https://www.regie.ai/co-pilot
- https://www.fyxer.com/ai-email-writer and https://support.fyxer.com/en/articles/12951647-how-to-review-edit-and-send-your-first-draft
- https://kenashe.ai/blog/2026-09-14-what-fyxers-ai-inbox-assistant-gets-right-about-trust
- https://blog.google/products-and-platforms/products/gmail/how-to-unsend-email-gmail/
- https://tianpan.co/blog/2026/06/25/approval-fatigue-how-human-in-the-loop-gates-decay-into-rubber-stamps
- https://dev.to/brennhill/automation-bias-why-people-rubber-stamp-ai-and-how-to-fix-it-2587
- https://dev.to/jackm-singularity/ai-agent-rollback-plan-undo-bad-actions-before-users-lose-trust-4927
- https://www.codebridge.tech/articles/ai-agent-incident-response
- https://crtc.gc.ca/eng/com500/faq500.htm and https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl
- https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- https://www.fcc.gov/document/fcc-confirms-tcpa-applies-ai-technologies-generate-human-voices
- https://www.henson-legal.com/ai-voice-compliance (for the 2026 Fifth Circuit case — secondary)
- https://artificialintelligenceact.eu/article/50/ and https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act
- https://www.multistate.ai/updates/vol-85-state-ai-chatbot-regulation-laws and https://www.orrick.com/en/Insights/2026/04/2026-State-Chatbot-Laws-Key-Provisions-and-Regulatory-Trends
- https://www.sciencedirect.com/science/article/pii/S0749597825000172 (Schilke & Reimann, OBHDP 2025)
- https://www.mobiloud.com/blog/push-notification-opt-in-rate and https://doc.batch.com/guides-and-best-practices/orchestration/how-to-improve-the-push-opt-in-rate
