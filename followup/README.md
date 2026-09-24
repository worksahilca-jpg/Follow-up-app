# FollowUp

A business should never lose a lead because nobody followed up — not at all,
not in time, not correctly. FollowUp captures leads from every channel a small
business actually gets them on, keeps the whole conversation in one place,
scores intent, drafts and (where permitted) sends the follow-up, and escalates
to a human the moment judgment is required.

`PRODUCT_DIRECTION.md` is canonical on what this is for and why. Read it before
proposing a feature.

## What's real

This is a live multi-tenant SaaS, not a demo. Every capability below runs
against real services and a real Postgres database.

**Lead capture** — Gmail (OAuth, with push so new mail lands in seconds rather
than on the ten-minute tick), Outlook / Microsoft 365, Twilio SMS, WhatsApp,
inbound calls with voicemail transcription, Instagram DMs, Facebook Messenger
and Lead Ads, an embeddable website widget, a generic inbound webhook, CSV
import, and one-way import from Follow Up Boss and HubSpot for the CRM a
business already runs.

**Judgment** — intent scoring and reply drafting via OpenAI structured
outputs, a rescue score for leads about to be lost, multilingual voicemail
transcription (auto-detected, not English-only), and a risk check before any
AI-drafted reply is allowed to send.

**Autonomy, in tiers** — per-lead Assisted (you approve each send) or
Autonomous, plus workflow sequences and a silence-triggered rule. A live AI
voice agent answers calls through a separate always-on bridge (`../voice-agent`),
because a phone call needs a persistent connection a serverless route can't hold.

**Trust guarantees** — credentials encrypted at rest, mandatory Twilio
signature verification, an audit trail, rate limits, admin-only account
settings, and automation that stops itself the moment a lead replies. These are
covered by tests, not just intentions.

**Billing** — Stripe Free/Plus/Pro tiers with a voice add-on, including the
lead cap and channel gating the Free tier enforces.

`src/lib/demo-data.ts` is no longer the app's data source — the authenticated
app reads real rows through `src/lib/leads-data.ts`. That file survives for its
formatting helpers (`formatCurrency`, `formatDate`, `getGreeting`) and the
landing page's example content.

## What you need to run it

Copy `.env.example` to `.env` — it documents every key and why it exists.
There is no zero-config demo mode: the app needs a database and a login
provider before anything past the landing page will render.

**Required to boot**

