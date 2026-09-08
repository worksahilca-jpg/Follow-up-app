# FollowUp — Product Requirements Document

**Status:** living document, reflects the product as actually shipped in this repo as of 2026-09-08.
**Source of truth for direction:** `PRODUCT_DIRECTION.md` (the six rules + CEO decisions) — if this
PRD and that file ever disagree, `PRODUCT_DIRECTION.md` wins; update this file, not the reverse.

---

## 1. Problem

Business owners lose money not because they lack leads, but because they don't follow up — or
follow up late, or follow up wrong. Every CRM on the market solves lead *generation* and lead
*sorting*. None of them solve the actual failure mode: a lead that already made contact — emailed,
DMed, called, filled out a form — and then got no reply, or one reply and silence after that.
That lead goes cold not from lack of interest but from lack of attention, and the business never
finds out it happened.

## 2. Mission (canonical wording — do not paraphrase away from this)

> Every CRM has lead generation and lead sortation. Nobody is concerned about the leads that are
> going cold, the leads that have gone into the interstellar phase, or the leads that have never
> been reached... My main goal is to remove the position of the salesperson or follow-up person
> who is doing this manually — AI agents receiving calls, in every language, fetching and
> following up on leads in every language, not just English.

Four ordered points (`PRODUCT_DIRECTION.md`, canonical):

1. No lead is lost because of no follow-up, late follow-up, or wrong follow-up.
2. Rescuing cold/dead/never-reached leads is a feeder into that, not the goal itself.
3. In every language, from every platform.
4. End state: no human does this job at all. The owner still closes the deal.

## 3. Target customer

**Primary ICP:** a small-to-mid business owner (home services, local services, small sales teams)
who already has more inbound contact than they can personally answer — email, SMS, social DMs,
phone — and who has no dedicated follow-up person. Not a sales-ops team buying seats for an SDR
org (see §7, explicitly out of scope). The willingness-to-pay evidence (`research/market/
2026-09-08-pricing-validation-home-services-icp.md`) centers on home-services buyers already paying
3–20x FollowUp's price for narrower point solutions (CallRail+Voice Assist, Smith.ai, Podium).

**Explicitly not the target:** an enterprise sales org running outbound prospecting (that's the AI
SDR category — 11x, Artisan, Regie.ai — a different buyer, motion, and price tier; see
`research/market/2026-09-08-broader-competitive-landscape.md`. Confirmed non-threat, not pursued).

## 4. Product principles (the six rules — full detail in `PRODUCT_DIRECTION.md`)

1. **Depth over breadth, on the job, not an industry.** Horizontal by explicit decision (real
   estate was considered and declined — too crowded with AI-native verticals already).
2. **Own the data.** Every lead history, AI reasoning, and outcome lives in FollowUp's own DB —
   never recomputed live from a third party on page load.
3. **Trust ships like a feature.** Every automation guarantee is explicit, user-visible, and has a
   test proving it.
4. **Don't build what Google/Salesforce will give away free.**
5. **Design for rising autonomy**, not fixed human-in-the-loop — automation tier is a per-lead
   setting, not a global flag.
6. **Label every roadmap item moat or table stakes**, bias effort toward moat.

## 5. The moat (Rule 6, applied)

