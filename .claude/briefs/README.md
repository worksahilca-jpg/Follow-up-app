# Team briefs for Claude Code

One file per teammate. Each is the knowledge Sahil's own Claude sessions carry — what
FollowUp is, why, what is built, how, that person's role, and the rules — written down so
every Claude on the team starts from the same place.

This is the fastest way to onboard someone. A new teammate's first session already knows the
product, the constraints and their own area, instead of spending a week rediscovering it.

## What's here

| File | Role it covers |
|---|---|
| `pransh.md` | Backend |
| `vansh.md` | AI, automation and integrations |

**These two are written for named people who are no longer on the project** (see `TEAM.md`
— that team ended 2026-09-23). They are kept because the *role* content is still accurate and
still useful: they are the working templates for the next backend hire and the next
integrations hire. Read them as "the brief for whoever owns this area", not as a claim about
who is here.

## Adding one for a new teammate

Copy the closest existing brief, then correct three things:

1. **The name and role** in the heading and the opening paragraph.
2. **The area they own** — it must match `TEAM.md` and `.github/CODEOWNERS`, which are the
   authority. If the brief and those disagree, those win and the brief is the bug.
3. **What's true now** — every brief names a date it was written. Re-check the claims about
   what's built and what's blocked against `../../STATUS.md` before handing it over. A brief
   that confidently describes a feature that shipped three weeks ago teaches the wrong thing
   with full confidence, which is worse than teaching nothing.

Keep the pointer-not-summary discipline: a brief should name the files to read, not restate
them. Restated docs go stale silently; pointers don't.

## How a teammate loads theirs

Claude Code auto-loads a `CLAUDE.local.md` at the repo root and never commits it (it is in
`.gitignore`). Create it once with a single line pointing at your brief:

```
@.claude/briefs/<yourname>.md
```

That is all. Every session in this repo then starts with the brief, on top of `CLAUDE.md`
and `followup/AGENTS.md`, which load on their own.

## Who edits these

Sahil owns them. A teammate who finds a brief wrong or stale opens a PR against it, same as
any other file — the point is that they stay true, not that they stay still.
