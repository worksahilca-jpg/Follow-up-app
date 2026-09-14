# FollowUp — Project Status

The single place to see everything open across the whole project — product, design, ops,
and business — not just code. `design-brain/` is the design system's own memory (decisions,
principles, research); this file is the wider operational checklist. Update it as things
move, don't let it go stale — a status file nobody trusts is worse than none.

**Last organized:** 2026-09-13.

---

## Waiting on the founder

- [x] `PLATFORM_ADMIN_EMAILS` set to `sahil@followupbase.io` in Vercel (Production), redeployed.
  `ALLOWED_EMAILS` doesn't exist in this project, so nothing to check there. `/admin` should
  now work for that account.
- [ ] **Ghosted-lead recovery test** — set up the test Gmail account, send the 4 scripted
  test-lead emails, let real time pass to prove the "no lead goes cold" automation end to end.
- [ ] **Logo direction** — 3 arrow-based concepts presented earlier, none picked yet.
## Running now (background agents)

*(none right now — check the [Agent Board](https://claude.ai/code/artifact/310ede6b-c78d-436b-a262-d6bbd40040c1) for live status)*

## Open, waiting on review

- [ ] **7 stale Dependabot PRs** ([#97–#105](https://github.com/worksahilca-jpg/Follow-up-app/pulls))
  open since 2026-09-07, majors: TypeScript 5→7, Prisma 6→7, ESLint 9→10, plus 3 GitHub Actions
  bumps. Express 4→5 (#100) is done — see #214 below. Not urgent, but majors don't get easier
  with age.

## Recently shipped (this session)

- [x] Five-person team formalized in code — `TEAM.md`, `.github/CODEOWNERS`,
  `CONTRIBUTING.md`, PR template (PR [#215](https://github.com/worksahilca-jpg/Follow-up-app/pull/215))
- [x] README rewritten to describe the product that actually shipped (was still describing a
  demo on `demo-data.ts` with Gmail/OpenAI/login all marked not-yet-wired); STATUS caught up to
  #207–#212 (PR [#213](https://github.com/worksahilca-jpg/Follow-up-app/pull/213))
- [x] `voice-agent` Express 4→5 — verified live (WebSocket + liveness route) rather than just
  by changelog; supersedes stale Dependabot #100, which is now closed (PR [#214](https://github.com/worksahilca-jpg/Follow-up-app/pull/214))

- [x] Navy/blue app-wide reskin — landing page, `/signin`, and the full authenticated app
  unified on one visual system (PR [#198](https://github.com/worksahilca-jpg/Follow-up-app/pull/198))
- [x] Gmail/Outlook initial sync window widened 90 → 180 days (PR [#199](https://github.com/worksahilca-jpg/Follow-up-app/pull/199))
- [x] 8-issue UX audit fix pass from two independent new-user audits (PR [#200](https://github.com/worksahilca-jpg/Follow-up-app/pull/200))
- [x] Founder-only `/admin` platform dashboard (PR [#201](https://github.com/worksahilca-jpg/Follow-up-app/pull/201)) — gate configured since, see the top of this file
- [x] CSP fix so the Vercel Toolbar can load on production (PR [#202](https://github.com/worksahilca-jpg/Follow-up-app/pull/202))
- [x] Design brain made Obsidian-compatible — wiki-links + `design-brain/INDEX.md` (PR [#203](https://github.com/worksahilca-jpg/Follow-up-app/pull/203))
- [x] STATUS.md, button-color and "going cold" pill-color decisions, lead-message research (PR [#204](https://github.com/worksahilca-jpg/Follow-up-app/pull/204))
- [x] Button-color (A-003) and pill-color (A-004) decisions approved by founder — implemented
- [x] Scoring/drafting accuracy and usability/engagement research passes (PR [#207](https://github.com/worksahilca-jpg/Follow-up-app/pull/207))
- [x] Landing-page effectiveness research + how FollowUp's page compares (PR [#208](https://github.com/worksahilca-jpg/Follow-up-app/pull/208))
- [x] `--gold` overuse written up as D-017/A-005 — 30 sites across 15 files, not the 6 D-016
  found (PR [#209](https://github.com/worksahilca-jpg/Follow-up-app/pull/209))
- [x] `--gold` sweep implemented — currency to `--ink`, warning/error text to `--coral`,
  `--gold` back to meaning only "going cold". Plus the Uplift AI competitive check, which
  found a 4-way name collision and no actual competitor (PR [#212](https://github.com/worksahilca-jpg/Follow-up-app/pull/212))
- [x] **The AI office** — `/admin/office`, behind the same `PLATFORM_ADMIN_EMAILS` gate as
  the rest of `/admin`. Roster of the five `.claude/agents/` lanes, a record of every shift
  worked and what it cost, a Monday 06:00 UTC cron, and one staffed desk (`product-ux-agent`,
  reading product feedback). A check-then-act race in the runner's spend/concurrency gates was
  caught in review and fixed with a Postgres advisory lock before merge — same bug class as
  #84 and #89 (PR [#211](https://github.com/worksahilca-jpg/Follow-up-app/pull/211))
- [x] PR [#210](https://github.com/worksahilca-jpg/Follow-up-app/pull/210) closed unmerged — two unrelated commits had landed on the shared dev
  branch together; split into #211 and #212 rather than reviewed as one lump
- [x] Team Slack notifications (CI/PR activity, hot leads, server errors)
- [x] `followupbase.io` Google Workspace set up; Dipesh and Vansh added as teammates
- [x] Vercel Web Analytics enabled; Speed Insights confirmed on; Toolbar production access on

## Longer-term, no urgency — founder's call, not to be pushed on unprompted

- [ ] **Google OAuth app** — deliberately staying in Testing mode. Do not push toward
  publishing without the founder explicitly re-initiating that step.
- [ ] **Business registration** (Ontario Business Name + CRA Business Number) — paused
  pending sign-off from the founder's own immigration lawyer (Canadian work permit → PR).
  No legal/immigration opinion to be given here, ever — only factual/mechanical explanation
  if asked.
- [ ] **External penetration test** (Security L3) — not started. Real customer data exists
  now (at least one live test user), so this stops being purely hypothetical at some point.
- [x] **Team structure formalized** — 5 people (Sahil, Gautam, Vansh, Pransh, Dipesh), roles and
  git ownership documented in `[[../TEAM]]`, enforced via `.github/CODEOWNERS`, workflow in
  `[[../CONTRIBUTING]]`. Branch protection on `main` is on (PR + 1 approval + CI required, no
  bypass). GitHub invites sent to all four (2026-09-14) — Vansh and Pransh (`pransh-io`) both
  accepted, both have Write access; Gautam/Dipesh still need to report their usernames before
  CODEOWNERS' placeholder entries can be filled in.
- [ ] **Vercel team access** — team already existed (`North Frame` / `north-frame3`, Pro plan),
  no new team needed. Vansh and Pransh both invited as **Member** (2026-09-14, both pending
  acceptance, expire in 1 week). Note: Member seats cost **$20/mo each** on this plan — Pro
  also offers a free **Viewer** role and a **Developer** role ("create non-production
  deployments") that may fit Gautam's actual need (frontend previews) cheaper than a full
  Member seat; check Developer's cost before inviting him. Dipesh still needs Member (env vars
  + deploy access) once he's ready.
- [ ] **Slack duplicate accounts** — Gautam and Pransh each ended up with two Slack accounts,
  one on their `@followupbase.io` email and one on their personal email
  (`gautamwork075@gmail.com`, `mauryapransh2@gmail.com`). Founder is deactivating the personal
  ones via the workspace admin panel; keep only the `@followupbase.io` accounts.

## Standing constraints (don't silently violate these)

- Never publish the Google OAuth app without the founder's explicit go-ahead.
- Never give legal/immigration advice on business registration — factual/mechanical only.
- Every PR gets opened for review before merging — no direct pushes to `main`, even from a
  background agent. (This was violated once, for PR #201's underlying commit — caught and
  corrected; noted here so it doesn't happen again.)
- ~~Two open design-brain tokens...~~ RESOLVED 2026-09-13 — see A-003/A-004 in `[[approved]]`.

---

*See also: `[[design-brain/INDEX]]` for the design system's own map, `followup/PRODUCT_DIRECTION.md`
for what FollowUp is building and why.*
