# FollowUp's AI team

An org chart for the custom agents in this repo, not just a tool list.

**Before proposing or building anything, check it against `../../PRODUCT_DIRECTION.md`** —
the CEO's six standing rules for 20-year survival (vertical depth, owning the data,
trust-as-a-feature, not building free platform parity, rising autonomy, moat vs.
table-stakes). State in one line which rule a feature serves; if none, flag it as
short-term/table-stakes rather than retrofitting a justification.

```
CEO (you)
  │
  ▼
manager-agent  ──  breaks a goal into workstreams and delegates
  │
  ├── product-ux-agent     copy, positioning, onboarding wording, UX/flow decisions
  │                        + the competitor/customer research behind them
  ├── frontend-3d-agent    all UI implementation — authenticated app, landing page,
  │                        3D/motion work
  ├── backend-ai-agent     API routes, schema, integrations, AI scoring/drafting/
  │                        voice agent, automation
  └── qa-security-agent    code audits, security review, trust-guarantee tests,
                           production-readiness/compliance research per integration
```

Five lanes, not four, is the ceiling for now — a **DevOps & Release Agent** gets added
once deployment/release management is enough of its own job to need a dedicated owner.
Don't add it preemptively; fold release concerns into `backend-ai-agent` until then.

## Talking to the team
- **A specific, scoped task** ("fix this route", "restyle this card", "research Twilio's SMS compliance rules")? Address that specialist directly.
- **A goal or initiative that spans more than one of them** ("get us ready to onboard real customers", "check whether our pricing still holds up")? Address **manager-agent** — it delegates, sequences dependent work, and reports back one synthesized answer instead of you coordinating each agent by hand.

## Research lives inside the lane that acts on it
There's no separate research specialist anymore — research is step one of the job for whichever lane owns the decision it feeds, so there's no hand-off to lose:
- `product-ux-agent` researches competitors, category trends, ICP, and customer pain points itself, then turns findings straight into copy and positioning — writes to `research/market/` and `research/customers/`.
- `qa-security-agent` researches what a real integration requires to go live (API verification, compliance, rate limits) as part of deciding whether it's safe to ship, then hands `backend-ai-agent` the implementation brief — writes to `research/integrations/` and `research/audit/`.

Check `research/` before re-researching something already on file — see `research/README.md`.

## Seeing what's active right now
Every delegated workstream is a Task (`subject`, `status`, `owner`) — check it any time in the `/tasks` view, no need to ask for a status update. `pending` = queued, `in_progress` = an agent is actually on it right now, `completed` = done and its own checks passed. No open tasks just means nobody's working on anything at the moment — the roster above is who *exists*, not who's currently busy.

## Git flow for anything that writes a real file
Every specialist that touches a real file — application code or a research write-up — works on its own branch and never commits to `main` directly:
1. Before starting, branch off current `main`: `git checkout -b <prefix>/<short-task-slug>` (`feat`/`fix`/`research`, matching the work).
2. Commit as you go with real messages, not one giant commit at the end.
3. Once your own "Before you're done" checks pass, push the branch: `git push -u origin <branch>`.
4. Report the branch name in your summary. **Never open the pull request yourself, and never merge** — whoever dispatched you (the CEO, or manager-agent relaying to the CEO) opens the PR after reading your summary, so a human always reviews before anything reaches `main`.
5. Blocked or failed partway through? Still push what you have and say so in your summary — don't leave real work sitting only in an uncommitted working tree where it can be lost.

This applies to research too: a findings file under `research/**` is still a real change that deserves a reviewable diff, not a silent write to `main`.

## Conventions every agent here follows
- Frontmatter: `name`, a `description` that says what it's for *and* what it's explicitly not for (with a pointer to the right agent instead), `tools`, `model: inherit`.
- Every agent ends with a "Before you're done" section — a concrete check, not just "make sure it's good."
- Boundaries are enforced by tool access, not just prose: `manager-agent` doesn't get `Edit`/`Write`.
