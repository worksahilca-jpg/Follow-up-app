# FollowUp — Technical Requirements Document

**Status:** living document, reflects the system as actually deployed as of 2026-09-08.
**Companion docs:** `docs/PRD.md` (product), `docs/BACKEND_SCHEMA.md` (data model detail),
`docs/security-roadmap.md` (the security level system), `PRODUCT_DIRECTION.md` (direction/rules).

---

## 1. System overview

Three independently-deployed services, one shared Postgres database:

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  followup/  (Next.js 16) │◄──────►│  Supabase Postgres        │
│  Vercel project           │        │  (pooled DATABASE_URL,   │
│  - App Router pages       │        │   direct DIRECT_URL      │
│  - /api/* route handlers  │        │   for migrations only)   │
│  - Vercel Cron triggers   │        └──────────────────────────┘
└──────────┬────────────────┘
           │ authenticated HTTPS (shared bearer secret)
           ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│  voice-agent/  (plain     │◄──────►│  OpenAI Realtime API      │
│  Node/Express, own Vercel │        │  (wss, per-call billed)   │
│  project, holds the       │        └──────────────────────────┘
│  live phone-call socket)  │
└──────────┬────────────────┘
           │ WebSocket (Twilio Media Streams)
           ▼
      Twilio (SMS/voice/WhatsApp)
```

A fourth directory, `mobile/`, holds a companion mobile app shell — not detailed here; see its own
README.

**Why three services and not one:** a live phone call needs a persistent bidirectional WebSocket
held open for the call's whole duration, which a normal Next.js request/response route can't do —
see `research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md` for the full reasoning
behind not using a third-party voice-AI platform (Vapi/Retell/Bland) either.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components by default; route handlers under `src/app/api/**` |
| Language | TypeScript, strict | `tsc --noEmit` must be clean before any push |
| ORM / DB | Prisma → PostgreSQL (Supabase) | Pooled `DATABASE_URL` (pgbouncer) for the app, direct `DIRECT_URL` for migrations only |
| Auth | NextAuth (Google OAuth) | 7-day max session age |
| Styling | Tailwind (CSS-variable token layer in `src/app/globals.css`) | See the UI/UX design system doc |
| Fonts | Space Grotesk (display), Inter (body) | Next `font` loaders |
| Testing | Vitest | `src/**/*.test.ts`, run on every PR via GitHub Actions |
| AI | OpenAI (chat completions + Realtime API for voice) | `src/lib/integrations/openai.ts` is the only place prompts live |
| Billing | Stripe | Checkout, portal, webhook-driven subscription status |
| Email | Gmail API, Microsoft Graph (Outlook) | OAuth per user, tokens encrypted at rest |
| SMS/Voice/WhatsApp | Twilio | Signature-verified webhooks throughout |
| Social | Meta Graph API (Instagram + Facebook, one shared app) | Single webhook endpoint, routed by page/account id |
| CRM sync | Follow Up Boss, HubSpot | Polled every 10 min via cron |
| Error monitoring | Sentry (or equivalent) | PII-scrubbed — see `src/lib/sentryScrub.ts` |
| Deploy | Vercel (both `followup/` and `voice-agent/` as separate projects, same team) | Cron via Vercel Cron |

## 3. Multi-tenancy model

One `Business` per tenant. Every `User` belongs to at most one `Business`. Every table that holds
tenant data carries a `businessId` (directly, or transitively via a `leadId`/`conversationId` FK) —
**every query in the codebase must filter by the caller's own `businessId`**, resolved server-side
from the session (`src/lib/session.ts`), never trusted from client input. This is the single most
security-critical invariant in the codebase; it is what the recommended penetration test (task #69)
should test first (`docs/security.md`'s scoping brief names this explicitly).

Two different "identify the business" mechanisms coexist by necessity:

- **Signed-in requests** (dashboard, API calls from the app UI) — resolved from the NextAuth
  session → `User.businessId`.
- **Inbound webhooks** (Twilio, Meta, generic lead webhook) — no session exists, so each carries
  either a per-business secret in the URL path (`Business.twilioSecret`, `Business.webhookSecret`)
  or, for Meta (one shared app-wide webhook URL), an account/page id matched against
  `Business.instagramUserId`/`facebookPageId`.

## 4. Request/data flow — the core loop

```
inbound event (any channel)
   │
   ▼
webhook/API route: verify signature/secret → resolve Business → requireActiveBilling()
   │
   ▼
find-or-create Lead (deduped by channel-specific identity: email, phone, Instagram/
Messenger sender id) → find-or-create Conversation → create Message (idempotent on
externalId where the channel provides one — see docs/BACKEND_SCHEMA.md §Message)
   │
   ├──► acknowledgeNewLead()  — fixed-template reply, same minute, lead's own language
   │
   ├──► AI prospect classification — is this actually a lead? (rejects to FilteredEmail
   │    with a one-click override, never silently discarded)
   │
   └──► scoreAndDraftForLead() — OpenAI scoring (0-100, visible reason) + drafting
              │
              ▼
        automation.ts: per-lead automationTier decides what happens to the draft
              │
      ┌───────┼────────────────┐
      ▼       ▼                ▼
     OFF   ASSISTED         AUTONOMOUS
   (hold)  → assessSendRisk() → risk gate skipped
              │  low        entirely — sends
              ▼  risk        directly
           sendFollowUpToLead()
              │
              ▼
        recordAudit("ai.send" | "ai.hold" | "lead.send", targetType: "lead", ...)
   (surfaced on the lead detail page's Consent & AI activity panel)
```

Every automated send/hold writes an `AuditEvent` row — this is the mechanism behind the trust
panel described in `docs/PRD.md` §6.4, not a separate logging system.

## 5. Security requirements (see `docs/security-roadmap.md` for the full level breakdown)

- **Webhook authentication**: Twilio requests are validated against `X-Twilio-Signature`
  (`validateTwilioRequestSignature`, HMAC-SHA1 over the canonical URL + sorted params, checked
  across every host spelling the apex/www redirect could have signed for — see task #52's fix).
  Meta requests are validated against `X-Hub-Signature-256`. Generic lead/outbound webhooks use a
  per-business random secret in the URL path.
- **Credential encryption at rest**: every stored OAuth token / API key goes through
  `src/lib/db.ts`'s `ENCRYPTED_FIELDS` wrapper — verified (this session's audit pass) to cover every
  newer integration (Outlook tokens, CRM API keys) with no gaps found.
- **Least-privilege DB role**: the app is meant to run under a scoped Postgres role
  (`followup_app`), not the Supabase admin role — code/migration ready, production cutover pending
  (task #71).
- **Rate limiting**: shared-cost actions (Gmail sync, AI regeneration) are capped per business via
  `RateLimitHit`, since their API cost comes out of one shared platform key, not billed
  per-business.
- **Input validation**: every API route body is validated against a Zod schema
  (`src/lib/validation.ts`'s `parseJsonBody`) before touching the DB.
- **CSRF on OAuth callbacks**: Instagram and Facebook Connect flows use a random `state` +
  httpOnly-cookie pattern (correct). Gmail and Outlook's OAuth callbacks do **not** yet validate
  `state` against a per-request token — a confirmed, not-yet-fixed gap
  (`research/audit/2026-09-08-newer-surface-audit.md` finding #4).
- **Service-to-service auth**: the voice-agent bridge (no DB access of its own) authenticates to
  the main app via a shared bearer secret (`VOICE_AGENT_CALLBACK_SECRET`) on both the outbound
  transcript-post path and, as of this pass, an inbound pre-authorization check
  (`GET /api/twilio/voice-agent-auth/[secret]`) before it opens any billed OpenAI session — closing
  `research/audit/2026-09-08-newer-surface-audit.md` finding #1 (previously: any non-empty secret
  opened a real, billed session with no validation at all).
- **Idempotency on webhook redelivery**: any provider that redelivers on non-2xx (Meta explicitly
  does; Twilio's retry behavior is similar) needs its message-creation path to be safe against being
  called twice for the same event. The pattern used throughout: a unique `externalId` column +
  either `prisma.*.upsert` or a plain `create` with the unique-constraint violation (`P2002`) caught
  and treated as "already recorded" — never a separate `findUnique`-then-`create`, which races.
- **Concurrency-safe atomic writes** for anything that must fire at most once under concurrent
  triggers (the rapid-engagement notification dedup, the missed-call text-back cooldown, a Ponds
  lead claim): a single conditional `updateMany` (`WHERE null OR stale`), never a
  read-then-decide-then-write pair.

## 6. AI/prompt requirements (Rule 3 made concrete)

All prompts live in `src/lib/integrations/openai.ts`. Non-negotiable, tested invariants:

- **No invented facts.** The drafting prompt instructs the model never to state a fact, number, or
  commitment absent from the conversation; the risk-assessment prompt treats an invented specific as
  never `"low"` risk. Tested in `src/lib/__tests__/prompts.test.ts`.
- **Language matching.** Every model call that produces text a lead will see (drafting, the fixed
  acknowledgement translator, the voice agent's spoken instructions) is explicitly instructed to
  reply in the lead's own language, never default to English. Tested for the drafting path and the
  translator; **not yet verified against a real live non-English conversation** (see `docs/PRD.md`
  §8 — a testing gap, not a prompt gap).
- **Risk gate is the last check before an unattended send**, run only immediately before an
  automated send on the specific drafted message — separate from lead scoring (urgency) and prospect
  classification (is this a lead at all).
- **Degrade safely, never throw into a user-facing path**: the fixed-text localizer falls back to
  the original (English) text if the API call fails, or if the model's output ballooned far beyond
  the template length (a sign it "helped" instead of translating) — tested.

## 7. Testing & CI requirements

- **Unit/integration tests**: Vitest, colocated as `src/**/*.test.ts` (or `__tests__/*.test.ts`
  directories). Convention: mock only the modules that reach the network/DB (`@/lib/db`,
  provider SDKs); exercise real logic otherwise.
- **CI gate** (GitHub Actions, "App — typecheck, lint, build, audit"): `tsc --noEmit`, `eslint`,
  `next build`, `npm audit` — all must pass before merge. Two additional fast checks run in
  parallel: "Voice bridge — install + syntax" (the separate `voice-agent/` project, no build step)
  and "Secret scan (gitleaks)".
- **Before every push, locally**: `tsc --noEmit`, targeted `eslint` on changed files, full
  `vitest run`, and a `next build` — in that order, cheapest first. A push that turns CI red costs a
  full review cycle; local verification is not optional.

## 8. Known technical debt / open findings

Tracked in `research/audit/*.md` (dated passes). As of the most recent pass
(`2026-09-08-newer-surface-audit.md`):

| Finding | Severity | Status |
|---|---|---|
| Voice-agent bridge WebSocket had no authentication | Critical | Fixed (this pass) |
| CRM sync (Follow Up Boss/HubSpot) never persists its pagination cursor — permanently stalls past ~500 contacts | High | Open |
| Instagram/Messenger/Lead-Ads inbound webhook had no idempotency guard against Meta redelivery | Medium-high | Fixed (this pass) |
| Outlook (and pre-existing Gmail) OAuth callback has no CSRF `state` validation | Medium | Open |

Earlier audit passes (`2026-09-05-code-audit.md` and this session's task #37/#41) are resolved;
see their fix commits for detail.

## 9. Environments & configuration

- **`followup/`**: `.env` — `DATABASE_URL`, `DIRECT_URL`, NextAuth secrets, Google/Microsoft/Meta/
  Twilio/Stripe/OpenAI/Sentry keys, `VOICE_AGENT_WS_URL`, `VOICE_AGENT_CALLBACK_SECRET`,
  `CRON_SECRET`.
- **`voice-agent/`**: separate Vercel project, separate env — `OPENAI_API_KEY`,
  `FOLLOWUP_APP_URL`, `VOICE_AGENT_CALLBACK_SECRET` (shared value with the main app),
  `OPENAI_REALTIME_MODEL` (optional).
- Cron jobs (Vercel Cron, authenticated via `CRON_SECRET`): Gmail sync, Outlook sync, CRM sync,
  the hourly automation/silence check, the weekly digest.

## 10. Non-functional requirements

- **Data ownership (Rule 2)**: nothing about a lead's history, AI reasoning, or outcome is ever
  computed live from a third party on page load — always a persisted row, read back from FollowUp's
  own DB.
- **Multi-language support** at the model-prompt layer is a hard requirement for every
  lead-facing text generation path, not an English-first feature with translation bolted on later.
- **Fail closed, not open**, on every authentication/authorization check — a missing secret, a
  failed lookup, or an unexpected error should reject the action, never silently allow it (the
  voice-agent-auth fix in §5 is the canonical recent example).
- **Idempotent by construction** wherever an external system can redeliver the same event twice —
  never rely on "it probably won't happen twice."
