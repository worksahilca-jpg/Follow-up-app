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
- **The privacy policy keeps up with every source and CRM** (founder, 2026-10-20). Any PR that makes FollowUp read,
  write or send something new, anywhere, updates `followup/src/app/privacy/page.tsx` in the same PR, and the connect
  text asks for exactly the permissions FollowUp uses. Facts only; the lawyer reads it before charging.

---

## Where everything is

| What | Where |
|---|---|
| What FollowUp is and the dated plan | `followup/PRODUCT_DIRECTION.md` (section "The plan from here" and "The dated plan") |
| Roadmap and checklist (shared doc) | Claude doc "FollowUp Roadmap and Checklist" |
| Design and UX rules | `CLAUDE.md`, `design-brain/README.md`, `.claude/skills/followup-design` |
| Every approved / rejected design decision | `design-brain/decisions/approved.md`, `rejected.md`, dated log in `design-decisions.md` |
| **FollowUp's playbook: whom it answers, how it judges, what and when it writes, when it stops, how it learns** | `followup/playbook/` (one page per kind of business; real estate first). Keep it in step with the code it describes |
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

**Last updated: 2026-10-22**

- **Sales engine, phase 1 audit (Oct 22, PR #582, no code changed):** the founder's "AI sales assistant engine" brief
  (phases 1–10). `followup/research/product/2026-10-22-sales-engine-audit.md`: one message traced through the code,
  every feature marked works / incomplete / missing / risky, the gaps per phase, proposed tables (all additive, each
  behind an off / watching / on switch) and the 7 steps in the brief's order. Riskiest today: the founder's trained
  rules and examples reach every business of that trade at once, untested and unversioned. The "720 conversations"
  are 720 checklist answers in 58 invented conversations. Waiting: the founder's yes to step 1 (training goes through
  a test and the founder's OK) and the founder's answers to the 7 decisions in section 7. Nothing gets built before that.
- **FollowUp's playbook (Oct 22, PR open):** founder: *"how to judge … what to reply, whom to reply, when to reply and
  all"* and *"how this app will remember all these"*. `followup/playbook/real-estate.md` writes down, from the code, the
  whole job for realtors; `followup/playbook/README.md` says how the app remembers (code = fixed rules, database =
  learned facts and trained rules, playbook = the written copy, accuracy tests = the check). Open: an accuracy test for
  the call on other kinds of business; re-run the four tests before the pilot; a Playbook page in the app showing the
  trained rules live.
- **FollowUp's call (A-310, Oct 22, live in PR #580; weak spots fixed and live in PR #581):** every customer shows where
  they stand (Ready, Warm, Later, Has an agent) and the one next step; every kind of business is sorted (from the
  score); an old Ready says how many days; Results says what to do. Fully automatic (R-137).
- **Drawn, waiting for his yes:** what matters stands out (how long someone has waited on every row, their message in
  its own bubble with only their questions in bold, "Your reply to Raj"). Outreach the owner starts (no reply yet):
  recommended after the pilot (he replied "cool"; not a firm yes).

- **Reconnect reminders (A-309, Oct 22, PR open):** an owner whose Gmail or Outlook stays disconnected gets one email at
  day 2 and one at day 7, then nothing. Found because 2 of 3 testers' Gmail had been broken for weeks (Google's old 7-day
  test-mode limit; connections made since Oct 3 last). YC application paused by the founder; the draft is kept.

- **The pilot (Oct 22, PR open):** FollowUp is sold as a sales system, proven in one kind of business. Realtors for
  now (contractors if the founder can get three owners there first). `followup/PRODUCT_DIRECTION.md` → "The pilot".
  - **What FollowUp learns waits for the owner's OK (A-308):** learned facts and changed words wait in Settings →
    "Waiting for your OK" (Use it / Not right) and on Today's Later list; replies use only OK'd facts. Migration:
    `BusinessFact.approvedAt`, `BusinessFact.proposedValue` (everything already in use stays in use).
  - **Pilot numbers on /admin → Testers → "The pilot":** per business, last 30 days: calls right, Ready → booked,
    replies as written / changed / on its own with minutes saved (a stated guess), next step → wrote back,
    appointments, and answering before FollowUp vs since. The founder types the owner's own numbers from the setup
    call. Migration: `Business.pilotBaseline`.