| Key | For |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Postgres, pooled and direct (Supabase's 6543 / 5432 URLs). `DIRECT_URL` is used only by `prisma migrate`, which can't run through a pooler. |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Session signing and callback base |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in (the only login method) |
| `TOKEN_ENCRYPTION_KEY` | Encrypts OAuth and channel tokens at rest. Never rotate without re-encrypting — rows under the old key become unreadable. |
| `OPENAI_API_KEY` | Scoring, drafting, transcription |

**Per capability, add as you turn each one on**

| Keys | Turns on |
|---|---|
| `GOOGLE_REDIRECT_URI`, `GMAIL_PUSH_TOPIC`, `GMAIL_PUSH_SECRET` | Gmail capture + instant push |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` | Outlook / Microsoft 365 |
| `INSTAGRAM_APP_ID`/`_SECRET`, `FACEBOOK_APP_ID`/`_SECRET` | One-click Instagram and Facebook connect |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Billing |
| `CRON_SECRET` | The scheduled jobs in `vercel.json`. Without it every cron route rejects every request, including Vercel's own. |
| `VOICE_AGENT_WS_URL`, `VOICE_AGENT_CALLBACK_SECRET` | The live voice agent bridge |
| `PLATFORM_ADMIN_EMAILS` | Founder-only `/admin`. Unset means nobody — it fails closed on purpose. |
| `ALLOWED_EMAILS` | Restricts who may sign in at all. Empty means anyone can sign up as their own tenant. |
| `SLACK_WEBHOOK_URL`, `SENTRY_*` | Team notifications, error tracking |

**Twilio is not in this table on purpose.** SMS, WhatsApp and voice credentials
are per-business, entered in Settings and stored encrypted in the database —
not environment variables — because each tenant brings their own number.

## Running it

```bash
npm install
npx prisma migrate deploy   # or `migrate dev` against a scratch database
npm run dev
```

Then open http://localhost:3000.

## Deploying

A standard Next.js app on Vercel — import the repo, set the same environment
variables in Project Settings, and the scheduled jobs in `vercel.json` start
running once `CRON_SECRET` is set. `npm run build` applies pending migrations
first. The voice bridge deploys separately from `../voice-agent`.

## The AI office (founder-only, not a customer feature)

`.claude/agents/` describes five lanes — manager, product/UX, frontend/3D,
backend/AI, QA/security — but they only exist while someone has a Claude Code
session open. `/admin/office` is the part that survives the session: a roster,
a record of every shift worked, and what each one cost.

- **Who sees it**: only `PLATFORM_ADMIN_EMAILS`, the same founder-only gate as
  the rest of `/admin` (`src/lib/platformAdmin.ts`) — not a per-business
  TeamRole. Unset means nobody, and an unauthorized visitor gets a 404.
- **When it runs**: Monday 06:00 UTC via `/api/cron/office` (see `vercel.json`),
  plus **Run now** on any staffed desk.
- **What's staffed today**: one desk, `product-ux-agent` — it reads the product
  feedback nobody has time to read and reports the themes in people's own
  words. The other four are on the floor with `live: false` in
  `src/lib/office/roles.ts`; a desk opens when it has a runner, not before. A
  competitor sweep run from model memory produces confident, stale nonsense, so
  that work waits for a runner that can actually fetch a page.
- **What stops it**: a per-desk daily spend ceiling, one shift per desk at a
  time, and a shift with nothing new to read costs nothing and calls no model.
  All of it is pinned in `src/lib/__tests__/office.test.ts`.

Prompts carry what a customer *wrote*, never who wrote it — see the note at the
top of `src/lib/office/context.ts`.

## Project structure

```
src/app/page.tsx                 landing page
src/app/(app)/                   the authenticated app (dashboard, leads,
                                 pipeline, workflows, analytics, settings)
src/app/admin/                   founder-only platform dashboard
src/app/admin/office             the AI office floor
src/app/api/                     every route: capture, integrations, crons,
                                 billing, webhooks
src/lib/integrations/gmail.ts    Gmail OAuth, sync, send, calendar
src/lib/integrations/outlook.ts  Microsoft 365 equivalent
src/lib/integrations/openai.ts   scoring, drafting, transcription
src/lib/twilio.ts                SMS, WhatsApp, voice, signature checks
src/lib/crm/                     Follow Up Boss + HubSpot import
src/lib/automation.ts            the silence-triggered send path
src/lib/sequences.ts             workflow steps
src/lib/rescue.ts                what the owner is about to lose
src/lib/office/                  roster, context packs, runner, floor view
src/lib/leads-data.ts            the app's real data access
prisma/schema.prisma             production data model
../voice-agent/                  the live-call bridge (separate deployment)
```

## Where the rest of the knowledge lives

- `PRODUCT_DIRECTION.md` — what to build and why. Wins over everything else.
- `../README.md` — the repository map: what the four top-level directories are,
  and what to read first if you're new here.
- `../STATUS.md` — the wider operational checklist: what's open, what's
  waiting on the founder.
- `../design-brain/` — the design system's own memory: principles, decisions,
  what was rejected and why. Read before any UI work.
- `research/` — what's already been investigated. **Check `research/README.md`
  before re-researching**; it indexes all of it.
- `docs/` — how to *do* things: the PRD/TRD/schema reference, the one-time
  setup guides for each capability, the verification packs, and security.
  `docs/README.md` groups them by when you'd need them.
