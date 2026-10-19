# BRAIN — read this first, every session

Founder, 2026-10-19: *"If we keep forgetting the rules and stuff, that doesn't make any sense … first we need to solve
that because that's the main thing."* A chat gets shortened when it runs long, and a new session starts with nothing.
This file is what survives: how we work, where everything is, and where we left off. **Read it before anything else.
Update it at the end of every task** (the "Where we are" section), in the same commit as the work.

Everything here is plain text, so the whole repository opens as an Obsidian vault: open the repository folder in
Obsidian and this file, `design-brain/`, the plan and the decisions are all there, linked. What the founder writes
there, the next session reads.

---

## How Sahil wants to work (standing rules)

**Talking to him**
- Answers VERY short and simple. One step at a time. Always a recommendation. No jargon, no file names or tool words
  unless he asks. When he says "what?" or "in short?", say it again in two lines.
- Say "customers", never "leads", in the app.
- Never fabricate. A number, a date, a fact: from the code, the database or him, or say it's unknown.

**Deciding**
- UI and copy: **draw first, build after his yes.** Draw on the real app where possible (laptop first, phone second).
- Product behaviour is his call. Propose, don't decide.
- Look: minimal, calm, no colour, charcoal. Rules in `CLAUDE.md` and `design-brain/`.
- New fonts or packages need his yes. No legal or immigration opinions.
- Record his feedback in the design brain in the same session (`design-brain/decisions/approved.md`, `rejected.md`,
  `design-decisions.md`).

**Shipping**
- Merge only when he says "merge". Never push to `main`. Every merge to `main` is a paid Vercel build.
- Before merge: "App — typecheck, lint, build, audit" and Vercel both green. Squash merge.
- Every PR: the template in `.github/pull_request_template.md` plus the 6-point security check in `CONTRIBUTING.md`.
- After merge: wait for the production deploy to go green, then tell him it's live and what to try.

**Safety**
- Never write, print or commit a secret or session token. He adds secrets himself.
- Production is read-only for Claude: database reads that return counts or yes/no only, never names, emails or messages.
- Never run the app against the production database. Local runs use the local test database only.
- No tester or customer names in docs or public pages.

---

## Where everything is

| What | Where |
|---|---|
| What FollowUp is and the dated plan | `followup/PRODUCT_DIRECTION.md` (section "The plan from here" and "The dated plan") |
| Roadmap and checklist (shared doc) | Claude doc "FollowUp Roadmap and Checklist" |
| Design and UX rules | `CLAUDE.md`, `design-brain/README.md`, `.claude/skills/followup-design` |
| Every approved / rejected design decision | `design-brain/decisions/approved.md`, `rejected.md`, dated log in `design-decisions.md` |
| How replies are written | `followup/src/lib/integrations/openai.ts` (the reply writer), `followup/src/lib/tradePlaybooks.ts` (a plan per kind of business), `followup/src/lib/qualification.ts` (real estate's questions) |
| Admin (Decide, Train, tests, testers, usage) | `followup/src/app/admin/` |
| Team and who owns what | `TEAM.md`, `CONTRIBUTING.md` |

---

## The goal

No business loses a customer because nobody followed up. FollowUp answers, keeps the customer warm, and gets them to
a booked call or visit; the owner closes.

- **Stage 1, by Oct 31:** 5 testers using it every day, 20+ customers answered a week.
- **Stage 2, November:** testers get bookings and come back. YC application by Nov 2.
- **Stage 3, by Jan 4, 2027:** Google verified, first paying customer.

---

## Where we are (update at the end of every task)

**Last updated: 2026-10-19**

- **Just shipped:** every kind of business has a reply plan, and every reply moves toward a call (A-296, PR #557,
  live). Talk to it, Scorecard and per-kind progress are live on Admin → Train.
- **Waiting on Sahil:**
  1. Test the new replies in Admin → Train → Talk to it (Real estate: "hi", then "i saw your listing…").
  2. Yes or no on "Tell FollowUp what's wrong" (drawn; his feedback becomes a rule per kind of business).
  3. Message 5 testers (was due Oct 19).
- **Next build, after his yes:** "Tell FollowUp what's wrong" on Talk to it.
- **Known weak spots:** kinds other than real estate don't remember which questions were asked; the clinic "urgent"
  rule is an instruction only.
