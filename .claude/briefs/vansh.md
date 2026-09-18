# Brief for Vansh's Claude Code — AI, automation and integrations

**Read this at the start of every session, before touching code.** It is the knowledge
Sahil's own Claude sessions carry, written down so every Claude on this team starts from the
same place and pulls in the same direction. It is not a summary of the repo docs — it points
at them. Read the files it names; they are short and they are the truth.

Written 2026-09-18 by Sahil (founder) through his Claude session. Sahil owns this file. If it
ever disagrees with `followup/PRODUCT_DIRECTION.md`, `TEAM.md`, `CONTRIBUTING.md` or
`.github/CODEOWNERS`, those win — and this file needs fixing, so say so.

---

## 1. What FollowUp is

FollowUp is a SaaS product for a business owner who cannot, will not, or forgets to follow up
on the people who contact them. It captures every lead from every channel (Gmail, Outlook,
SMS, voice, a live AI voice agent, WhatsApp, Instagram DMs, Facebook Messenger, Lead Ads, a
website widget, webhooks, CSV, manual entry), keeps the whole conversation in our own
database, scores intent with a visible reason, drafts the next message in the lead's own
language, sends it when that is safe, and hands over to a human the moment judgement is
needed.

The main goal, in the founder's canonical wording (`followup/PRODUCT_DIRECTION.md`, top):

> **The problem: business owners are not able to follow up.**
> 1. No lead is lost because of no follow-up, late follow-up, or wrong follow-up.
> 2. Rescuing cold, dead, or never-reached leads is one feeder into that, not the goal.
> 3. In every language, from every platform.
> 4. The end state is that no human does this job at all. The owner still closes the deal.

When any research note, ticket, or your own idea seems to say otherwise, that list wins.

## 2. Why we are building it

Every CRM does lead generation and lead sorting. Nobody looks after the leads that go cold,
sit unread in a DM, or ring out to voicemail. Owners lose money to silence, not to
competitors. The founder's aim is to remove the manual follow-up job entirely — AI that
receives, answers and follows up in every language — so a small business gets the follow-up
discipline of a company with a sales team, without the salary.

**FollowUp stays horizontal.** One job, done deeper than any CRM will bother to, for any
business. Picking one industry was considered and declined (real estate is already crowded
with AI-native competitors). Do not re-argue this; it is a closed decision.

**The six rules every feature is checked against** (full text in `PRODUCT_DIRECTION.md`):

1. Depth over breadth — on the job, not an industry.
2. Own the data — every conversation, score, draft and outcome lives in our DB as a record.
3. Trust is a feature — every automation ships with a stated guarantee and a test proving it.
4. Don't build what Google or Salesforce will give away free.
5. Design for rising autonomy — "AI drafts, human approves" is per-lead and swappable.
6. Label every roadmap item moat or table stakes; bias toward moat.

Before you build anything, say in one line which rule it serves. If none, say "table stakes"
plainly. Never retrofit a justification.

## 3. What is already built

You are not joining an early prototype. As of September 2026, on `main`:

- **Capture** from every channel above. Gmail arrives by push within seconds; Meta channels
  by webhook with redelivery de-duplication; Outlook, HubSpot and Follow Up Boss by poll.
- **Instant acknowledgement** to every new lead on the channel they used, in their language,
  once, never over the owner's own reply.
- **Scoring** with a visible reason and factors, re-run on every inbound message.
- **Drafting** in the lead's language. A draft can never state a fact absent from the
  thread; the risk gate holds any that does. Instagram/Messenger drafts take the DM's shape
  (short, one question, up to three reply buttons).
- **Automation tiers per lead:** OFF / ASSISTED / AUTONOMOUS. Follow-up is on by default in
  ASSISTED. Hourly silence check, human-neglect trigger (lead wrote, owner never came back),
  multi-step Workflows in hours, per-source routing.
- **Meta rules built in, not worked around.** Instagram and Messenger are DM-only: up to
  three automatic touches inside Meta's 24-hour window, one owner-tapped message under the
  human-agent allowance for days 2–7, nothing after day 7.
- **Rescue:** the rescue score, the "About to be lost" home screen, the weekly "what
  FollowUp saved you" digest, one-click booking links.
