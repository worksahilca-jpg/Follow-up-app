# Team briefs for Claude Code

One file per teammate. Each is the knowledge Sahil's own Claude sessions carry — what
FollowUp is, why, what is built, how, that person's role, and the rules — written down so
every Claude on the team starts from the same place.

| File | For |
|---|---|
| `pransh.md` | Pransh — backend |
| `vansh.md` | Vansh — AI, automation and integrations |

More follow, one per person.

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
any other file — the point is that all five stay true, not that they stay still.
