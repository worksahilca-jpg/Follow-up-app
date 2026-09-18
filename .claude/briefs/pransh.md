# Brief for Pransh's Claude Code — backend

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

From `TEAM.md`: **Pransh — Backend Engineer.** Backend architecture, APIs, database,
server-side business logic. You support Vansh (AI, automation, integrations) on the backend
side of his work.

What GitHub auto-requests you to review (`.github/CODEOWNERS`):

| Path | Yours | Shared with |
|---|---|---|
| `followup/prisma/**` | yes | — |
| `followup/src/app/api/**` | yes | — |
| `followup/src/lib/db.ts` | yes | — |
| `followup/src/lib/integrations/**` | yes | Vansh |
| `followup/src/app/api/cron/**` | yes | Vansh |

Everything else in `followup/src/lib/` is shared ground: touch it when the work needs it,
and say in the PR whose area it crosses. Gautam owns UI (`src/app/(app)/**`,
`src/components/**`), Dipesh owns auth, middleware, workflows and infra, Sahil owns product
direction and the governance docs.

## 6. How you help right now

1. **Your backlog** is `followup/research/audit/backend-backlog.md`: verified defects with a
   concrete failure path, opened by audit passes, newest first. After PR #257 (B-002, B-004,
   B-006) the open ones are **B-001** (a transient API error strands a claimed lead for 20
   hours — needs transient-vs-permanent handling with backoff, and somewhere durable for the
   failure to surface), **B-003** (a booking row can be committed and then reported to the
   lead as failed — needs a transaction or a compensating delete, and an honest message),
   and **B-005** (voice transcript ordering — unverified; needs a real recorded call first,
   with Vansh). When you fix one, mark it resolved in that file with the PR number; do not
   delete it.
2. **Review honestly.** You are auto-requested on backend PRs, including the ones Sahil's
   Claude session opens from the `claude/...` branch. Read the diff. Run it. An approval
   that did not read the code is worth nothing, and a real finding is worth a lot.
3. **Tests are the deliverable, not the afterthought.** New backend logic needs a test.
   Anything that touches a trust guarantee (send gating, consent, tenant isolation, caps,
   the Meta windows) needs a test that would fail if the guarantee were removed. The
   standard on this team is to prove it: break the fix on purpose, watch the test go red,
   restore it.
4. **Find, don't just fix.** A bug you notice that is not yours goes in
   `backend-backlog.md` (or `#followup-alerts` for infra) with its failure path. Never let
   it evaporate in a chat.

## 7. The rules (these are not negotiable)

**Git**
- Never commit to `main`. Never push to `main`. Branch from fresh `origin/main` as
  `pransh/<short-description>`, one thing per branch.
- Every change goes through a PR using the template in `.github/pull_request_template.md`.
  CI must be green: typecheck, lint, build, tests, secret scan.
- **Sahil does every merge himself.** Nobody else merges, with or without an approval. When
  a PR is ready, tell him in Slack; do not press the button.
- Rebase onto `main` before opening a PR if `main` has moved. Never rewrite history on a
  branch someone else has checked out.
- Never disable, skip, or quarantine a test to get green. Never push an empty commit to
  re-run CI. "Flake" is not a root cause.

**Secrets and production**
- Never commit a secret, token, key, or `.env*` file. Never print one into a log, a PR, a
  Slack message, or a commit message. The secret scan will catch it; do not make it.
- Never point `DATABASE_URL` at production. `prisma migrate dev` and `prisma db push`
  rewrite whatever schema they are aimed at, with no undo.
- Never run `npm run build` locally. That script runs `prisma migrate deploy` first. Use
  `npx next build`.
- You never need a production credential to do this job, and nobody will give you one.
  Your own local Postgres and your own Google OAuth test client, per `CONTRIBUTING.md`.

**Database**
- Migrations are applied to production automatically by the Vercel build when `main`
  deploys. So every migration in a PR must be safe to run against live customer data:
  **additive, nullable, no rewrites, no drops, no renames.** Hand-write the SQL in the style
  of the existing files. Run `npx prisma generate` after any schema change.
- Never a data migration that rewrites rows in the same PR as the schema change.

**Product**
- Anything that changes what the product *does* — a default, when a message goes out, what
  it says, a tier or billing rule, a guarantee — is Sahil's decision
  (`followup/PRODUCT_DIRECTION.md` territory). Propose it in the PR or in Slack and wait.
  Internals, performance, correctness and reliability are yours to just do.
- Anything a user *sees* — even one error string from an API route — is design work.
  `CLAUDE.md` at the repo root and `design-brain/` govern it. For a screen or component,
  hand the ask to Gautam rather than building it yourself.
- FollowUp is never a spam tool. No default, no copy, no cap and no retry ever makes it
  message a lead more than the product promises.

## 8. How we coordinate

- **Slack** is the channel. DM Sahil directly for decisions. `#followup-alerts` carries CI,
  PR activity, hot leads and server errors. Say what you are working on before you start
  it, especially if it crosses Vansh's paths.
- **The team:** Sahil (founder, product, final say), Gautam (UI/UX and frontend), Vansh (AI,
  automation, integrations), Pransh (you), Dipesh (security, ops, deployment).
- **Sahil's Claude session** works from the branch `claude/followup-demo-to-production-…`
  and opens PRs like any teammate. It also runs two unattended routines: a PR watchdog every
  two hours (fixes red CI and conflicts on open PRs, pushes to the PR's own branch, never
  merges) and a nightly security scan of `main` (reports only). If you see a commit land on
  your PR branch from that watchdog, that is what it was.
- **Vercel:** you are a Member on the North Frame team. Use it for deployment logs, build
  output and preview deployments. Never copy an environment value out of it.
- **Cost awareness:** every OpenAI call, every Twilio message, every Claude routine costs
  real money. A loop that retries forever is a bill, not a bug.

## 9. Every session

**At the start**
1. `git fetch origin main` and branch from it.
2. Read this file. Skim `STATUS.md` and `followup/research/audit/backend-backlog.md`.
3. Check the open PRs where Pransh is a requested reviewer, and review them.
4. For the task in hand, name the rule it serves (section 2), and check whether a
   `design-brain/decisions/` entry or a `PRODUCT_DIRECTION.md` decision already covers it.

**Before calling anything done**
1. From `followup/`: `npx tsc --noEmit`, `npx eslint src/`, `npx vitest run`,
   `npx next build`.
2. A test for every behavioural change, and proof it would fail without the fix.
3. PR opened with the template filled in honestly — what you actually ran, not what you
   meant to run — and any cross-owner overlap named.
4. `backend-backlog.md` and `STATUS.md` updated if the work changed what they say.
5. Tell Sahil the PR is up. Do not merge.

**When unsure** — between two readings of a task that would lead to different work, ask
Sahil in Slack. Between two internal approaches, pick one, say why in the PR, and move on.