- **Voice:** Twilio SMS and voicemail, plus an opt-in live AI voice agent (`/voice-agent`,
  its own always-on service) that talks to the caller in their language.
- **Trust plumbing:** consent record per lead, an audit trail of every automated action,
  TCPA/A2P notices, STOP/START handling, encrypted third-party secrets, per-business data
  export and erasure.
- **Business plumbing:** Google sign-in, teams and invites, Stripe billing with tiers, a
  founder-only `/admin`, Slack alerts, Sentry.
- **The test suite** pins the trust guarantees — 1,100+ Vitest tests run on every PR.

`STATUS.md` says what is open right now. `followup/README.md` describes the product as
shipped.

## 4. How it is built

- **Stack:** Next.js 16 App Router (read `followup/AGENTS.md` first — this Next.js is not
  the one in your training data), TypeScript, Prisma on Postgres (Supabase), Vercel, Vitest.
  Everything runs from the `followup/` directory.
- **API routes:** `followup/src/app/api/**/route.ts`, one file per endpoint.
- **Business logic:** `followup/src/lib/*.ts`. The send path is `sending.ts` → `sender.ts`.
  Automation is `automation.ts` (silence rule), `sequences.ts` (Workflows),
  `sourceRouting.ts`. Billing gate is `billing.ts`. Session is `session.ts`. The shared
  Prisma client with field-level encryption is `db.ts`.
- **Integrations:** `followup/src/lib/integrations/` (Gmail, OpenAI, Outlook, CRMs) plus
  `twilio.ts`, `instagram.ts`, `facebook.ts`, `whatsapp`-related files, and `inbound/`.
- **Schema:** `followup/prisma/schema.prisma` and hand-written SQL in
  `followup/prisma/migrations/`.
- **Tests:** `followup/src/lib/__tests__/` and `__tests__/` folders beside routes. Prisma is
  mocked (`vi.mock("@/lib/db")`), so the suite needs no database and no config.

The conventions that are load-bearing, not suggestions (full detail in
`.claude/agents/backend-ai-agent.md`, which is written for exactly your lane):

- **Multi-tenant everywhere.** Every query on `Lead`, `Conversation`, `Message`, and the
  rest scopes by `businessId`. A lookup by id with no ownership check is a cross-tenant
  leak, full stop.
- **Session pattern** at the top of every authenticated route: `getSessionContext()`, 401
  if null, then `ctx.businessId` / `ctx.userId`.
- **Billing gate** on anything that costs money: `requireActiveBilling(ctx.businessId)`,
  402 with `BILLING_LOCKED_MESSAGE` on failure. Free tier is real — pass `tier` through.
- **Response shape** `{ success: true, ... }` / `{ success: false, message }`.
- **New lead creation** calls `applySourceRouting(...)` on the creation branch only.
- **Select only what you need** from rows with encrypted fields (`ENCRYPTED_FIELDS` in
  `db.ts`); do not decrypt credentials you never use.
- **Client/server boundary:** a `"use client"` file importing a heavy lib file pulls Prisma
  into the browser bundle. Split a zero-dependency leaf module instead (precedents:
  `instagramId.ts`, `metaWindow.ts`, `quickReplies.ts`).
- **Check-then-act is a bug.** Every concurrent path (caps, claims, rate limits, reservations)
  uses an atomic claim or a Postgres advisory lock. `rateLimit.ts` and `sendCaps.ts` are
  the patterns.
- **Owner-facing words from the backend** (error messages, notifications) follow the
  product's voice: plain words, no jargon, no vendor names, and they answer *what happened,
  why, what can I do*. "Aanya last wrote on Instagram more than 7 days ago — Meta doesn't
  allow a business to message them now" is the standard. "Graph API 400" is not.

## 5. Your role

From `TEAM.md`: **Vansh — AI Automation & Integrations.** AI agents, follow-up automation,
external API integrations, automation workflows, AI-related testing. Pransh supports you on
the backend side; you own what the product *does* with a lead once it has one.

What GitHub auto-requests you to review (`.github/CODEOWNERS`):

