# FollowUp — Project Status

The single place to see everything open across the whole project — product, design, ops,
and business — not just code. `design-brain/` is the design system's own memory (decisions,
principles, research); this file is the wider operational checklist. Update it as things
move, don't let it go stale — a status file nobody trusts is worse than none.

**Last organized:** 2026-09-13.

---

## Waiting on the founder

- [ ] **Set `PLATFORM_ADMIN_EMAILS` in Vercel** (Production env vars) to `sahil@followupbase.io`,
  confirm `ALLOWED_EMAILS` includes it if that var exists, then redeploy. Until this is set,
  `/admin` 404s for everyone, including the founder. (Claude Chrome prompt already given.)
- [ ] **Ghosted-lead recovery test** — set up the test Gmail account, send the 4 scripted
  test-lead emails, let real time pass to prove the "no lead goes cold" automation end to end.
- [ ] **Logo direction** — 3 arrow-based concepts presented earlier, none picked yet.
## Running now (background agents)

*(none right now — check the [Agent Board](https://claude.ai/code/artifact/310ede6b-c78d-436b-a262-d6bbd40040c1) for live status)*

## Recently shipped (this session)

- [x] Navy/blue app-wide reskin — landing page, `/signin`, and the full authenticated app
  unified on one visual system (PR [#198](https://github.com/worksahilca-jpg/Follow-up-app/pull/198))
- [x] Gmail/Outlook initial sync window widened 90 → 180 days (PR [#199](https://github.com/worksahilca-jpg/Follow-up-app/pull/199))
- [x] 8-issue UX audit fix pass from two independent new-user audits (PR [#200](https://github.com/worksahilca-jpg/Follow-up-app/pull/200))
- [x] Founder-only `/admin` platform dashboard — code live, gate not yet configured (PR [#201](https://github.com/worksahilca-jpg/Follow-up-app/pull/201))
- [x] CSP fix so the Vercel Toolbar can load on production (PR [#202](https://github.com/worksahilca-jpg/Follow-up-app/pull/202))
- [x] Design brain made Obsidian-compatible — wiki-links + `design-brain/INDEX.md` (PR [#203](https://github.com/worksahilca-jpg/Follow-up-app/pull/203))
- [x] STATUS.md, button-color and "going cold" pill-color decisions, lead-message research (PR [#204](https://github.com/worksahilca-jpg/Follow-up-app/pull/204))
- [x] Button-color (A-003) and pill-color (A-004) decisions approved by founder — implemented
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
- [ ] **Deeper GitHub/codebase access for Dipesh and Vansh** — open, not urgent.

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
