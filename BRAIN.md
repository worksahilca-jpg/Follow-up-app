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

**Last updated: 2026-10-28**

- **The app on a soft photo, a still frame, Start free fixed (Oct 28, A-331) LIVE ✓ (#609 → 3c0ec37).** The founder,
  first day on a Mac: the app is "way too boring", scrolling "feels like I'm scrolling code", and the landing's Start
  free "scrolls down to the very bottom and asks me to start free again". Found: on a computer the whole web page
  scrolled, so the white sheet and its corner slid away with the list; the frame was flat grey; the bar's Start free
  pointed at the closing card on purpose (A-167). Drawn on the real app, two boards (A/B, then C–G), his pick A + F
  with a faint grain ("It's on you"): the sheet floats in an 8 px frame and never moves, only its inside scrolls; a
  street photo from the landing, blurred to colour, sits behind the frame (day until 5 pm, the dusk street after,
  from the device's clock); the phone's bars are see-through with a blur; white groups are raised by a soft shadow;
  dark mode keeps its ground. Start free in the bar and the try box go straight to sign-in. Checked phone + computer,
  day, evening and dark. Local `next build` can't run in this sandbox (Turbopack's font download); CI builds it.
- **One window on a desk, crisp, light and dark (Oct 28, A-333) LIVE ✓ (#611 → 1b53a40); founder: "yes looks good".** On his Mac in dark mode
  the founder saw nothing of A-331 (dark kept its ground), asked for a dark version, then on seeing it: "too blurry…
  feels like the app isn't loaded yet… make it feel premium… the same for light" (R-142: the blurred photo and the
  grain are dead in the app). Drawn crisp with no photo (P1 one frame, P3 two panels, P3b one window); he picked P3b
  after "P3 feels detached". Built: the shell is a flat desk (light #dbd8d1, dark #000), the sidebar and the sheet are
  one rounded window on it with a hairline ring and a seam, one shadow; the phone keeps paper and its frosted bars;
  DayLight and the wash photos deleted. Measured in a real browser in both modes.

- **Booking in the chat (A-242) LIVE ✓, parts 1 + 2 (Oct 28; #612 → 124c2a7, #613 → 65b1474):** the reply offers two free times, the customer's pick is read, the owner gets a buzz and one Confirm button; Confirm books it and tells them. Part 2: a customer who asks to move gets two new times and the owner confirms the move; a customer who cancels frees the slot and the owner can offer another time; the owner's Booked card has Change the time and Cancel. Both migrations confirmed in production.
- **Today with less on the screen (Oct 28, A-335) built, PR open, waiting for "merge".** The founder, mid-build: "the app feels dead bro and too complex… how today should look like is not what i am expecting" (R-143). Asked "the look, or how much is on the screen?" with the recommendation "less on the screen"; he said "okay do it", then "merge and build it" to the drawing. Built: one column (720px centred on a computer), one person at a time in a white box, the rest of the queue as one line with three faces ("Next: Ethan, Mia, Mason · 12 more", opens in place), Then only for what isn't a reply, Later as one line that opens, the "Since you started" numbers moved to Results, the next person sliding in after Send. The look (A-331/A-333) untouched. Next in his order: the website link box into the first setup screen; inside-the-sheet polish; admin pages onto the desk tone.
- **One question before reading a website that isn't the owner's (Oct 28, A-332) LIVE ✓ (#610 → 2e2cd68).** The
  founder: "what if someone pasted someone else's website… we'll mess up everything." Today the only guard was the
  play-back's "Looks right". Now FollowUp compares what the site calls itself (og:site_name or its title) and its first
  page and address with the business's name; when no distinctive word matches it reads nothing and asks one question
  ("This site calls itself "Oak Street Homes". Is that your business?") with Yes, that's mine / No, wrong link, in the
  meeting and on setup's website line. A match costs nothing. Checked phone + computer in a real browser (the server's
  answer for a mismatched site; the sandbox can't fetch sites).
- **Accuracy, asked by the founder (Oct 28):** the 4 tests on /admin were last run Oct 14 (replies 10/20 then); many
  fixes went in since and nobody re-ran them. Live use in 14 days: 17 replies drafted, 78 customer checks, 0 failed
  calls, one business. Next: he taps Run on /admin and sends the 4 numbers; then the scores go into the nightly diary.
  The website reading (A-328) is live but 0 of 12 businesses have given a link.

- **Gmail's daily full read finishes again (Oct 27), PR open (with the practice card), not merged.** After #607 new
  mail came in, but the busy inbox's daily 90-day read had not finished since Oct 20. Vercel's record of calls to Google:
  every two-minute run, about 64 reads went through, then Google answered 403 ("units per minute per user") about 16
  times and the read stopped, ~5,500 refusals every 12 hours since Oct 21. The read always started over from the
  newest email, so it re-read the same ~50 it already had and never reached the rest. Fix: it remembers where Google
  stopped it (`Integration.deepSyncOffset`, new column) and the next run starts there; a finished read clears it. An
  inbox Google never stops still reads everything in one run. After it goes live: that inbox's `deepSyncedAt` should
  move within about 10 minutes and the 403s to gmail.googleapis.com should stop.
- **One practice reply a day on Today (Oct 27, A-330), PR open, not merged.** The founder wanted FollowUp trained
  "more accurately and every day". On a quiet day (nobody waiting, no setup step open, admins only, the daily question's
  slot), Today shows one made-up customer message for the owner's kind of business and the reply FollowUp would write.
  Looks right, Change it (the owner's version is kept like "Write it better", so later replies read it) or Not now.
  Nothing is sent and nothing about the made-up customer is stored. At most 6 replies a business a day.
- **Gmail inbox stuck while it said Connected (Oct 27), LIVE (PR #607 → 8b02ed4).** Checking the app before the realtor
  messages: one of the two connected Gmails had taken in no new email since Oct 21, and every two-minute sync took
  ~15 s instead of 0.5 s. Cause: the daily full read (up to 150 threads, five at a time) met Google's per-mailbox
  limit at the same point every tick, and since PR #572 a read cut short keeps its clock, so the full read was due
  again on every tick and ran *instead of* the check for new mail. Fix: every tick checks new mail first, the full
  read only follows a check Google let finish, and thread reads start 100 ms apart (10 a second, under Google's 25).
  Confirmed live: both inboxes' `lastSyncedAt` move every two minutes.
- **Pages kept awake (Oct 27), LIVE (PR #606 → 6186db0).** The founder: "our app is very slow". Vercel's numbers that
  morning: each page answers in 0.04–0.08 s once awake, but sleeps after a few quiet minutes, and the first tap
  after that took 1–2.4 s (Today 2.4 s, Activity 2.1 s, Customers 1.7 s, the sign-in check 1.2–1.5 s). The scheduled
  jobs that run every minute or two were never asleep. So `/api/cron/keep-warm` (every 3 minutes, `src/lib/keepWarm.ts`)
  opens the 9 owner pages signed out; each checks the sign-in first and redirects, so a visit reads nothing. Check the
  cold-start numbers in Vercel a day after it goes live. If the app still feels slow on second taps, the cause is the
  browser side (no real-user speed data yet: Speed Insights would be a new package, his call).
- **Settings opens with its answers (Oct 27) LIVE (PR #605 → 9ff21a2).** The founder: Settings "responds after about 10
  seconds". Vercel's numbers (Oct 27) showed why: the Settings page itself answered in about 0.1 s (it's opened all
  day), but each of its ~20 data routes is rarely called, so each started cold, 1.3–3.6 s apiece. Now the page's server
  render runs those same handlers and hands the answers down (`src/lib/pageCopies.ts`, list in
  `src/lib/settingsCopies.ts`); a part that opens takes the page's copy, and anything after a change still asks the
  server. Locally: opening Settings went from 20 server calls (13 on a phone, then 7 more on Connected apps) to 0, and
  the whole walk through every Settings page from 36 to 2 (both kept on purpose). Screens are pixel-identical to the
  live version. Measure again on Vercel after it goes live.
- **Night check (Oct 27) LIVE (PR #604 → 6a7c9c1).** Asked by the founder ("bugs, security checks, waste code… keep the
  code organised"). Found: all 4,967 tests pass, type check clean, no failed sends or sync errors in the live data
  (30 days), 0 known package holes, no keys in 666 commits of history, every database table locked (Supabase reports
  only the expected "locked, no public policy" note), every public route checks who is calling. Removed 19 files
  nothing used (the old React home page, the old composer and thread, and other parked-then-replaced pieces) and one
  unused package (`clsx`). Kept on purpose: the parked Inbox (A-027's guard). The app's 10-second lag on the founder's
  laptop that evening: the code answers in under 0.1 s once running; the first click after the app sits unused took
  3.5 s even locally, so it's the server waking up. Confirmed with Vercel's own numbers the same night; fixed in the entry above.
- **"Not now" choice (A-329, Oct 26) LIVE (PR #603 → af91948; `Business.notNowPlan` + `Lead.notNowAt` confirmed in
  production, read-only).** Drawn, then approved ("merge and yes build it").
  The first time a maybe-no reads as "not now", that customer's Today card asks an admin once: Stop (the default) or
  Ask when, then check back once; Settings › Sending replies changes it. Ask = one short question, one check-back note
  at the time they give (Their moment, A-262), nothing else: no plan step, workflow or win-back while `Lead.notNowAt` is
  set, every reply waits for the owner, consent window and STOP still win. Stop = a warm thanks with no question. One
  migration (`Business.notNowPlan`, `Lead.notNowAt`). The founder, same day: *"YES WE SHOULD RESPECT THE CUSTOMER BRO"*.
- **The "no" word-list fix is LIVE** (PR #602 → 0b68f4b, deploy green, Oct 26).
- **"Not now" and the "no" word list (A-329, Oct 26): word-list fix LIVE (see above).** The founder: how FollowUp
  reacts comes from what realtors do, not from him (brand principle, same day). A "not now" still stops by default;
  each owner will choose (stop, or ask when and check back), and FollowUp learns it; the ask is drawn next. 50 made-up
  test conversations (`src/lib/noConversations.ts`) found the plain-words list stopping on 8 that aren't a no ("not
  interested in condos, only detached", "found a place… can you book a showing?", "stop emailing, text me"): now the
  list steps aside when the same message asks for something or moves channel, and the AI readings decide.
- **FollowUp reads the owner's website and Instagram (A-328, Oct 26) LIVE (PR #601 → 1ae6d22, merged at the founder's
  "merge"; Business.website + websiteAskedAt and the migration confirmed in production, read-only).** In "Tell
  FollowUp", before the questions: "does your business have a website?", the owner's own Instagram posts and bio too
  when it's connected; the meeting then asks only what that didn't answer ("1 of 3"), and the play-back says under each
  line "From your website", "From your Instagram" or "You said", with "See what it read". Setup's step-3 waiting screen
  has one optional website line and never moves on while the box has a link in it. Values are copied word for word,
  nothing is used before "Looks right". Every page is fetched through the SSRF guard (public addresses only, checked
  again at connect time, at most 3 redirects, HTML only, 512 KB a page, 6 pages). Limits: 6 reads an hour, 12 a day,
  plus the daily AI ceiling. Migration: Business.website + websiteAskedAt. Before relying on the Instagram part: check
  that reading the owner's own posts fits the Instagram permission Meta approved, and mention it in the next review.
- **Vercel builds `main` only (Oct 26) LIVE (PR #598 + fix #599 → 27ad691):** the spending cap paused the app on
  Oct 25; previews are now skipped by `scripts/vercel-ignore-build.mjs`, which builds whenever it can't tell. Open:
  the founder sets Deployment Retention in Vercel (old stored copies cost ~$1.90/day).

- **Assisted sends nothing on its own; new customers on top (A-322, A-323, R-140, Oct 23) LIVE (PR #593 → 39c2b8b,
  merged at the founder's "merge"; deploy green; no migration):** the 30-minute "let me check" went out on the founder's own Instagram at 10:40 am and they don't trust
  automatic messages yet, so on an Assisted account FollowUp now sends nothing by itself (the line stays for Automatic
  only). Customers opens with a "New" group: everyone who arrived in the last day, newest first.
- **The "no" safety net + email only when needed (A-326, A-327, Oct 25) LIVE (PR #597, deployed with #599 on Oct 26
  after the Vercel pause; Lead.saidNoHow + keepFollowingAt confirmed in production, read-only).** Every new
  message is read three ways (their own words, the scoring read, five AI readings); any one that says stop stops the
  follow-ups. A maybe-no's reply always waits; Today and the customer's page say "said no" / "might be saying no" in
  words with "Keep following up". Owner emails now go only when a reply needs them, a customer is ready, a call is
  coming or something broke; routine replies buzz the phone only. Migration: Lead.saidNoHow + keepFollowingAt.
  Next: the 50 test conversations for the founder to check.
- **Customers rows say what to do, in words (A-325, R-141, Oct 24) LIVE (PR #596 → 6e3d2ca, merged at the
  founder's "help me and merge"; deploy green; no migration):** a row whose reply is ready says "Check and send your
  reply" in bold, a ready-to-book row "Ready to book. Call them" beside Call. No dots.
- **Customers like a phone's message list (A-324, Oct 24) LIVE (PR #595 → 19684b7, merged at the founder's "merge";
  deploy green; no migration):** one list, newest message on top, no groups or white box; "New" pill on a customer's
  first day; Call stays on Ready to book. Supersedes A-307's Customers groups and A-323's New group.
- **Check the checker (plan step 4, A-321, Oct 23) LIVE (PR #594 → f73782e, merged at the founder's "MERGE";
  tables, column and migration confirmed in production, read-only):** Admin → Train → Mark replies: the founder marks
  60 test replies; each check shows how often it agrees; checks that disagree too often become advice only in the
  lesson test. Migration: 2 tables (RLS on) + LessonTest.advisory.
- **The honest test (plan step 3, A-320, Oct 23) LIVE (PR #592 → 68b7ce8, merged at the founder's "merge";
  columns and migration confirmed in production, read-only):** the lesson test on Admin → Train now
  blocks outright (no "anyway") when the changes break one of FollowUp's own code checks on 2 of 3 tries and never
  without them; writes 2 customer messages plus 1 reworded for each of the first 3 new rules (kept per wording,
  `src/lib/ruleTestMessages.ts`) and reads those replies against the rule; and once per kind per model, then monthly,
  answers the 20 messages a second time with nothing changed to say how many move by chance. Migration: 3 LessonTest
  columns + TrainingRule.testMessages.
- **What happened after each draft (plan step 2, Oct 23) LIVE (PR #591 → 494020f, merged at the founder's "Merge";
  columns, index and migration confirmed in production, read-only):** a sent reply now names the
  AI answer whose draft it used (`FollowUp.responseId`) and how much a person changed it (`editSize`, 0 to 1, a
  number, never the words); a "Don't send" keeps the answer's id in its audit row. `src/lib/decisionOutcome.ts` turns
  that into what the owner did (sent by itself / sent as written / edited / rewritten at half the words or more / not
  sent) and what the customer did next with the founder's windows: replied within 3 days, booked within 14, said no,
  stopped, went quiet, or "waiting" (never "no" while a window is open). `loadDraftOutcomes` reads it for the weekly
  review (step 7); no screen yet. Migration: 3 columns + 1 index on existing tables.
- **The decision log (plan step 1, Oct 23) LIVE (PR #590 → 16dc818, merged at the founder's "merge"; AiDecision +
  RLS confirmed in production, read-only):** every AI call gets a row in `AiDecision`
  (src/lib/aiDecisionLog.ts, recorded where every call already passes, `getClient`): the job, the business and
  customer where known, the model asked and the dated version that answered, time, tokens, estimated cost, and what a
  deciding call chose. Never the words: the prompt is a fingerprint. Test runs log as "test:…", practice as
  "practice:…". Installed at server start, so tests never write. Migration: one table (RLS on). After it's live: read
  which dated model answers and ask the founder to pin it in OPENAI_MODEL.
- **A new lesson waits for a test and the founder's OK (A-319, Oct 23) LIVE (PR #589 → 231f663, merged at the
  founder's "merge"; LessonTest + replacesId + RLS confirmed in production, read-only):** step 1 of the self-improving
  plan. Rules, taught answers and pasted conversations on Admin → Train wait in "Waiting for your OK" (only the
  practice chat uses them) until "Test them" answers the kind's 20 test messages 3 times without and 3 times with
  them, and the founder taps "Put them to work" (blocked if a reply got worse, unless "anyway"). Kinds with no test
  (all but Real estate) go in on the founder's OK alone. Research and the 13-step plan:
  `followup/research/product/2026-10-23-self-improving-loop.md`.
- **"Calls this week" + "Talk to FollowUp about your business" LIVE (A-317, A-318, Oct 22, PR #588 → bc8ae52, merged at the founder's
  "merge it"; no migration):** both drawn and approved with "yes build both". Today's Later has "Calls this week · N booked", opening
  `/calls`: the calls booked through the owner's link for the next 7 days, by day, one sentence naming the quiet days,
  "Next week". The 5-minute meeting has "Rather talk? Talk for 2 minutes": the owner talks (up to 5 minutes), the
  recording is written down (same transcription as voicemails) and never stored, FollowUp reads the words against the
  meeting's questions (every line must be their words), and the same play-back shows it with "From what you said" and
  "Not in what you said". Only `/tell` may use the microphone. No migration (the words ride in `Business.tellDraft`).
- **"Missed by your CRM" LIVE (A-315, Oct 22, PR #585 → 0a79683, merged at the founder's "merge it"; deploy green; 3 columns + migration confirmed in production, read-only):** the founder's
  differentiation ask (*"I don't want CRMs to get all these features and eat us"*, option A, "yes build it"). Results
  opens with the customers who wrote by email, DM or form in the last 30 days and still aren't in the owner's CRM, by
  place, with **Add all** and **See who** (one Add each); each add creates the contact (Follow Up Boss /people with
  deduplicate, so no action plans fire; HubSpot contacts, using the one it has on a 409; GoHighLevel upsert) and writes
  their messages as a note. The first Add turns on "new ones go in by themselves" (after each full CRM check, 10 a run,
  only customers newer than the switch); Turn off on Results and a switch in the CRM's own window under Connected apps.
  Only counted once the whole CRM was checked, never anyone who said no or stop, never the practice customer. Chat
  customers now match the CRM by the email they gave in the chat. Two columns (`Lead.crmAddedAt`,
  `CrmConnection.autoAddSince/autoAddOff`). Privacy page says it. Same PR: **Next.js 16.4.2 + Sentry 10.76.2**
  (2 critical advisories Oct 22; not reachable here, but CI's audit fails on them).
- **Settings organised by what each name says LIVE (A-316, Oct 22, PR #587 → 8553d97, merged at the founder's "merge it"; deploy green; no migration):** the
  founder's rule (*"All the applications should be right there"*), audited page by page, drawn, and approved with "yes
  build it". Four moves, same switches and words: the **calendar** is a row under Connected apps (its window holds which
  calendar you book in and where customers book); **Your free hours** opens from Your business (hours only, with a link
  to the calendar); **Write like me** (admins only, as before) and **"Learned from you"** (was "How you work") moved to
  Sending replies. Everything else already sat where its name says.
- **"Tell FollowUp" as a 5-minute meeting LIVE (A-314, Oct 22, PR #584 → fc5da24, merged at the founder's "merge"; deploy green; `tellDraft` column + migration confirmed in production, read-only):** the founder rejected the check after every
  answer (R-139) and approved the drawing as "a 5-minute meeting just to get to know what their business is". Only
  questions and answers; answers wait in a draft (`Business.tellDraft`, one new column); the end plays the whole
  business back (FollowUp's checked read, the owner's lines with Edit, how FollowUp will use it, still to learn,
  "Anything wrong or missing?") and one "Looks right" saves it. Next to draw: the founder's idea to talk to FollowUp
  about the business (voice, transcribed, same play-back).
- **"Tell FollowUp" as a conversation LIVE (A-313, Oct 22, PR #583 → 158e1b3, merged at the founder's "merge"):** the founder asked for it to feel like a real
  conversation and said "yes build it" to the drawing. Each next question is worded for the business (checked, plain
  fallback); one more question when an answer can't help a customer; "Who you work with" and "What you don't do" asked
  of everyone (the first also feeds the customer check, the second only replies). Phone bar title fixed. The AI parts
  were stood in for locally; next: the founder tries it live (their own account as Something else).
- **"Tell FollowUp about your business" LIVE (A-311 + A-312, Oct 22, PR #582 → bcfa9ae, merged at the founder's "Yes /
  Merge too" after seeing the built screens):** the founder said "Sure" to the drawings. A card on Today (once, after FollowUp has shown it works, 3+ questions open) opens a conversation under
  Settings › Your business: one question at a time, the owner's words split into facts, saved only on "Use these".
  `/teach` opens it. One new column (`Business.tellCardClosedAt`). Left out on purpose: "when to hand over", "never
  promise", "how you sound" (milestone 3: facts are quoted word for word and can't carry a rule). The AI split was not
  seen locally (no key); next: the founder answers two questions live to see it. Report: plan section 8.
  The founder's own account becomes their web design side business (kind: Something else, realtor facts removed); the
  realtor test moves to a new account invited from /admin. No "Web design" kind (R-138).
- **Personal AI assistant brief, milestone 1 built (Oct 22, PR #582, not merged):** the founder's brief (parts 1–22) is
  audited in `followup/research/product/2026-10-22-ai-assistant-system-plan.md`: Train It and Talk to It exist but are
  founder-only (Admin → Train); owners have Try it yourself + Write it better, Teach FollowUp, What FollowUp knows,
  Teach it your way. Milestone 1 (no screen changes): founder rules and examples have statuses, versions and a history
  (`LearningEvent`), Undo rolls back and can be restored, pasted-conversation permission is stored, owner examples are
  admin-only, and `src/lib/actionPolicy.ts` lists every action with who must allow it (a test fails if an automatic
  sender ignores "ask me first"). Waiting: the founder's answers to the 5 decisions in section 6 (onboarding vs R-027,
  a test step for founder rules, owner Talk to It vs R-136, corrections vs R-137, identity), then drawings for
  milestones 2–3.
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
