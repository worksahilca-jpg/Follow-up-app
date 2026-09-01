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

## Project structure

```
src/app/page.tsx                 landing page
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
