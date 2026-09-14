# FollowUp — Team structure

**Last updated:** 2026-09-14. This is the durable reference for who owns what. `STATUS.md`
tracks what's open right now; this file tracks who's responsible for which area, and doesn't
change often. If the two ever disagree on who owns something, this file wins.

---

## Sahil — Founder & CEO

- Product vision and business strategy
- Customer research and validation
- Product roadmap
- Investor relationships
- Final product decisions
- Reviews major UI/UX and frontend changes

## Gautam — UI/UX Designer & Frontend Developer

- User experience design
- Figma designs
- Design system
- Frontend development
- Responsive web app
- UI animations and interactions
- Frontend testing

## Vansh — AI Automation & Integrations

- AI agents
- Follow-up automation
- External API integrations
- Automation workflows
- AI-related testing

## Pransh — Backend Engineer

- Backend architecture
- APIs
- Database
- Server-side business logic
- Supports Vansh with backend integrations

## Dipesh — Security & Operations

- Authentication and authorization
- Security
- Infrastructure
- Deployment
- Environment configuration
- Monitoring and reliability

## Entire team

- QA testing
- Code review
- Bug reporting
- Integration testing
- Product testing

---

## Git / code ownership

| Owner | Owns |
|---|---|
| **Sahil** | Product direction and final approval |
| **Gautam** | UI/UX and frontend implementation |
| **Vansh** | AI and integrations |
| **Pransh** | Backend and database |
| **Dipesh** | Security and operations |

The file-path mapping this maps to in practice lives in `.github/CODEOWNERS` — that's what
actually drives GitHub's review requests. This table is the human-readable summary; CODEOWNERS
is the enforced version.

**Frontend coordination:** Sahil and Gautam both touch frontend/UI territory — Gautam owns
*implementation*, Sahil owns *product direction and final approval*. Coordinate before starting
overlapping work rather than after; say so in the PR if you're touching a file the other has
open work on.

**Backend/integrations overlap:** Pransh and Vansh both touch `src/lib/integrations/` at times
(backend architecture vs. the integrations themselves). Same rule: flag it in the PR rather than
find out in review.

## How we work — see `CONTRIBUTING.md`

Branching, PR process, required checks, and testing expectations are documented there, not
duplicated here.
