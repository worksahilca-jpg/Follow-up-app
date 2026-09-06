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
  ├── backend-agent                API routes, schema, integrations, automation
  ├── frontend-agent               authenticated-app UI
  ├── growth-agent                 landing page, copy, positioning
  ├── market-research-agent        competitor / pricing / category research
  ├── customer-research-agent      ICP, pain points, objections
  └── integrations-research-agent  production-readiness research per integration
```

## Talking to the team
- **A specific, scoped task** ("fix this route", "restyle this card", "research Twilio's SMS compliance rules")? Address that specialist directly.
- **A goal or initiative that spans more than one of them** ("get us ready to onboard real customers", "check whether our pricing still holds up")? Address **manager-agent** — it delegates, sequences dependent work, and reports back one synthesized answer instead of you coordinating each agent by hand.

## Research feeds the product, not the other way around
The three research agents never touch application code or landing-page copy directly. They write dated findings to `research/{market,customers,integrations}/` and hand them to the agent that acts on them:
- `market-research-agent` + `customer-research-agent` → **growth-agent** (positioning, copy) or **frontend-agent** (onboarding/UX)
- `integrations-research-agent` → **backend-agent** (real implementation)

Check `research/` before re-researching something already on file — see `research/README.md`.

## Seeing what's active right now
Every delegated workstream is a Task (`subject`, `status`, `owner`) — check it any time in the `/tasks` view, no need to ask for a status update. `pending` = queued, `in_progress` = an agent is actually on it right now, `completed` = done and its own checks passed. No open tasks just means nobody's working on anything at the moment — the roster above is who *exists*, not who's currently busy.

## Conventions every agent here follows
- Frontmatter: `name`, a `description` that says what it's for *and* what it's explicitly not for (with a pointer to the right agent instead), `tools`, `model: inherit`.
- Every agent ends with a "Before you're done" section — a concrete check, not just "make sure it's good."
- Boundaries are enforced by tool access, not just prose: research agents don't get `Bash`; `manager-agent` doesn't get `Edit`/`Write`.