- **"Your last 90 days" (A-306, built Oct 21, PR open):** once, after FollowUp first reads the inbox, Today says "23
  people wrote to you. 17 didn't get a reply. Each one has a reply ready below." and how many emails were set aside,
  with **See them** (opens the skipped list) and **Got it** (hides it for good). The "didn't get a reply" number is
  Today's own waiting list, so the two always match. Admin only, within 14 days of connecting. Migration:
  `Business.inboxSummarySeenAt`.

- **The app organised the Wispr way (A-307, built Oct 21, same PR):** Today shows "Since you started · answered ·
  booked · won" top right (under the greeting on a phone) and one card at a time; every list (Needs you, Later,
  Customers, Activity) is one white group under a small uppercase label; Customers has search and a black "Add a
  customer" beside the title on a computer, grouped "Your reply is ready" / "Ready to book" / "Everyone else";
  Activity shows each day with the time on the left.

- **Demo realtor account (Oct 21):** nobody could test, so we test ourselves: `design-brain/workflows/demo-realtor-test.md`
  (setup + 16 tests). Sahil connects a spare Gmail; FollowUp reads 90 days and sends nothing on its own.

- **Instagram next-day follow-up (A-304, LIVE Oct 21, PR #577 → baa3d96):** on Instagram and Messenger the plan's first
  follow-up now goes about 20 hours after the customer's last message, inside the send hours and before Meta's 24-hour
  window closes (it used to come a day after our reply, always too late). Only once, never after "Not now", no or
  stop. It is the one exception to "one a day". A held draft says when Instagram closes the chat. After 24 hours the
  owner's day-2–7 draft takes over, as before.

- **Which calendar the owner uses (A-305, LIVE Oct 21, same PR; column confirmed):** Today asks once "Which calendar do you book
  showings in?" with pills. Google (with Gmail) or "I don't use one" sets where customers book at once; any other
  (BrokerBay, ShowingTime, Outlook, GoHighLevel, Calendly, something else) says "FollowUp can't book into it yet" and
  asks: FollowUp's calendar or My Google Calendar. Settings › Your free hours shows "Your calendar" with Change. Only
  the name is kept; privacy page updated. Migration: `Business.calendarUsed`.

- **GoHighLevel on its own (A-303, LIVE):** Ready / Warm / Later move a customer to the owner's own stage,
  and back, once per change, with the reason on record; never while a meeting is booked. "Read my notes" (on) reads
  the owner's own GoHighLevel notes, like call notes, every 2 hours, 10 customers per poll, inside the AI ceilings;
  FollowUp's own notes are never read and nothing is sent from a note. Privacy page updated (GoHighLevel, notes, stage
  moves). The GoHighLevel key must also have **Opportunities**: the connect text says so, and the CRM window says what
  to turn on when it can't see the stages. LIVE (PR #574 → de37e5d), 5 columns confirmed. **Bug review fixes** (PR
  #575): no moves for stop / no / won / lost / CRM do-not-contact / GoHighLevel bookings; a CRM hiccup no longer
  uses up a move; notes skip off-limits customers, claimed per customer, 2-minute budget. Since Sahil's "yes do it":
  tier moves go only to a stage he picked (rows say "Choose" until then). Deal cards: a move moves the customer's
  existing card wherever it is; only someone with no card gets a new one (Sahil, Oct 20; PR #576, live).

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
  - A buyer's questions now run: area + when → viewing + agent (asked gently) → lender + price range (money last),
    unless the owner gave their own (A-302, below).
  - Saying yes to a viewing makes the customer Ready, and the phone buzzes.
  - On Instagram, a question about one home gets an answer and a light question first; the showing comes in the next
    reply.
  - Never promise a time.
  - Price, offers and paperwork go to the agent.
  - A lender is offered only if it's in the owner's facts.
  - Two questions per message and the A-245 plans are unchanged (founder: "yes go with both").
  - The next-day follow-up in the DM before Meta's 24-hour window closes: built (A-304, Oct 21).
- **Paused (not committed, copy in the scratchpad `wip-memory/`):** every kind remembers which plan questions it
  asked, the same checklist real estate has (no decision number yet; the "A-299" it was first called is now the
  playbook above).
- **Talk to it tests (Oct 19):** the first found 5 reply faults (repeat area question, "buy/sell?" after a listing question, weekend vs weekday showing hours, condo-worth reply), fixed in #565. The second found "which one caught your eye?" in every reply and "weekend works" / price ignored, fixed in #566. The third still asked the area three times: the reply writer never saw the checklist. Fixed in #567 (it is now told what they said, what went unanswered, and to ask nothing when nothing is left). Next: rerun the 6 test messages.
- **GoHighLevel uses the same reply rules:** ghlPoll → scoreAndDraftForLead. The business type must be "Real estate".
- **Wake up old GoHighLevel customers (A-300):** built.
  - It brings back 10 old conversations a day (45 days to 6 months old), and their welcome backs wait on Today.
  - Same change: contacts with no conversation get no drafts and don't use up the monthly limit.
  - GoHighLevel needs a trial or paid plan (Free doesn't read it).
- **Setup asks to turn off GoHighLevel's auto-reply (A-301, Oct 19):** a short screen right after GoHighLevel
  connects. Its menu names still need checking on a live account. "Later" has no second home yet.
- **The owner teaches FollowUp what to ask (A-302, LIVE: PR #573 → a147d4a):** a realtor is asked
  on Today "What do you ask a new buyer, and in what order?", and FollowUp asks a buyer his questions in his order
  (Settings › Sending replies › What FollowUp asks). Status and other personal things are kept for his call, never
  asked in writing. Weak points in design-decisions (Oct 20). After the merge: try it with his real words.
- **Realtor meetings 2 and 3 (Oct 20):** he wants it fully automatic. Built since: moving GoHighLevel stages when a
  customer goes hot or cold, and reading his GoHighLevel call notes (A-303, live). Not built: booking showings in his
  showing calendar (A-305 now asks which calendar he uses; BrokerBay/ShowingTime booking itself is not built). His family
  WhatsApp groups can't be read. Recommended next: the first two (asked Sahil). He was added as a beta tester.
- **First realtor interview (Oct 20):** he qualifies by status and money first, area last; "not now" leads go to
  nurture; listing emails after. Notes and open questions: `followup/research/customers/2026-10-20-first-realtor-interview.md`.
- **First realtor GoHighLevel account (plan, Oct 20):** no trial dry run (Sahil's choice). Assisted, tap **Later** on
  the auto-reply screen, test with one text from Sahil, and only after about a week turn off just the auto-reply step
  (design-decisions, Oct 20). Menu names still unchecked.
- **Bug check (Oct 20):** Gmail now waits out Google's per-minute limit and never marks a check done with emails left
  unread (Oct 18: 28 threads waited a day). Five screen bugs fixed (see design-decisions, Oct 20), one unused route
  removed.
- **Safety before the first real account (Oct 19):**
  - STOP stops everything FollowUp does on its own, on every channel.
  - A "don't know" from GoHighLevel about Do Not Disturb is never a yes.
- **Waiting on Sahil (gave him one Claude in Chrome prompt for 1–4, Oct 19 night):**
  1. Vercel: delete `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`.
  2. Revoke the "FollowUp Train" key.
  3. ~~Meta access-verification status.~~ Checked Oct 20: still "In review" (submitted Sep 25), no request from
     Meta, no warnings. Must be done by **Dec 18, 2026** or the app is restricted. Meta offers no ticket for review
     delays (its bug tool sends you to the public Developer Community Forum). Plan: wait, check weekly; forum post
     only if still in review in late November.
  4. FollowUp check: business type and GHL connected, plus 6 test replies in Talk to it. Check each reply against A-299.
  5. Realtor GHL test (Oct 20).
  6. Message 5 testers (overdue).
- **Training now happens in chat with Claude Code.** Sahil plays the customer. The practice room is a backup.
- **Known weak spots:** kinds other than real estate don't remember which questions were asked; the clinic "urgent"
  rule is an instruction only.
