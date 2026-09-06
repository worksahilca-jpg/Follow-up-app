# FollowUp AI Team

A Claude Code plugin: the org chart of custom agents that build and research
the [FollowUp](https://github.com/worksahilca-jpg/Follow-up-app) app, packaged
so they can be installed rather than only working when Claude Code happens to
be run from inside that repo's checkout.

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

## Installing

From within Claude Code, pointed at the `worksahilca-jpg/Follow-up-app` repo
(or any clone of it):

```
/plugin marketplace add worksahilca-jpg/Follow-up-app
/plugin install followup-team@followup-plugins
```

These agents are written specifically for the FollowUp codebase (file paths,
conventions, product thesis) — they're most useful installed in a checkout of
that repo, not as a generic template for an unrelated project.

## Talking to the team
- **A specific, scoped task** ("fix this route", "restyle this card", "research Twilio's SMS compliance rules")? Address that specialist directly.
- **A goal or initiative that spans more than one of them** ("get us ready to onboard real customers", "check whether our pricing still holds up")? Address **manager-agent** — it delegates, sequences dependent work, and reports back one synthesized answer instead of you coordinating each agent by hand.

## Research feeds the product, not the other way around
The three research agents never touch application code or landing-page copy directly. They write dated findings to `research/{market,customers,integrations}/` and hand them to the agent that acts on them:
- `market-research-agent` + `customer-research-agent` → **growth-agent** (positioning, copy) or **frontend-agent** (onboarding/UX)
- `integrations-research-agent` → **backend-agent** (real implementation)

Check `research/` before re-researching something already on file — see `research/README.md` in the app repo.

## Seeing what's active right now
Every delegated workstream is a Task (`subject`, `status`, `owner`) — check it any time in the `/tasks` view, no need to ask for a status update. `pending` = queued, `in_progress` = an agent is actually on it right now, `completed` = done and its own checks passed. No open tasks just means nobody's working on anything at the moment — the roster above is who *exists*, not who's currently busy.

## Conventions every agent here follows
- Frontmatter: `name`, a `description` that says what it's for *and* what it's explicitly not for (with a pointer to the right agent instead), `tools`, `model: inherit`.
- Every agent ends with a "Before you're done" section — a concrete check, not just "make sure it's good."
- Boundaries are enforced by tool access, not just prose: research agents don't get `Bash`; `manager-agent` doesn't get `Edit`/`Write`.

## Relationship to `followup/.claude/agents/`
The app repo also keeps these same agents as loose files under
`followup/.claude/agents/` so they load automatically for anyone who opens
that exact checkout in Claude Code, with no install step. This plugin is the
same team packaged for everyone else — installed globally, versioned, and
usable from outside that one checkout. The two are currently maintained as
two copies; if they drift, this plugin's copy is the one meant to be
redistributed.
