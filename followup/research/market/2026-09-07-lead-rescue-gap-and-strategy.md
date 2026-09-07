# Lead rescue: the gap, the aim, and the six competitor questions

**Date:** 2026-09-07
**Source:** CEO-supplied research (Phase 2 + Competitive Gap Round 1, produced outside
this repo) plus a same-day search pass answering its six open competitor questions.
Standing context — every agent and session reads this alongside `PRODUCT_DIRECTION.md`.

## The goal, in one sentence

A business owner who paid for a lead never loses it because nobody followed up,
followed up late, or followed up wrong. FollowUp does all of the following up.

## The direction (what FollowUp is and is not)

- **Not a CRM, not a chatbot, not an AI salesperson.** FollowUp sits alongside whatever
  the business already uses (inbox, phone, WhatsApp, Instagram, later their CRM) and
  watches the follow-up itself. "Who is watching the follow-up?" is the category question.
- **Two jobs.** (1) Immediate rescue: a new lead arrives, no human responds, FollowUp
  responds. (2) Lost-lead recovery: a conversation died, FollowUp finds it and re-engages.
- **The human closes.** FollowUp replaces the follow-up work, not the salesperson's
  judgment on a hot lead. Autonomy rises per lead (Assisted default, Autonomous opt-in);
  everything stops the instant the lead replies.
- **Every language, every channel.** Mission requirement, confirmed by the first outside
  tester's feedback ("amazing if it will be taking follow up from each and every one in
  any language from every platform").
- **Horizontal, by CEO decision.** Real estate is the first test bed, not the vertical.
  The supplied research recommends "start vertical (realtors), architect horizontal";
  the CEO declined the vertical, and `research/market/2026-09-06-realtor-tool-landscape.md`
  supports that: real estate is the most crowded segment (Ylopo, Structurely, Sierra,
  Lofty already sell cold-lead rescue to realtors specifically).
- **The metric that matters:** leads saved that would otherwise have died, and the
  revenue attributed to them. Not messages sent. ROI story: "You received N leads, M
  weren't followed up fast enough, FollowUp recovered K conversations → appointments →
  transactions."
- **The pitch:** "You paid for the lead. We'll make sure it doesn't die because nobody
  followed up." Lead comes in, you're busy, FollowUp catches it. If you don't respond,
  FollowUp steps in. If it goes cold, FollowUp brings it back. When it's ready, you take over.

## Moat ranking (from the supplied research, agreed)

Not moats: "AI", automated follow-up, CRM integrations (competitors expose the same
APIs and can build the reverse), chatbots. Distribution, not defense.
Candidate moats: (a) **neglect detection** — a lead the CRM marks "contacted" that is
actually dying (contacted once, no reply, no follow-up, still showing intent);
(b) **permission + audit trail** — CASL/PIPEDA/TCPA make consent, source, channel, stop
and unsubscribe first-class data, not a bolt-on; (c) **outcome intelligence** — which
messages get replies, which signals predict intent, when a human should step in. (c) is
long-term, compounding, not an MVP feature.

## The six competitor questions, answered (2026-09-07 search pass)

Help-center domains (followupboss, gohighlevel, sierrainteractive, lofty, dealrecovery)
are egress-blocked from the sandbox; these are search-snippet-sourced, not fetch-verified.

1. **Can Follow Up Boss detect that an agent personally failed to respond and intervene?**
   Partly. A documented recipe ("Automatically reassign lead if no contact attempts have
   been made") checks on day 2 whether the agent called/texted/emailed and reassigns to
   a group, pond, or agent. The dashboard tracks "unactioned leads." It reroutes to
   another *human*; it does not step in itself, and it requires the owner to set it up.
2. **Can HighLevel do it without the business building the workflow?** No. As of July 2026
   it has a "User Replied" trigger with SLA timeouts (wait 15 min for a rep, escalate to
   task/manager alert) — but only inside a workflow the business builds. Conversation AI's
   Auto Follow-Up detects *contact* inactivity, not human neglect.
3. **Can Lofty find leads that look handled but went cold?** On request. The AI Assistant
   answers "which leads haven't been contacted in 30 days" and drafts messages. Pull, not
   push. Smart Plans run regardless of whether a human acted.
4. **Can Sierra?** Closest to attacking the problem directly: Lead Engage works new and
   dormant leads over two-way text for up to 12 months and Sierra reports agent response
   and conversion by agent/source — inside its own CRM + website bundle, real estate only.
5. **Does anyone have a "Lead Rescue Score"?** No. The pieces exist separately: Pipedrive
   "rotting" deals (inactivity days per stage, red tile), Salesforce Einstein at-risk
   (no activity 10+ days, stuck stage), HubSpot deal score, BoldTrail behavioral alerts
   (lead activity only). Nobody combines human neglect + lead intent + recoverability
   into one number with an automatic rescue behind it.
6. **Does anyone report revenue recovered from leads a human abandoned?** Not found.
   Sierra attributes conversions by agent and source; Structurely markets a 21x ROI
   claim. No competitor found reports "recovered revenue attributable to follow-up that
   had stopped."

**Verdict:** every individual capability exists somewhere. The gap is real at the level
of (a) watching the *human*, not the lead, by default and without workflow-building,
(b) the score, and (c) the recovered-revenue report. One horizontal analog to watch:
DealRecovery.ai (automated recovery of stale Pipedrive deals).

## Where FollowUp already stands against this (code-verified, 2026-09-07)

Built: multi-channel capture (Gmail auto-sync every 10 min + daily deep pass, Twilio
SMS/voice + live AI voice agent, WhatsApp, Instagram DM, widget, webhook, CSV, manual);
AI classification, scoring with visible reasons, drafting with a hard no-invention rule;
follow-up on by default (Assisted + 5-day auto follow-up on silence); stops on reply;
per-lead autonomy tier; missed-call text-back; hot-lead handoff notification; Ponds and
Smart Views; Stripe billing at a flat price.
Not built yet, and directly implied by the aim: a **rescue score** per lead (human
neglect × lead intent × recoverability), an **"at risk" view** driven by it, a
**recovered-leads / recovered-revenue** report, and a **consent/permission record** per
lead (source, channel, consent basis, stop). These are the next moat-labelled items.

## Remaining strategic questions (open, in the CEO's order)

1. Can we acquire the first 100 customers?  2. Exact MVP scope (largely built — see
above; the missing pieces are the score, the at-risk view, the recovered-revenue report).
3. What makes an owner use FollowUp alongside their existing tools?  4. Unit economics.
5. Path to $10M/$100M.  6. Biggest failure modes.
