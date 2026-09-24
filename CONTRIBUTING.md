# Contributing to FollowUp

One repo, `main` protected. This is the actual workflow — not aspirational, this is what's
enforced by branch protection and CI.

FollowUp is a solo build today (`TEAM.md`), so in practice the review step is Sahil reviewing
his own work or an agent's. The workflow below is still followed to the letter, because it is
what keeps `main` deployable and gives every change a record — and because it is written to
work unchanged the day a second person joins. Where it says "the reviewer", that is whoever
owns the area in `TEAM.md`.

## Local setup

You do not need any production credential to work on this repo, and you should never be given
one. Config is not in the repo by design — `.env*` is gitignored — so you supply your own.

```bash
cd followup
cp .env.local.example .env.local     # every value in it is fake and points at your own machine
npm install
npx prisma generate
npx next typegen                     # generates .next/types that tsc needs; a fresh clone has none
```

That's it for writing code and running the checks. The test suite mocks Prisma entirely
(`vi.mock("@/lib/db")` at the top of any test file), so it opens no database connection and
needs no config at all — verified by deleting the env file and running the full gate.

If you want to click through the app in a browser you need two more things, both your own:

- **A database.** `docker run -d --name followup-db -e POSTGRES_PASSWORD=localdev -p 5432:5432
  postgres:16`, then `npx prisma migrate dev`. `.env.local.example` already points at it.
- **A Google OAuth client.** Sign-in is Google-only — no password login, no dev bypass
  (`src/lib/auth.ts`) — so without one you cannot log in. Make your own free client in testing
  mode; `.env.local.example` lists the two redirect URIs it needs. It is yours, not the
  company's.

Read the comments in `.env.local.example` before filling anything in. Each blank says what
goes dark while it's blank, because a feature that's off for want of a key looks identical to
a feature that's broken.

**Two things that are never okay**, regardless of who asks:

- Pointing `DATABASE_URL` at production. `prisma migrate dev` and `prisma db push` rewrite the
  schema of whatever they're aimed at, on live customer data, with no undo.
- Running `npm run build`. That script runs `prisma migrate deploy` first, against whatever
  `DATABASE_URL` is set. Use `npx next build`.

## Branching

- Never work directly on `main`. It's protected: pull request required, 1 approval required, CI
  must pass. This applies to everyone, including Sahil — there's no bypass toggle enabled.
- Branch off `main` for whatever you're doing: `<yourname>/<short-description>`, e.g.
  `sahil/fix-mobile-nav`, `sahil/lead-pagination-cursor`. Keep branches scoped to one thing —
  a PR that mixes an unrelated fix with your actual task is harder to review and harder to
  revert if something's wrong.
- Rebase onto `main` before opening a PR if `main` has moved since you branched — don't let a PR
  sit stale for days without picking up what's merged since.

## Pull requests

- Open a PR as soon as the work is ready for review — don't sit on a finished branch.
- CODEOWNERS (`.github/CODEOWNERS`) auto-requests the right reviewer based on which files you
  touched. If it doesn't request the right person (e.g. it's still on a placeholder username),
  tag them manually.
- **1 approval minimum**, from someone who actually owns that area per `TEAM.md` — not just
  whoever's free. A UI change needs the eyes of someone who owns UI, not a backend-only review.
  Today `CODEOWNERS` routes every path to `@worksahilca-jpg`; as the team grows, it is the file
  that changes, not this rule.
- **CI must be green**: typecheck, lint, build, and the test suite. A red check is never merged
  around — fix it or explain why it's not your PR's failure (see below).
- **One check fails on every PR and always will**: `Vercel – followup-voice-agent` reports
  "Deployment was blocked". That project is deliberately parked. The check that matters is
  `Vercel – follow-up-app`. Nobody should spend an afternoon on this one — it is expected.
- If you're touching a file that another area also owns — the integrations layer and the
  backend overlap most often, see `TEAM.md` — say so explicitly in the PR description so it
  isn't a surprise in review.

## What CI failing actually means

- If your own change broke it: fix it before asking for review.
- If a check was already red on `main` before your branch existed: say so in the PR, don't try
  to silently work around it (no disabling the test, no empty commits to "retry" — actually
  understand why and fix it, or flag it in `#followup-alerts` if it's infra-level).

## Testing — everyone's job, not QA's alone

- Run `npx tsc --noEmit`, `npx eslint`, and `npx vitest run` locally before opening a PR — CI
  will catch it anyway, but a red CI run costs everyone else time reviewing a broken diff.
- New backend logic needs a test. New UI doesn't always need one, but anything touching trust
  guarantees (auto-send gating, consent, data isolation between businesses) does, no exceptions.
- Found a bug that isn't yours to fix right now? File it — don't just mention it in passing and
  let it evaporate. A quick note in `#followup-alerts` or a GitHub issue is enough.

## Design / UI work specifically

Read `CLAUDE.md` and `design-brain/README.md` before starting any visual or UX change — this
isn't optional for UI work, it's how the same rejected idea doesn't get proposed three times by
three different people. Check `design-brain/decisions/rejected.md` and `approved.md` first.

## Ownership

See `TEAM.md` for the full breakdown of who owns what, and `.github/CODEOWNERS` for how that's
actually enforced in review requests.
