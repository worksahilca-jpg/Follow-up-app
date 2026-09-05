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

Settings' "Connect Gmail", "Sync now", and "Scan spam" buttons call the real
Gmail integration directly — there's no demo branch in that code path, so the
moment real Google OAuth credentials exist they will genuinely try to reach
Google. Other buttons elsewhere in the UI (e.g. "Send email" on a lead) were
not re-audited against this and may still be demo interactions — see
`research/integrations/gmail.md` for exactly what was and wasn't checked.

## What needs real credentials to go live

| Feature | Needs | File to edit |
|---|---|---|
| Reading your real inbox | A Google Cloud project + OAuth verification — the code itself is already real, see `research/integrations/gmail.md` | `src/lib/integrations/gmail.ts` (no code changes needed) |
| Sending real emails | Same Gmail credentials | `src/lib/integrations/gmail.ts` (no code changes needed) |
| Real AI scoring & message drafting | OpenAI API key | `src/lib/integrations/openai.ts` |
| Persisting leads/users for real | A Postgres database (e.g. Supabase) | `prisma/schema.prisma`, then run `npx prisma migrate dev` |
| Real login | NextAuth secret + Google OAuth | (not yet wired — currently no auth gate) |

Gmail is the one integration confirmed to already be a complete, real
implementation rather than a mock (see `research/integrations/gmail.md`) —
going live for it is a provisioning + Google-review problem, not a coding
one. The other rows above haven't been re-verified the same way yet; treat
"file to edit" for those as the working assumption, not a confirmed fact.

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
src/lib/integrations/gmail.ts    real Gmail + Calendar integration (needs Google Cloud credentials, not code)
src/lib/integrations/openai.ts   AI scoring/drafting abstraction (mocked)
prisma/schema.prisma             full production data model
research/                        production-readiness + market/customer findings (see research/README.md)
```
