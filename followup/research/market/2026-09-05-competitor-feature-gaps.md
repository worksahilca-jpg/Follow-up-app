# Competitor feature-gap pass: Follow Up Boss, Close, Podium

**Date:** 2026-09-05
**Author:** market-research-agent (standing in as a general-purpose agent this session — named subagent identity wasn't available; see task #36)
**Scope:** Concrete features/UX patterns these three competitors have that FollowUp genuinely doesn't (verified against the codebase, not assumed), filtered to what would plausibly matter to a solo realtor, freelance consultant, or 3-5 person agency — not enterprise features that don't fit a $29/mo one-plan product.

## A sourcing caveat up front — read this before citing anything below

**WebFetch is blocked network-wide in this sandbox.** I tested it against the competitors' own marketing/help-center domains (`followupboss.com`, `help.followupboss.com`, `podium.com`) and even an unrelated control domain (`en.wikipedia.org`) — all came back `EGRESS_BLOCKED` from the network egress proxy. This is not a per-site block; nothing fetches. `WebSearch` does work, and Google's result snippets do quote/paraphrase the official pages directly (help-center articles, product pages), which is how every claim below is sourced. But that means **nothing here is a verbatim page fetch I read myself** — it's a search snippet I'm trusting. Where a snippet was thin, I cross-checked it against a second independent search rather than taking one result at face value. Treat every claim below as "search-snippet-sourced, not fetch-verified," and re-verify with a direct fetch before it goes on the landing page as a quoted comparison — growth-agent's charter is explicit that an unsourced or unverifiable claim is worse than no claim.

## What I checked in the codebase first (so I don't recommend something already built)

- `src/app/page.tsx` — current honest landing-page feature list (Gmail/Twilio SMS+voice/Instagram DM/website widget/webhook/manual/CSV; AI scoring with visible reason; approval-first drafts with per-lead Assisted/Autonomous; automation that stops on reply; per-source routing; flat $29/mo).
- `.claude/agents/growth-agent.md`'s "What's actually true today" section — same list, plus explicit "not yet real": AI voice-calling, smart routing by salesperson skill/type, Instagram fully live.
- `src/lib/assignment.ts` — auto-assignment is strictly "least-loaded" (whoever has the fewest leads gets the next one); no round-robin cursor, no shared/unclaimed pool, no manual claim action.
- `src/app/api/twilio/voice/[secret]/route.ts` — an unanswered call always goes to a `<Record>` voicemail-with-transcription; there is no branch that sends the caller an automatic SMS.
- `src/app/(app)/leads/LeadsPageClient.tsx` — the lead-list filters are a hardcoded chip row (`All/Mine/New/Hot/Follow-up today/Cold/Won/Lost`); there's no way for a user to build and save a custom filter.
- `src/app/(app)/pipeline/PipelinePageClient.tsx` — FollowUp **already has** a drag-and-drop Kanban pipeline (confirmed `draggable`/`onDrop` handlers) — so I dropped "visual deal pipeline" as a Follow Up Boss finding; it'd be a false gap.
- Grepped the whole `src` tree for `commission`, `review|testimonial|reputation`, `round.?robin|pond|smart view|saved filter` — all came back empty or only matched unrelated code comments (e.g., a `// Loaded into the editor for review/editing` comment, not a feature). Confirms the gaps below are real gaps, not something already shipped under a different name.

---

## 1. Follow Up Boss (real estate–focused CRM, closest ICP overlap)

**What it is:** A real-estate-specific CRM/lead-router. Pricing (already on file via growth-agent, not re-litigated here): Grow $69/user/mo, Pro $499/mo for 10 users, Platform $1,000/mo (or $833/mo annual) for 30+ users — all seat-based, unlike FollowUp's flat $29.

### Finding 1.1 — "Ponds": a shared, claimable lead pool
**What it is:** A pond is a shared bucket of leads visible to a set of team members (not the strict per-lead owner model). New leads from a given source can flow directly into a pond instead of an individual; any agent in the pond can filter to it, select leads, and mass-assign themselves as owner — the reassignment gets logged on the lead's timeline, and any in-flight automation ("Action Plan") continues running under the new owner. The stated purpose is preventing a lead from being wasted when the "right" agent is too busy to work it right now.
*Sources: [help.followupboss.com — Lead Ponds Overview](https://help.followupboss.com/hc/en-us/articles/360048829034-Lead-Ponds-Overview), [Lead Ponds: Claiming a Lead From a Pond](https://help.followupboss.com/hc/en-us/articles/4422921898391-Lead-Ponds-Claiming-a-Lead-From-a-Pond), [Lead Flow Directly to Pond](https://help.followupboss.com/hc/en-us/articles/4402383518743-Lead-Flow-Directly-to-Pond) — accessed via WebSearch 2026-09-05, not fetched directly (see caveat above).*

**Why it might matter to FollowUp's ICP:** FollowUp's own auto-assignment is purely algorithmic (least-loaded person gets it, full stop — see `src/lib/assignment.ts`). That's fine for a solo user or a genuinely evenly-loaded pair, but the 3-5 person agency persona on the landing page ("You're doing client work and new business at the same time") is exactly the case where least-loaded assignment can hand a hot lead to whoever's technically least busy but actually on vacation or bad-fit for that lead type. A claim-from-a-shared-pool pattern is a smaller, cheaper thing to build than real skill-based routing (which growth-agent has explicitly parked as not real yet) and would give a small agency a "nobody's assigned yet, first person who can take it grabs it" option without pretending to be smart about *who* should get it.

**Rough cost:** Backend + frontend, medium. Backend: a lead needs to support `assignedToId: null` with a business-visible "unclaimed" state, a claim endpoint, and a timeline event on claim (the timeline/activity-log infra already exists per `src/lib/types.ts` patterns for lead events, so this is additive, not new plumbing). Frontend: a new leads-list filter ("Unclaimed") plus a claim button/action — small compared to a full routing-rules UI.

### Finding 1.2 — Commission/expected-payout field on a deal (minor, real-estate-specific)
**What it is:** Follow Up Boss's deal/pipeline view tracks not just deal value but commission value and expected close date, so a real estate agent sees an at-a-glance expected payout, not just gross deal size.
*Source: [followupboss.com/features/deals](https://www.followupboss.com/features/deals) as summarized via WebSearch 2026-09-05 (direct fetch blocked, see caveat).*

**Why it might matter to FollowUp's ICP:** Real, but narrower than most findings here — it's specific to the realtor persona and doesn't generalize to the freelance-consultant or agency personas the way a commission % naturally would for real estate. I'd rate this "nice if backend-agent is already touching the Lead/Deal model for something else" rather than worth a standalone sprint.

**Rough cost:** Backend (one nullable field + a percentage calc) + light frontend (one input, one derived display value). Low cost, low-to-medium priority given the narrow persona fit.

---

## 2. Close (SMB/solo sales CRM — the closest pricing-philosophy comparison)

**What it is:** A calling-and-email-centric CRM aimed at sales teams under 100 people, with a genuinely cheap entry tier (Solo $9/mo single-user, up to Scale $139/user/mo annual) — already noted by growth-agent as one of the "10-30x FollowUp's price" comparators once you're past the Solo tier and need team features.

### Finding 2.1 — Smart Views: saved, shareable filtered lead lists
**What it is:** A Smart View is a saved search/filter on the leads list — build a filter (any combination of fields/criteria), save it with a name, and choose whether it's private to you or shared with the whole org. It then shows up as a one-click item in the sidebar. Close's own marketing explicitly pitches this as a way to answer "who do I need to follow up with and when" without manually re-building the same search or maintaining a pile of individual reminders.
*Sources: [help.close.com — Creating Smart Views](https://help.close.com/feature-guide/lead-filtering-and-smart-views/creating-smart-views), [Lead Filtering and Smart Views](https://help.close.com/feature-guide/lead-filtering-and-smart-views), [How to Catch Missed Sales Leads with Smart Views and Automation](https://close.com/blog/crm-automation-prevent-lost-leads) — via WebSearch 2026-09-05, not fetched directly (see caveat).*

**Why it might matter to FollowUp's ICP:** This is the cleanest, most directly-applicable gap of the whole pass. FollowUp's lead list filters are a fixed, hardcoded set of eight chips (confirmed in `LeadsPageClient.tsx`) — there's no way for a user to build "leads from Instagram, over $2k deal value, no contact in 10 days" and come back to it tomorrow with one click. That's a completely generic CRM pattern, not a real-estate-specific one, so it fits all three ICP personas equally: the freelance consultant juggling a dozen open threads, the realtor segmenting by price band or neighborhood, the small agency lead segmenting by source. It's also low-risk relative to the thesis — a saved filter is pure workflow convenience, not a "we generate more leads" feature, so it doesn't complicate the lead-conversion positioning at all.

**Rough cost:** Mostly frontend, light backend. Backend: a small `SavedFilter` table (businessId, userId or null-for-shared, filter definition as JSON, name) — one CRUD API route. Frontend: turn the current hardcoded filter logic in `LeadsPageClient.tsx` into a filter-builder (or at minimum a "save current filter as..." on top of the existing predicate logic) plus a sidebar list of saved views. Medium-low overall; the filtering logic itself already exists, this is persistence + a save/load UI on top of it.

### Finding 2.2 — Power Dialer / AI credits (Chloe) — not recommended as a gap to chase
Close's headline differentiators at the paid tiers are the Power/Predictive Dialer and its "Chloe" AI assistant (500-2,000 AI credits/mo depending on tier). I'm flagging these only to say: **don't chase them.** The dialer overlaps with the AI-voice-calling pillar growth-agent has explicitly marked "not yet built — don't imply it exists," and building a half version of it risks the exact overselling growth-agent's charter warns against. Close's AI assistant is also a more generic "ask your CRM questions" layer, whereas FollowUp's per-lead visible-reason scoring is already a sharper, more specific pitch (validated by the HubSpot sales-workspace research already on file). No action item here — just confirming these aren't gaps worth closing.

---

## 3. Podium (small-business messaging/reputation suite)

**What it is:** A messaging-and-reviews platform for local businesses, priced well above FollowUp's flat rate ($399/mo Core, $599 Pro, $999+ Enterprise, plus a $99/mo AI-receptionist add-on and per-seat/per-number fees) — already flagged by growth-agent as one of the "10-30x FollowUp's price" comparators, and independently one of the most expensive tools in this category per its own reviews.

### Finding 3.1 — Missed-call text-back (the single most actionable finding in this pass)
**What it is:** When an inbound call to the business goes unanswered — rings out or hits voicemail — Podium automatically and immediately sends the caller a text message re-engaging them, so a missed call turns into a live text thread instead of a dead end. Podium's own marketing claims this recovers a majority of otherwise-lost calls (their number: 58%, take with the appropriate grain of salt as a vendor's own stat).
*Sources: [Podium — 4 Ways to Avoid the Hidden Cost of Missed Calls](https://www.podium.com/article/avoid-the-hidden-cost-of-missed-calls), [Missed Call Text Back: Best Tools & Setup Guide](https://www.getaira.io/blog/missed-call-text-back), [salescaptain.com — The Missed Call Text Back](https://blog.salescaptain.com/the-missed-call-text-back-never-lose-a-lead-again/) — via WebSearch 2026-09-05, not fetched directly (see caveat).*

**Why it might matter to FollowUp's ICP — this is the closest thing to a direct thesis validation in this whole pass:** I read `src/app/api/twilio/voice/[secret]/route.ts` directly. Today, when a call comes in on a business's Twilio number, FollowUp plays a greeting and records a voicemail (with transcription) — it creates the lead, which is good, but it never sends anything back to the caller. For the realtor persona on FollowUp's own landing page ("Five open houses on Saturday... FollowUp tells you which one to call first") — that agent is *literally on another call or showing a house* when this happens. A caller who hits voicemail and gets silence back often just calls the next name on their list. This is not a new channel or a new integration — FollowUp already owns the Twilio voice webhook and already has SMS-sending infrastructure (`src/lib/sending.ts`, `src/lib/twilio.ts`) for the exact same phone number. It's arguably the single cheapest, highest-leverage gap in this entire report, and it reinforces rather than complicates the "don't lose a lead that already reached you" thesis — this is someone who called *you*, not a new lead FollowUp generated.

**Rough cost:** Backend only, low-to-medium. Add a branch in the voice webhook route (or its `<Record>` fallback) that fires an outbound SMS via the existing Twilio SMS sending path immediately after the call, with a configurable template (reuse whatever template-editing pattern automation/workflows already use). No new frontend surface is strictly required beyond maybe one settings toggle and a template field, both of which can likely reuse existing Settings-page patterns. Recommend this as the top pick for backend-agent to scope first.

### Finding 3.2 — "AI Employee": 24/7 conversational answering across calls/SMS/web/social
**What it is:** A step beyond 3.1 — instead of a canned text, Podium's AI Employee actually carries the conversation: qualifies the lead, answers questions, and can book an appointment, across channels, any time of day, with a marketed sub-2-minute response time.
*Sources: [Podium — AI Employee product page](https://www.podium.com/product/ai-employee), [ainora.lt — Podium AI Employee Review 2026](https://ainora.lt/blog/podium-ai-employee-review-alternatives-2026) — via WebSearch 2026-09-05, not fetched directly (see caveat).*

**Why it might matter, and why I'm not recommending it as a near-term gap to close:** This is real and would matter to the ICP, but it's substantially the same thing as the AI-voice-calling pillar growth-agent has already named as a real future pillar that's "not yet built — don't imply it exists." I'm surfacing it mainly as **validation that the parked pillar is worth prioritizing eventually**, not as a new, cheaper thing to bolt on now — a text-based "AI qualifies while you're unavailable" flow is a materially bigger build (conversation state, multi-turn handling, appointment-booking logic) than 3.1's single auto-text, and conflating the two risks either overselling 3.1 or underscoping 3.2. Treat 3.1 and 3.2 as two different sizes of the same idea, not one feature.

### Finding 3.3 — Review-request automation (flagging for positioning, not just backlog)
**What it is:** After a job/deal closes, Podium can automatically send the customer a text asking for a Google/Yelp review.
*Source: general Podium product summaries via WebSearch 2026-09-05 (see caveat); this is a widely-documented Podium feature but I did not find one single canonical page I'd cite as the primary source, so treat this one claim as the weakest-sourced in the report.*

**Why I'm flagging this instead of just listing it:** A solo realtor or small agency plausibly wants this — closing a deal and immediately asking for a review is a natural, high-value moment, and FollowUp already has the exact trigger it would need (a lead moving to "won" in the pipeline) and the exact sending infrastructure (SMS via Twilio) to build it cheaply. But it's a genuinely different job than lead conversion — it's reputation/lead-generation-adjacent, not "don't let an existing conversation go cold." Building it risks quietly drifting the product toward "we help you get more leads" territory that growth-agent's charter explicitly says to avoid. I'm not recommending against building it — just flagging for the CEO/manager-agent that if this gets picked up, it should probably be framed internally as "a small bonus utility on top of the core loop," not blended into the core pitch on the landing page.

**Rough cost (if pursued):** Backend, low. A "won"-stage webhook/trigger plus a template send, reusing existing SMS infrastructure — genuinely one of the cheapest builds in this report. The judgment call is positioning, not engineering effort.

---

## Category-level observation

All three competitors are meaningfully more expensive than FollowUp's flat $29/mo once you need more than a single seat (Follow Up Boss's cheapest multi-user tier is seat-based at $69+/user; Close jumps from a genuinely-solo $9 tier to team pricing fast; Podium starts near $400/mo before add-ons) — this reconfirms rather than complicates the flat-pricing thesis already on file, no positioning change needed there. The two most actionable, thesis-aligned, and cheapest-to-build findings in this pass are Close's Smart Views (2.1) and Podium's missed-call text-back (3.1) — both are workflow/reliability improvements to a channel FollowUp already owns, not new integrations or new categories of feature.

## Flag for CEO/manager-agent

Nothing here suggests FollowUp's core positioning needs to change — if anything, the pricing gap and the "everyone's watching the same missed-lead problem from a different angle" pattern reinforce it. The one judgment call worth a decision, not just a backlog entry, is Finding 3.3 (review-request automation): genuinely cheap to build and genuinely wanted by the ICP, but sits just outside the lead-conversion thesis. Worth a deliberate yes/no rather than backend-agent picking it up as "just another small feature."