| Path | Yours | Shared with |
|---|---|---|
| `followup/src/lib/automation.ts` | yes | — |
| `followup/src/lib/scoring.ts` | yes | — |
| `followup/src/lib/acknowledge.ts` | yes | — |
| `followup/src/lib/integrations/**` | yes | Pransh |
| `followup/src/app/api/cron/**` | yes | Pransh |
| `voice-agent/**` | yes | — |

In practice your lane is wider than that list: `sequences.ts` (Workflows), `sending.ts` and
`sender.ts` (the send path), `dmDrafts.ts` / `dmDrafting.ts` (DM-shaped drafts),
`metaWindow.ts`, `quickReplies.ts`, `reactivation.ts`, `suppression.ts`, `sendCaps.ts`,
`inbound/` (every webhook that turns a message into a lead), `instagram.ts`, `facebook.ts`,
`gmailSync.ts`, `outlookSync.ts`, `crmSync.ts`. Touch them when the work needs it and say in
the PR when it crosses Pransh's paths. Gautam owns UI, Dipesh owns auth and infra, Sahil
owns product direction and the governance docs.

**The channels right now (founder's call, 2026-09-16, shipped in #250):** SMS, voicemail
and the live voice agent are *off* the offer — `CARRIER_CHANNELS_AVAILABLE = false` in
`src/lib/pricing.ts`. Do not build on them until the founder turns them back on. The launch
channels are Gmail, Outlook, Instagram DM, Facebook Messenger, WhatsApp, the website widget,
the webhook, CSV, manual entry and CRM import. Meta is where the product lives or dies.

## 6. How you help right now

1. **Meta App Review is yours to drive.** The messaging permissions (Instagram, Messenger,
   WhatsApp) and Business Verification. Read
   `followup/research/integrations/2026-09-10-meta-google-verification-playbook.md` and
   `2026-09-06-instagram-meta-business-verification.md` first — the requirements, the
   screencast rules and the timelines are already researched; do not re-derive them. One
   coordination point: the **"Human Agent" feature** sits on the same App Review screen and
   Sahil is submitting that one himself (it needs a screencast of him). Agree in Slack who
   submits what so nothing is filed twice. WhatsApp message templates come after.
2. **Know the DM-only strategy cold.** Instagram and Messenger follow-up never switches
   channel (R-003). Inside Meta's 24-hour window: up to three automatic touches, each
   ending in one easy question with reply buttons. Days 2–7: one draft the owner sends by
   hand under the human-agent allowance. After day 7: nothing until the lead writes. A
   lead's "Not now" tap ends the sequence (A-007). All of it is in
   `design-brain/decisions/design-decisions.md`, entries dated 2026-09-16 to 2026-09-18,
   and `followup/research/integrations/2026-09-16-meta-human-agent-and-quick-replies-api-facts.md`.
   The first live sends will pin down what Meta actually returns — both senders now log
   the error code and subcode verbatim, so read the logs before guessing.
3. **The open automation findings** are in
   `followup/research/audit/2026-09-16-bug-hunt-automation-and-send-engine.md` (ranked by
   user harm) and `2026-09-16-meta-channels-production-audit.md`. Several are already fixed
   by #255–#259; check each against current `main` before touching it, and mark the ones
   you fix as resolved in the file with the PR number rather than deleting them.
4. **The drafting promises are yours to keep.** A draft never states a fact absent from the
   thread. A DM draft is 8–30 words, exactly one question, last, no banned closers, no
   invented numbers, at most three buttons — `checkDmDraftShape` in `dmDrafts.ts` enforces
   it and a failed shape is held, never sent. Drafts are in the lead's language. Any change
   to a prompt in `src/lib/integrations/openai.ts` needs a test in `prompts.test.ts` that
   would fail if the promise were dropped.
5. **Review honestly.** You are auto-requested on AI and integration PRs, including the
   ones Sahil's Claude session opens from the `claude/...` branch. Read the diff. Run it.
   A review that did not read the code is worth nothing, and a real finding is worth a lot.
6. **Find, don't just fix.** A bug you notice that is not yours goes in
   `followup/research/audit/backend-backlog.md` (or `#followup-alerts` for infra) with its
   failure path. Never let it evaporate in a chat.

## 7. The rules (these are not negotiable)

**Git**
- Never commit to `main`. Never push to `main`. Branch from fresh `origin/main` as
  `vansh/<short-description>`, one thing per branch.
- Every change goes through a PR using the template in `.github/pull_request_template.md`.
  CI must be green: typecheck, lint, build, tests, secret scan.
- **Sahil does every merge himself.** Nobody else merges, with or without an approval. When
  a PR is ready, tell him in Slack; do not press the button.
- Rebase onto `main` before opening a PR if `main` has moved. Never rewrite history on a
  branch someone else has checked out.
- Never disable, skip, or quarantine a test to get green. Never push an empty commit to
  re-run CI. "Flake" is not a root cause.

**Secrets, production, and other people's platforms**
- Never commit a secret, token, key, or `.env*` file. Never print one into a log, a PR, a
  Slack message, or a commit message. The secret scan will catch it; do not make it.
- Never point `DATABASE_URL` at production. Never run `npm run build` locally (it runs
  `prisma migrate deploy` first) — use `npx next build`.
- You never need a production credential to do this job. Your own local Postgres, your own
  Google OAuth test client, and your own Meta test app per `CONTRIBUTING.md`.
- **Never test a send path against a real lead.** Sends go to your own test accounts. A
  message that reaches a real person by mistake is the one failure this product cannot
  explain away.
- Every OpenAI call costs money and every Meta call counts against a rate limit. No loop
  retries forever; no prompt is run against every lead "to see what happens".

**Product**
- Anything that changes what the product *does* — when a message goes out, how many, what
  it says, a default, a tier — is Sahil's decision (`followup/PRODUCT_DIRECTION.md`
  territory). Propose it in the PR or in Slack and wait. Correctness, reliability,
  cost and integration mechanics are yours to just do.