No competitor found in three research passes — Follow Up Boss, HighLevel, Lofty, Sierra,
ServiceTitan, Housecall Pro, Podium, CallRail, Beside, Bravi, Leaping AI, Verse.ai, Numa, Goodcall
— has a shipped feature that detects a lead who **was answered once and then went quiet**, scores
it by neglect × intent × recoverability, and acts. Every competitor automates *the new lead*:
answer it, text it, log it. FollowUp's actual differentiator is catching the one that already went
quiet — this is the landing page's current headline (`src/app/page.tsx`, per `research/market/
2026-09-08-product-direction-synthesis.md` rec #1) and the product's clearest moat claim.
The biggest competitive risk is not a vertical AI-native player but a well-funded, horizontal
general-purpose AI receptionist (Beside: $32M raised, 20,000+ small-business customers) — none of
which do this specific job today, per the same research pass. The window to own this as a category
concept is closing, not open-ended.

## 6. What's built (shipped, in production) — organized by capability

### 6.1 Capture — every inbound channel becomes a real Lead

| Channel | How | Status |
|---|---|---|
| Gmail | OAuth, push notifications (seconds) + 10-min poll fallback + daily deep pass | Shipped |
| Outlook / Microsoft 365 | OAuth, poll-based sync | Shipped |
| Twilio SMS | Webhook, signature-verified | Shipped |
| Twilio Voice | Voicemail transcription (fallback) + live AI voice agent (opt-in) | Shipped |
| WhatsApp Business | Twilio WhatsApp sender | Shipped |
| Instagram DM | Meta webhook, one-click OAuth connect | Shipped |
| Facebook Messenger | Meta webhook, same app as Instagram | Shipped |
| Facebook Lead Ads | Meta webhook (`leadgen` change events) | Shipped |
| Website widget (embed form) | JS snippet → inbound API | Shipped |
| Inbound webhook (Zapier/Make) | Generic secret-keyed POST endpoint | Shipped |
| CSV import | Bulk upload, column-mapped | Shipped |
| Manual entry | Form | Shipped |
| CRM sync (inbound) | Follow Up Boss, HubSpot — poll every 10 min | Shipped, ⚠️ known bug: pagination doesn't persist across truncated runs past ~500 contacts (`research/audit/2026-09-08-newer-surface-audit.md` finding #2, fix tracked) |
| Meta Business Agent capture | Captures replies Meta's own free AI already sent (`is_echo`), so FollowUp doesn't duplicate or ignore an already-answered thread | Shipped, ⚠️ unverified against Meta's actual Handover Protocol behavior — see the warning in `src/lib/instagram.ts` |

Every capture path routes through **AI prospect classification** (is this actually a lead, not a
newsletter/recruiter/vendor pitch?) before becoming a Lead row — rejected threads are kept in
`FilteredEmail` with the classifier's reasoning and a one-click override, not silently discarded.

### 6.2 The core loop — score, draft, act

- **AI scoring**: every lead gets a 0–100 urgency score with a **visible reason** and per-factor
  weight breakdown (`Lead.scoreReason`/`scoreFactors`) — not a black-box number.
- **AI drafting**: a follow-up email is drafted per lead, explicitly instructed to never invent a
  fact absent from the conversation and to reply in the lead's own language (tested,
  `src/lib/__tests__/prompts.test.ts`).
- **Approval-first by default**: every draft needs a human click unless the lead's automation tier
  says otherwise (see §6.4).
- **Instant acknowledgement**: every new lead gets a fixed-template "we got your message" reply
  within the minute, in their language, on the channel they used — before the slower AI scoring
  even runs.
- **Human-neglect rescue**: a lead who wrote and got no reply for N hours (default 24) triggers a
  draft, sent automatically if low-risk or held for one-click approval — this is the mission's
  point 2, and the mechanism behind the moat in §5.
- **Rescue score**: every open lead ranked by neglect × intent × recoverability; the dashboard
  opens on "About to be lost," not a generic list.
- **Recovered-revenue reporting**: "What FollowUp saved you this week" counts only replies to
  messages FollowUp sent on its own — the proof mechanism for the pricing thesis in §9.

### 6.3 Workflow tools

- **Pipeline** — kanban stage board (New → Contacted → Qualified → Proposal → Negotiation →
  Won/Lost).
- **Sequences (Workflows)** — multi-step automated cadences, visually built, stop-on-reply
  guaranteed and tested.
- **Smart Views** — saved, shareable custom lead filters (source, stage, priority, days since
  contact).
- **Ponds** — a shared, claimable lead pool for sources where "least busy" isn't the right
  assignment rule.
- **Source routing** — per-source default automation tier / sequence enrollment / pool routing,
  applied once at lead creation.
- **Team** — invite by email, Admin/Sales roles, per-lead assignment.
- **Booking** — a public per-lead booking link a prospect can self-schedule from.

### 6.4 Trust & autonomy (Rule 3 and Rule 5, in the product)

- **Per-lead automation tier**: OFF (manual only) / ASSISTED (default — auto-send low-risk drafts,
  hold anything else for approval) / AUTONOMOUS (opt-in, skips the risk gate).
- **Risk gate**: `assessSendRisk()` blocks autonomous sends that mention pricing, contract terms,
  deadlines, or read as an invented fact or an upset lead — "medium/high" holds for a human.
- **Stops on reply**: a sequence halts the instant a lead responds — tested.
- **Consent & AI audit trail** (per lead, on the lead detail page): a plain-English consent basis
  derived from the lead's source, opt-out status (TCPA STOP/START), and a chronological log of
  every automated send or held-for-review decision FollowUp made for that lead. Shipped as a
  marketed trust feature per `research/market/2026-09-08-product-direction-synthesis.md` rec #2 —
  the underlying data (`AuditEvent`, `Lead.optedOutAt`) existed since task #67 but had no UI until
  this pass.
- **TCPA/A2P compliance notices** in Twilio setup; SMS/WhatsApp STOP/START honored on every send
  path (`sendFollowUpToLead` hard-refuses an opted-out lead regardless of caller).

### 6.5 Security & compliance (see `docs/security-roadmap.md` for the full level system)

- Google OAuth sign-in (NextAuth), 7-day sessions.
- Per-business multi-tenant isolation — every query scoped by `businessId`.
- Credential encryption at rest (`src/lib/db.ts` `ENCRYPTED_FIELDS`) for every stored access
  token/API key.
- Rate limiting on shared-cost actions (Gmail sync, AI regeneration).
- Zod schema validation on every API body.
- Error monitoring + auth-failure alerting.
- Per-business data export and full deletion (PIPEDA/GDPR erasure).
- De-identification pipeline gating any future model-training use of customer data (opt-in, off by
  default).
- Least-privilege DB role — code shipped, awaiting the production `DATABASE_URL` cutover (task
  #71, external action).
- External penetration test — vendor shortlist and scoping brief ready; not yet engaged (task #69,
  external action).

### 6.6 Billing

Single flat plan via Stripe (checkout/portal/webhook), currently $29/mo — see §9 for the pricing
question in progress.

## 7. Explicitly out of scope (checked and declined, not just unconsidered)

- **Real-estate vertical lock-in.** Considered, declined — see §5 and Rule 1's resolution in
  `PRODUCT_DIRECTION.md`. Don't re-litigate without a fresh CEO decision.
- **AI SDR / outbound prospecting** (11x/Artisan/Regie.ai territory — $60–100K/yr, sales-org buyer,
  different job entirely). Confirmed non-threat and non-target; re-check only if a real sub-$100/mo
  inbound-capable competitor appears in that category.
- **Free-platform parity** (Rule 4) — anything Gmail/Salesforce will plausibly ship for free is
  explicitly not worth building here.
- **Per-state call-recording consent nuance** for the voice agent (one spoken disclosure everywhere
  today) — named as a known gap, not solved.
- **Live human handoff mid-call** on the voice agent — not built.

## 8. Non-English / multi-platform status (mission point 3 — partly done)

Drafting, instant acknowledgement, voicemail transcription, and the live voice agent all carry an
explicit instruction to reply in the lead's own language, and the drafting/localization instruction
is unit-tested (`prompts.test.ts`, `consent.test.ts`'s neighbor `acknowledge.test.ts`). **What's not
done: no real non-English lead has been run through the live product end to end** — this is a
verified testing gap, not a code gap (confirmed this session by reading every language-touching
prompt and its test coverage), and needs either a real non-English lead or a paid native-speaker QA
pass (task #63, external action). This is flagged as urgent given competitive timing: Bravi already
operates multilingual across Europe/US, Structurely ships bilingual EN/ES nurture.

## 9. Open product decisions

- **Pricing experiment** ($49–79/mo cohort test against the current $29/mo, using the
  recovered-revenue report as the willingness-to-pay proof mechanism) — recommended by research,
  **explicitly deferred by the CEO** ("hold off on pricing"). Not started.
- **Fast-track Phase D trust marketing** — done this session (§6.4).
- **Channel unblocking** (Google OAuth verification, Twilio full A2P registration, WhatsApp
  template approval, Meta App Review) — required to remove current sending caps/friction on each
  channel; external business action, not a build (task #65).

## 10. Success metrics (as instrumented today)

- **Recovered-revenue report** — dollar value of deals attributable to a reply FollowUp's own
  automated send produced (the core "what did this actually save you" proof point).
- **Weekly digest** — same numbers, emailed automatically from the owner's own Gmail.
- **Rescue score / "about to be lost"** — leading indicator surfaced on the dashboard, not just a
  lagging report.
- 158 automated tests (as of this document) pin the trust guarantees and core logic; run on every
  pull request via GitHub Actions.

## 11. Roadmap, by phase (from `PRODUCT_DIRECTION.md`, status as of this doc)

| Phase | Content | Status |
|---|---|---|
| A | Instant ack, push-based Gmail sync, hourly silence check, automated trust tests | Done |
| B | Human-neglect trigger, rescue score, recovered-leads report + digest | Done |
| C | Every language, every platform | Outlook done; non-English end-to-end test open (task #63); channel unblocking open (task #65); Meta Business Agent capture done (with a flagged, unverified risk) |
| D | Autonomous-by-default, consent/audit trail | Both done this session |
| Security L2 | Encryption, rate limits, validation, monitoring, export/delete, least-privilege DB role | All done except the DB role's production cutover (external action) |
| Security L3 | External penetration test | Not started (vendor brief ready, task #69) |
