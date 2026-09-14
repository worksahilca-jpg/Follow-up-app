# Contributing to FollowUp

Five people, one repo, `main` protected. This is the actual workflow — not aspirational, this
is what's enforced.

## Branching

- Never work directly on `main`. It's protected: pull request required, 1 approval required, CI
  must pass. This applies to everyone, including Sahil — there's no bypass toggle enabled.
- Branch off `main` for whatever you're doing: `<yourname>/<short-description>`, e.g.
  `gautam/fix-mobile-nav`, `pransh/lead-pagination-cursor`. Keep branches scoped to one thing —
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
  whoever's free. A UI change needs Gautam or Sahil's eyes, not a backend-only review.
- **CI must be green**: typecheck, lint, build, and the test suite. A red check is never merged
  around — fix it or explain why it's not your PR's failure (see below).
- If you're touching a file someone else's area also touches (the Pransh/Vansh integrations
  overlap, the Sahil/Gautam frontend overlap — see `TEAM.md`), say so explicitly in the PR
  description so it isn't a surprise in review.

## What CI failing actually means

- If your own change broke it: fix it before asking for review.
- If a check was already red on `main` before your branch existed: say so in the PR, don't try
  to silently work around it (no disabling the test, no empty commits to "retry" — actually
  understand why and fix it, or flag it in `#followup-alerts`/to Dipesh if it's infra-level).

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
