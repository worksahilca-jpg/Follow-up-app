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

- **Training happens in the practice room** (artifact "FollowUp Practice Room",
  https://claude.ai/artifact/WSiRYwcnJTD4Y3ZbHBPadR): Sahil plays the customer, it answers as FollowUp (on his Claude
  plan), and "What's wrong?" turns his words into a rule per kind of business, saved on the page (collections `rules`
  and `examples`). When he says **"check the practice room"**: read both collections with ArtifactData, put the new
  rules and good answers into the app in one PR, then mark each `status: "in-app"`. Its brief mirrors the app's reply
  rules (openai.ts) and plans (tradePlans.ts / qualification.ts): when those change, update the page too.
- **Removed (R-136):** the paid Claude chat on Admin → Train (A-298). Sahil should delete `ANTHROPIC_API_KEY` and
  `ANTHROPIC_MODEL` in Vercel and revoke the "FollowUp Train" key at platform.claude.com. The empty `TrainerMessage`
  table stays. "Tell FollowUp what's wrong" (A-297) still works on Talk to it.
- **Realtor replies follow the top-agent playbook (A-299, LIVE 2026-10-19 with R-136, PR #560 → e55757a):**
  - The playbook comes from about 60 sources: `reports/FollowUp realtor reply playbook.md`, outside the repo.
  - Sahil trained it by chat; the rules were checked against the earlier decisions.
  - A buyer's questions now run: area + when → viewing + agent (asked gently) → lender + price range (money last).
  - Saying yes to a viewing makes the customer Ready, and the phone buzzes.
  - On Instagram, a question about one home gets an answer and a light question first; the showing comes in the next
    reply.
  - Never promise a time.
  - Price, offers and paperwork go to the agent.
  - A lender is offered only if it's in the owner's facts.
  - Two questions per message and the A-245 plans are unchanged (founder: "yes go with both").
  - Not built: the day-1 follow-up in the DM before Meta's 24-hour window closes (the plan engine's timing; ask
    first).
- **Paused (not committed, copy in the scratchpad `wip-memory/`):** every kind remembers which plan questions it
  asked, the same checklist real estate has (no decision number yet; the "A-299" it was first called is now the
  playbook above).
- **Talk to it tests (Oct 19):** the first found 5 reply faults (repeat area question, "buy/sell?" after a listing question, weekend vs weekday showing hours, condo-worth reply), fixed in #565. The second found "which one caught your eye?" in every reply and "weekend works" / price ignored, fixed in #566. The third still asked the area three times: the reply writer never saw the checklist. Fixed next (it is now told what they said, what went unanswered, and to ask nothing when nothing is left). Next: rerun the 6 test messages.
- **GoHighLevel uses the same reply rules:** ghlPoll → scoreAndDraftForLead. The business type must be "Real estate".
- **Waiting on Sahil (gave him one Claude in Chrome prompt for 1–4, Oct 19 night):**
  1. Vercel: delete `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
  2. Revoke the "FollowUp Train" key.
  3. Meta access-verification status. Open a ticket on Oct 20 if it's still pending.
  4. FollowUp check: business type and GHL connected, plus 6 test replies in Talk to it. Check each reply against A-299.
  5. Realtor GHL test (Oct 20).
  6. Message 5 testers (overdue).
- **Training now happens in chat with Claude Code.** Sahil plays the customer. The practice room is a backup.
- **Known weak spots:** kinds other than real estate don't remember which questions were asked; the clinic "urgent"
  rule is an instruction only.
