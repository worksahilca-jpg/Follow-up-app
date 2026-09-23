# FollowUp — Team structure

**Last updated:** 2026-09-23. This is the durable reference for who owns what. `STATUS.md`
tracks what's open right now; this file tracks who's responsible for which area, and doesn't
change often. If the two ever disagree on who owns something, this file wins.

---

## Sahil — Founder

Everything. Product, engineering, design decisions, and the final say on all of it.

FollowUp is a solo build. Where `CONTRIBUTING.md` or another doc describes a review step
between two people, that step is Sahil reviewing his own work or an agent's — the branch and
PR workflow still applies, because it is what keeps `main` deployable and gives every change
a record, not because someone else is waiting to approve it.

## Beta testers

Not contributors. They use the product and report back; they have no repository, Vercel or
infrastructure access, and never have had.

| Tester | Since |
|---|---|
| Manoj | 2026-09-19 |
| Harsh | 2026-09-23 |

Testers are let in through `ALLOWED_EMAILS` or an approved `AccessRequest` on `/admin`
(`followup/src/lib/auth.ts`). Sign-up is closed to everyone else.

---

## Git / code ownership

`.github/CODEOWNERS` is the enforced version: every path is owned by `@worksahilca-jpg`.

## History

Between 2026-09-14 and 2026-09-23 the project was staffed as a five-person team — Gautam
(UI/UX and frontend), Vansh (AI automation and integrations), Pransh (backend), and Dipesh
(security and operations), alongside Sahil. That arrangement ended on 2026-09-23. Their
ownership entries were removed from `CODEOWNERS` on the same day.

Kept as a record rather than deleted: `CONTRIBUTING.md`, `design-brain/` and several commit
messages still refer to that team, and a reader who meets those references deserves to know
what they describe instead of finding a gap.
