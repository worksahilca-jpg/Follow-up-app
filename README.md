# FollowUp

A business should never lose a lead because nobody followed up — not at all, not in time,
not correctly. FollowUp captures leads from every channel a small business actually gets
them on, keeps the conversation in one place, scores intent, drafts the reply, and escalates
to a human the moment judgment is required.

It is a live multi-tenant SaaS with real customers, not a demo.

---

## Start here

**Read these three, in this order. It takes about twenty minutes and it is the whole
orientation.**

1. **`followup/PRODUCT_DIRECTION.md`** — what this product is for, and what it deliberately
   refuses to be. It wins over every other document on *what to build*. Read it before
   proposing a feature, not after.
2. **`CONTRIBUTING.md`** — how work actually gets merged here: branches, PRs, what CI
   enforces, and the two commands that must never be run against production.
3. **`followup/README.md`** — the app itself: what's built, every environment variable and
   why it exists, and how to get it running locally.

Then, depending on what you're about to touch:

| You're doing | Read before you start |
|---|---|
| Anything visual — a screen, a component, copy with UX weight | `CLAUDE.md`, then `design-brain/README.md`, then **`design-brain/decisions/rejected.md`** |
| Backend, an API route, the data model | `followup/README.md`'s structure map, then `followup/prisma/schema.prisma` |
| A real integration (Gmail, Meta, Twilio, Stripe) | `followup/research/integrations/` — the constraints are already documented, including the ones that killed an approach |
| Security, auth, or anything multi-tenant | `followup/docs/security.md` and `followup/research/audit/` |
| Wondering what's open right now | `STATUS.md` |

**Before you research anything, check `followup/research/README.md` first.** Seventy-odd
dated write-ups already live there. Re-deriving an answer that's on file is the most common
way to waste a day on this project.

### If you work through Claude Code

`.claude/briefs/` holds a per-role brief — the product, the constraints and your own area,
written down so your first session starts where everyone else's did instead of rediscovering
the project. Point a `CLAUDE.local.md` at yours (`.claude/briefs/README.md` has the one
line); it is never committed. Onboarding a new teammate means writing them one.

---

## What's in this repository

Four things deploy or ship independently. They are separate directories because they are
separate deployments, not because the code is split for tidiness.

| Directory | What it is |
|---|---|
| **`followup/`** | The product. A Next.js app — landing page, the authenticated app, every API route, the data model, the scheduled jobs. This is where ~95% of the work happens. |
| **`voice-agent/`** | A tiny always-on bridge that holds a live phone call open between Twilio and OpenAI's Realtime API. Its own Vercel project, because a serverless route can't hold a connection for the length of a call. |
| **`mobile/`** | A Capacitor shell that loads the live web app in a WebView, so FollowUp can be listed on the App Store and Play Store. A normal product change needs **no** mobile release. |
| **`design-brain/`** | FollowUp's design memory — principles, the design system, every decision approved or rejected, and the workflows that produce new screens. Not documentation that was written once; it is meant to be updated as things are learned. |

Each has its own README with the detail.

## The documents that govern the work

These four live at the root because they apply across everything:

- **`CLAUDE.md`** — the design and UX rules. Binding on any UI work, by a person or an agent.
  It is the file that stops the same rejected idea being proposed three times.
- **`CONTRIBUTING.md`** — the branch, PR and review workflow, and local setup that needs no
  production credential.
- **`TEAM.md`** — who owns what. `.github/CODEOWNERS` is the enforced version.
- **`STATUS.md`** — the operational checklist: what's open, what's waiting on the founder.
  Product, design and business, not just code.

Where two documents disagree: `followup/PRODUCT_DIRECTION.md` wins on *what to build*,
`CLAUDE.md` wins on *how it should look and behave*, and `TEAM.md` wins on *who owns it*.

## Credentials

You do not need a production credential to work on this repository, and you should never be
given one. `.env*` is gitignored; `followup/.env.local.example` documents every value and
points at your own machine. `CONTRIBUTING.md` covers the two ways to destroy live customer
data by accident — read that section before you run a Prisma command.
