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
- [x] ~~Ghosted-lead recovery test — set up the test Gmail account, send the 4 scripted
  test-lead emails...~~ Founder's call (2026-09-14): use the already-shipped "Send a test
  lead to myself" button (`TestLeadButton.tsx` → `POST /api/leads/test-lead`) instead — it
  already exercises the real instant-ack/scoring/draft path end to end. The fuller multi-day
  silence/rescue scenario stays a later, deliberate exercise, not a blocker right now.
- [x] ~~Logo direction~~ Founder is now designing the logo himself (2026-09-14) — Claude is
  out of this loop entirely unless he re-opens it. Two rounds of concepts (3 arrow-based, then
  3 F/U monogram drafts per his own idea) were shown and rejected; see `[[../design-brain/decisions/rejected|R-001]]`.
  Do not propose new logo directions unprompted.

## Running now (background agents)

*(none right now — check the [Agent Board](https://claude.ai/code/artifact/310ede6b-c78d-436b-a262-d6bbd40040c1) for live status)*

## Open, waiting on review

- [ ] **PR #229** — 10 minor/patch bumps (Sentry, lucide-react, openai, react/react-dom patch,
  stripe, vite, postcss, etc.). CI green, Vercel preview deployed clean. Low-risk, ready to
  merge on request.
- [ ] **4 Dependabot majors genuinely held back, not stalled by neglect** — each investigated
  and found unsafe to ship right now, for real upstream reasons, re-checked 2026-09-14:
  - **Prisma 7** (#102) — still needs the full driver-adapter rewrite (`datasource url`/
    `directUrl` removed entirely, touches the production DB layer). Re-checked: 7.x is now
    mature (7.0–7.10 shipped, 8.0 RC out), but that was never the blocker — the architecture
    change is real and still unstarted. Worth scoping as a deliberate project, not a drive-by
    bump.
  - **TypeScript 7** (#103) — still blocked. `typescript-eslint` latest (8.70.x) still pins
    `typescript: >=4.8.4 <6.1.0` — confirmed no support for TS 7 yet.
  - **ESLint 10** (#104) — still blocked. `eslint-plugin-react` latest (7.37.5), bundled by
    `eslint-config-next`, still pins `eslint: ^3...^9.7` — no ESLint 10 support yet.
  - **zod 3→4** (#230, new) — attempted a real check, not just deferred: CI actually fails on
    this one. zod is used in 32 files across the API surface (the Security L2 "schema
    validation on every API body" guarantee) — zod 4 has real breaking changes (error shape,
    some renamed methods) that need a proper migration pass across every one of those call
    sites, not a version-bump-and-hope. Held back for the same reason as the other three: real
    breakage, not neglect.
  
  Re-check all four periodically as upstream catches up / as a dedicated pass gets scheduled — don't force any of them.

## Recently shipped (this session)

- [x] **Correction: PR #222 (Automations preservation) was actually still open**, despite this
  file previously recording it as closed. Verified and closed for real (2026-09-14) — no merge
  occurred, the standing "never combine Automations with FollowUp" constraint held throughout.
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
- [x] **Twilio A2P registration paused ~1 week** (2026-09-14, founder's call — cost timing,
  not urgent to detail further here) — Vansh reassigned to WhatsApp template setup, then Meta
  App Review submission, in the meantime. Resume A2P when the founder says go.
- [x] **Team structure formalized** — 5 people (Sahil, Gautam, Vansh, Pransh, Dipesh), roles and
  git ownership documented in `[[../TEAM]]`, enforced via `.github/CODEOWNERS`, workflow in
  `[[../CONTRIBUTING]]`. Branch protection on `main` is on (PR + 1 approval + CI required, no
  bypass). GitHub invites sent to all four (2026-09-14) — Vansh, Pransh (`pransh-io`), and
  Gautam (`gautam972`) confirmed GitHub usernames. **Dipesh has not yet reported his** — PR
  [#225](https://github.com/worksahilca-jpg/Follow-up-app/pull/225) briefly used "@dipesh" as
  an unconfirmed guess (2026-09-14); that was a mistake, caught and reverted the same day. Do
  not fill in his CODEOWNERS entry until he actually reports his real username.
- [ ] **Vercel team access** — team already existed (`North Frame` / `north-frame3`, Pro plan),
  no new team needed. Vansh invited as **Member** (2026-09-14, pending acceptance). **Pransh
  accepted** (2026-09-14) — guided on deployment logs, env vars, and preview deployments for
  backend work. Note: Member seats cost **$20/mo each** on this plan — Pro also offers a free
  **Viewer** role and a **Developer** role ("create non-production deployments") that may fit
  Gautam's actual need (frontend previews) cheaper than a full Member seat; check Developer's
  cost before inviting him. Dipesh still needs Member (env vars + deploy access) once he's
  ready.
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
- **Sahil stays on top of the access hierarchy on every platform, always.** GitHub: he's
  `admin`, everyone else gets `write` at most. Vercel: he's Owner on North Frame, everyone
  else gets `Member`/`Developer`/`Viewer` at most. Slack: he's Owner/Admin, everyone else is a
  regular member. Never grant anyone Owner/Admin-equivalent access on any platform without his
  explicit ask — access expands outward from him, never sideways or above him.
- **"Automations" is a separate business (Sahil's own, agency-style client-automation work,
  built to fund FollowUp) and must never be combined with FollowUp's codebase.** It briefly
  landed directly on the shared `claude/followup-demo-to-production-4k39hr` branch from a
  different session (2026-09-14), was preserved on its own `claude/automations-business`
  branch, and its PR was closed without merging on the founder's explicit instruction. If it
  needs a home, that's its own separate repository — never a merge into this one.
- ~~Two open design-brain tokens...~~ RESOLVED 2026-09-13 — see A-003/A-004 in `[[approved]]`.

---

*See also: `[[design-brain/INDEX]]` for the design system's own map, `followup/PRODUCT_DIRECTION.md`
for what FollowUp is building and why.*