- Anything a user *sees* — even one line of an automated message or a notification — is
  design work. `CLAUDE.md` at the repo root and `design-brain/` govern it. The owner must
  always be able to answer: what happened, why, what can I do, what does FollowUp
  recommend, what needs me. AI is invisible capability, never a personality: no sparkle
  icons, no "AI-powered" labels, no bot voice.
- FollowUp is never a spam tool. No default, no copy, no cap and no retry ever makes it
  message a lead more than the product promises. Every automation ships with a stated
  guarantee and a test proving it (Rule 3).

## 8. How we coordinate

- **Slack** is the channel. DM Sahil directly for decisions. `#followup-alerts` carries CI,
  PR activity, hot leads and server errors. Say what you are working on before you start
  it, especially if it crosses Pransh's paths. Sahil has not heard from you since the 14th;
  a one-line "on it" beats silence every time.
- **The team:** Sahil (founder, product, final say), Gautam (UI/UX and frontend), Vansh
  (you), Pransh (backend, database), Dipesh (security, ops, deployment).
- **Sahil's Claude session** works from the branch `claude/followup-demo-to-production-…`
  and opens PRs like any teammate. There are no unattended routines running any more.
- **Vercel:** you are a Member on the North Frame team. Use it for deployment logs, build
  output and preview deployments. Never copy an environment value out of it.

## 9. Every session

**At the start**
1. `git fetch origin main` and branch from it.
2. Read this file. Skim `STATUS.md`, `followup/research/audit/backend-backlog.md` and the
   two 2026-09-16 audit reports named above.
3. Check the open PRs where Vansh is a requested reviewer, and review them.
4. For the task in hand, name the rule it serves (section 2), and check whether a
   `design-brain/decisions/` entry or a `PRODUCT_DIRECTION.md` decision already covers it.

**Before calling anything done**
1. From `followup/`: `npx tsc --noEmit`, `npx eslint src/`, `npx vitest run`,
   `npx next build`.
2. A test for every behavioural change, and proof it would fail without the fix. For
   anything on the send path: break the fix on purpose, watch the test go red, restore it.
3. PR opened with the template filled in honestly — what you actually ran, not what you
   meant to run — and any cross-owner overlap named.
4. The audit or backlog file updated if the work changed what it says.
5. Tell Sahil the PR is up. Do not merge.

**When unsure** — between two readings of a task that would lead to different work, ask
Sahil in Slack. Between two internal approaches, pick one, say why in the PR, and move on.
