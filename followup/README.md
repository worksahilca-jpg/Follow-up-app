# FollowUp

AI sales follow-up teammate: watches your sales conversations and tells you
who to follow up with today, why, and what to say.

## What's actually working right now

Everything in the UI is fully working **against demo data** — no setup needed:

- Landing page
- Dashboard (today's follow-ups, stats, cold leads, weekly report)
- Leads list with filters + search
- Lead detail page (score breakdown, conversation history, AI-drafted message
  you can edit/regenerate/send)
- Pipeline view with stage totals + weighted value
- Settings (integrations, automation rules, team, billing UI)

The "Send email", "Connect Gmail", "Send now" etc. buttons are demo
interactions — they update the screen but don't call real external services.

## What needs real credentials to go live

| Feature | Needs | File to edit |
|---|---|---|
| Reading your real inbox | Google Cloud OAuth credentials | `src/lib/integrations/gmail.ts` |
| Sending real emails | Same Gmail credentials | `src/lib/integrations/gmail.ts` |
| Real AI scoring & message drafting | OpenAI API key | `src/lib/integrations/openai.ts` |
| Persisting leads/users for real | A Postgres database (e.g. Supabase) | `prisma/schema.prisma`, then run `npx prisma migrate dev` |
| Real login | NextAuth secret + Google OAuth | (not yet wired — currently no auth gate) |

Every real integration is written as a small service file with the same
function signatures as the mock version, so swapping in real API calls
doesn't require touching any page or component.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — the demo works immediately with no `.env`
file. Copy `.env.example` to `.env` and fill in values only once you're ready
to connect real Gmail/OpenAI/a database.

## Deploying

This is a standard Next.js app — push it to a GitHub repo and import it into
Vercel. Add the same environment variables from `.env.example` in the
Vercel project settings.

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
src/app/admin/office             the AI office floor (founder-only)
src/lib/office/                  roster, context packs, runner, floor view
src/app/(app)/dashboard          main daily briefing
src/app/(app)/leads              leads list + detail pages
src/app/(app)/pipeline           pipeline view
src/app/(app)/settings           integrations, automation, team, billing
src/lib/demo-data.ts             10+ realistic demo leads + helpers
src/lib/types.ts                 shared TypeScript types
src/lib/integrations/gmail.ts    Gmail service abstraction (mocked)
src/lib/integrations/openai.ts   AI scoring/drafting abstraction (mocked)
prisma/schema.prisma             full production data model
```
