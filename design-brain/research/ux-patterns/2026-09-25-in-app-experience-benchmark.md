# In-app benchmark: how the best tools tell a busy owner "who needs me, why, and what to do"

**Date:** 2026-09-25
**Author:** product narrative lane (research and recommendations only)
**Question:** An owner has two minutes between jobs. What do the best inbox, CRM and approval-queue products do so the user knows at once *who needs me, why, and what to do*, and trusts the work the software did without them? How does FollowUp's app compare?
**Code read at:** branch `claude/followup-demo-to-production-4k39hr`, HEAD `b7b1f72`, clean tree.
**What this is:** research and a ranked list of recommendations. **No UI code, component, page or token was changed. Nothing here is approved.** Sahil designs the screens. This file says what to fix and why, not how it should look.

---

## In plain words

1. The best tools show one line per person: who it is, what they want, and how long they've waited.
2. They explain every automatic action in one sentence, right where you see it.
3. They keep the few things that need your judgement apart from the routine many. FollowUp already does this well.
4. They show the reply the way the customer will get it, and let you fix it on the spot.
5. They say who did what: you, or the software, and which setting made it happen.
6. When the customer writes again, anything waiting gets cancelled or rewritten, and the screen says so.
7. They reach your phone once, and only when a real person is waiting.
8. They hand over more work one kind of message at a time, after you've watched them get it right.
9. FollowUp is ahead on honesty. Every held reply has a reason. There's a 10-second undo. "Nothing needs your OK" is said out loud.
10. It falls behind in six places: no waiting time on a card, counts that disagree, the reply shown in grey, "You" on messages FollowUp sent, no translation, and nothing that reaches the owner outside the app.

## Top 5 recommendations

| # | What changes | Why it matters to the owner | Effort | Type |
|---|---|---|---|---|
| 1 | **Every card in "Needs your OK" starts with one plain line: who, what they want, how long they've waited.** If they wrote again after the reply was written, the card says so. | The owner decides in one glance. They never send a reply to an old message by mistake. | S–M | Presentation, plus two fields passed to the card |
| 2 | **Tell the owner outside the app, once, when a real person is waiting.** Tapping it opens that card. | Today the app only works if the owner remembers to open it. On 2026-09-21, 23 people were waiting and the oldest had waited 175 hours. | M | **Behaviour. Sahil's call** |
| 3 | **Make the reply the main thing on the card, and let the owner fix it right there.** Same button and same 10-second undo everywhere. | The owner is approving what the customer will read. Right now it's in grey, and "Edit" takes them away to a page with no undo. | S (look) / M (fix in place) | Presentation |
| 4 | **Every sent message says who sent it and whether it arrived.** It says "You" or "FollowUp, on its own", then Sent or Didn't arrive. Every automatic action links to the setting behind it. | Answers "what happened, and how do I change it?" without hunting. | S–M | Presentation |
| 5 | **One number, one meaning.** The headline, the queue heading and the bell all count the same thing: people waiting for your OK. | Today one screen can say "12 drafts need your OK" and "Needs your OK (3)" a few lines apart. | S | Presentation |

The full ranked list, with the reason for each and a check against `rejected.md`, is in §5.

---

## 1. The question, and how this was answered

**Who:** the owner of a small business (realtor, contractor, local service). They check the app on a phone, between jobs, often with under two minutes. They are not a software person (brand principle 4).

**What they need from a screen:** who is waiting on me, why, and what I should do. And some confidence that what FollowUp did on its own was right.

**Cost of getting it wrong:** a lead goes cold while the owner scrolls. Or FollowUp sends a reply the owner didn't really read, and the owner stops trusting it. Manoj is the example on file (`research/product/2026-09-25-first-run-hunt.md`).

**What I read first (all of it, not from memory):**
- The design brain: `README.md`, `brand/brand-principles.md`, `decisions/approved.md`, `decisions/rejected.md`, `workflows/research-workflow.md`, the `references/{crm,dashboards,messaging,navigation}` READMEs, `research/research-log.md`, `research/competitors/README.md`, `research/ux-patterns/` (README and the 2026-09-12 trust file), and the relevant `design-decisions.md` entries: D-007 and the 2026-09-22 to 2026-09-24 queue entries.
- `followup/research/product/2026-09-24-simplify-the-app.md` and `2026-09-25-first-run-hunt.md`, in full. **This report builds on both and does not repeat them.** Where they already cover a gap, I point to them.
- `followup/PRODUCT_DIRECTION.md` (the six rules).
- The app's code: Today (`dashboard/page.tsx`), `ApprovalQueue.tsx`, the lead page, `MessageComposer.tsx`, `ConversationThread.tsx`, `AutomationStatusBadge.tsx`, `LeadTrustPanel.tsx`, Leads, Pipeline, Activity, Analytics, Follow-up plans, Settings (tabs and headings), `Sidebar.tsx`, `NotificationBell.tsx`, `ItemBox.tsx`, and the libraries behind the queue (`pendingApprovals.ts`, `approvalGroups.ts`, `holdReasons.ts`, `staleApprovals.ts`, `automation.ts` stale-draft check).

**External research:**
- 38 WebSearch queries across Linear, Superhuman, Front, Intercom, Help Scout, Missive, Attio, Close, HubSpot, Follow Up Boss, Podium, Stripe, Notion, Apple Mail, Gmail, Zendesk, Fyxer and Jobber, plus research on human–AI design and mobile attention.
- **WebFetch was blocked** (`EGRESS_BLOCKED`) on linear.app. I then tried plain requests to 24 help and docs sites through the proxy, and 23 of them were refused.
- **Two sites were reachable, and I read them in full:** Microsoft Research (the CHI 2019 *Guidelines for Human-AI Interaction* paper, PDF) and Apple's Human Interface Guidelines (notifications, managing notifications, tab bars).
- I didn't log into any product, didn't scrape anything behind a login, and only used public pages.

**How much to trust each source.** Every claim below carries one of these grades:

| Grade | Meaning |
|---|---|
| **A** | A primary source I fetched and read myself this session |
| **B** | The product's own help page or docs, seen only through a search summary. The page exists and says roughly this, but the wording is paraphrased. Don't quote it on a screen. |
| **C** | A third-party article, review site, forum thread or single report, seen through a search summary |
| **D** | My own inference. Marked **[inference]** where it appears. |

**A help page describes what a product is meant to do, not what I saw it do.** I haven't used any of these products for this report.

**Population warning.** Most of these products serve people at a desk: support agents, sales reps, engineers. FollowUp's owner is on a phone. I kept only mechanisms that still work for a thumb and a 90-second visit. Linear and Superhuman are best known for keyboard speed, and that part is excluded on purpose (R-002).

---

## 2. What the design brain already rules out

Nothing in this report re-proposes any of these:

- **R-002.** No keyboard shortcuts, command palette or "fast once you learn it". I only borrowed the *non-keyboard* mechanisms from Linear and Superhuman.
- **R-001.** Stripping a screen down isn't a redesign. None of the recommendations below remove anything. Each one adds a fact the owner is missing today.
- **R-003.** No switching the channel a lead chose.
- **S-13.** No AI labels or sparkles, and no "AI" persona. FollowUp is the subject of the sentence: "FollowUp wrote…".
- **S-16.** Copy the principle, never the screen.
- **A-006.** Every colour comes with its word. The accent is used once per screen. Boxes are one level deep. At most three colours on a screen.
- **D-007's exclusions:** no swipe-to-approve, no "approve all" beyond the guarded routine pile, **no confidence percentage**, no auto-send countdown, and **no approving straight from a notification** (too little context for a message you can't take back). This matters for recommendation 2.
- **No streaks, points or celebration screens** (`2026-09-13-usability-and-engagement.md`).
- **D-020's greeting change was part of the rejected R-001 proposal.** Today's largest text is still the greeting "Good morning". The brain's own dashboard notes list a greeting in prime space as a mistake. Because the founder rejected that exact move, I'm not recommending it. It's listed in §6 as a question for Sahil.

---

## 3. Thirteen patterns from the best products

Each pattern gives: **what works**, **how it works**, **why they chose it**, **the evidence**, and **where FollowUp is today**.

### A. "Who needs me?"

#### P1. A list that empties as you work, and shows what comes back later

- **What works:** the work list *is* the to-do list. Handle a person and they leave. They come back only when there's a reason.
- **How:**
  - Close's Inbox gathers inbound email, missed calls and due tasks into one list the help centre calls "a to-do list". It has a **Done** view (what you finished) and a **Future** view (snoozed or scheduled items).
  - Follow Up Boss's Smart Lists are "cleared" by contacting each lead. A lead drops off the list and comes back when it meets the rule again.
  - Superhuman brings a thread back when a reminder is due.
- **Why:** an empty list is a finish line, and seeing what's coming back later means the owner doesn't have to remember it.
- **Evidence:** Close Inbox help (B). Follow Up Boss "Working Your Smart Lists" (B). Superhuman "Auto Reminders & Auto Drafts" (B).
- **FollowUp today:**
  - "Needs your OK" already behaves like this. Cards leave when handled, and the next one moves up by itself (2026-09-23 entry).
  - **Missing: the "Future" half.** Nothing on Today says "FollowUp will write to these four people next, around 3pm". The lead page knows ("Draft ready in ~3h", `AutomationStatusBadge.tsx`), but Today doesn't show it.

#### P2. One line per person: what they want and how long they've waited

- **What works:** before you open anything, each item tells you why it matters *now*.
- **How:**
  - Superhuman's Auto Summarize puts a one-line summary above every conversation and updates it as new mail arrives.
  - Gmail's nudges say "Received 3 days ago. Reply?".
  - Apple Mail moves a sent message back to the top after about three days with no answer.
- **Why:** on a phone, attention comes in short bursts. A CHI 2005 field study titled *"Interaction in 4-second bursts"* found that people on the move looked at their phone for roughly 4–8 seconds at a time. **The deciding facts have to fit in the first line.**
- **The warning from the same pattern:** Gmail's nudges were criticised when they launched in 2018. They reordered the inbox, used orange text, and made people feel judged ("you should have replied"). Reviewers said it made users feel no longer in control of their inbox. Apple Community threads report old emails jumping to the top by mistake. **So state a fact about the customer** ("Priya has waited 5 hours). **Never make a judgement about the owner** ("you forgot"). And a wrong nudge must be easy to clear.
- **Evidence:**
  - Superhuman Auto Summarize help and blog (B).
  - Gmail nudges: TechCrunch 2018, Slate 2018, Google community threads (C).
  - Apple Mail Follow Up: MacRumors and Apple Community (C).
  - Oulasvirta et al., CHI 2005, ACM Digital Library listing (B: the paper exists; the figures come from a summary).
- **FollowUp today:**
  - The approval card shows the name, the reason it was held, the lead's last message and the reply. **It shows no time at all.** The data has `heldAt` but not the time of the lead's message (`pendingApprovals.ts:69`, `:77`).
  - The one line above the queue says *"Start with Priya — Gmail, scored 72"* (`ApprovalQueue.tsx:302`). A bare number is exactly what brand principle 6 says not to show.
  - The "About to be lost" rows *do* say "Waiting 5h". So the product already knows how to say it. The queue just doesn't.

#### P3. The few that need judgement, apart from the routine many

- **What works:** the product sorts before you do. Only a small, high-confidence group is treated as routine.
- **How:**
  - Fyxer sorts mail into categories led by "To Respond" and "FYI", and writes a draft for mail in "To Respond".
  - Superhuman splits the inbox automatically.
  - Linear's Triage Intelligence lets a team auto-apply a suggestion *only for specific properties or values* (for example, always the team, but only the "bug" label).
  - Zendesk added "pre-approved actions" in February 2026. An admin marks specific actions that may run without an agent clicking approve.
- **Why:** a queue of equal-looking items trains people to rubber-stamp. Keeping "routine" narrow keeps it trusted.
- **Evidence:** Fyxer help centre (B). Superhuman (B). Linear Triage Intelligence docs and the changelog of 2025-09-19 (B). Zendesk auto assist help (B).
- **FollowUp today: ahead of most.**
  - "Needs you" and "routine" are separate.
  - A reply nobody has checked is never treated as safe.
  - The owner can read three before sending forty.
  - Refusals are named, not just counted.
  - This is better guarded than anything I found described in the public docs.

### B. "Why?"

#### P4. One sentence of "why", right where the decision shows

- **What works:** every automatic decision carries its reason next to it, in plain words.
- **How:**
  - Gmail puts a line at the top of each spam message ("This message is similar to messages that were identified as spam in the past").
  - Linear shows the reasoning behind each triage suggestion. You can see why before you accept or decline.
  - Stripe Radar has a "risk insights" section on each payment that says why it got its risk level.
- **Why:** in a 2019 study, 49 designers tested 20 popular AI products against 18 guidelines. *"Make clear why the system did what it did"* was one of the **most violated**, even though participants could picture where an explanation belonged. Google's People + AI Guidebook says the same: show the reasoning so people know when to trust the system and when to use their own judgement.
- **Evidence:** Amershi et al., *Guidelines for Human-AI Interaction*, CHI 2019, read in full (A). Gmail spam explanations (B). Linear docs (B). Stripe Radar risk insights docs (B). Google PAIR "Explainability + Trust" (B).
- **FollowUp today: strong, with two weak spots.**
  - Every held reply says "Held because …". That's this pattern, and it's rare.
  - **Weak spot 1:** on an account that holds everything (every account today), the most common reason explains the *setting*, not the *person*: *"your account holds every automated message for you to approve before it goes out"* (`holdReasons.ts:28-29`). It says why the reply is waiting, not why this customer matters now.
  - **Weak spot 2:** the reason is set at 12px in grey (`ApprovalQueue.tsx:129-130`). The design brain's floor for real content is 14px (S-11). The most important sentence on the card is its smallest.

#### P5. Say who acted — a person or the software — and which setting made it happen

- **What works:** every entry in the history names who did it. When it was an automatic rule, one tap takes you to that rule.
- **How:**
  - Front's activity history shows "which teammate or rule executed" each action. You can click the rule name to edit it.
  - Intercom separates what Fin (its AI) did from what a teammate did, and labels why Fin handed over: the customer asked, or a rule said so.
  - HubSpot records on the contact's timeline *why* a contact was taken off a sequence (for example, they replied).
- **Why:** "What happened?" and "What can I do?" are answered in the same place. The fix is one tap from the explanation.
- **Evidence:** Front "Understanding activity history" (B). Intercom Fin outcomes and escalation help (B). HubSpot "Unenroll contacts from a sequence" (B). Microsoft guideline 17, "Provide global controls" (A).
- **FollowUp today:**
  - **The conversation labels every outgoing message "You"** (`ConversationThread.tsx:87`), including ones FollowUp sent on its own.
  - The data to tell them apart exists. Each message records what FollowUp sent it for (`Message.trigger`) and whether it arrived (`Message.deliveryStatus`). The conversation view uses neither.
  - "Consent & AI activity" on the lead page lists what FollowUp did, but no entry links to the setting behind it.
  - This also answers an open question in `ux-patterns/README.md`: *"How is 'this was sent automatically' best communicated in a message thread?"*

#### P6. Honest labels on numbers

- **What works:** a number says when it's an estimate.
- **How:** Intercom counts a conversation as an "assumed resolution" when the customer simply leaves for 24 hours. It keeps that apart from confirmed resolutions.
- **Why:** a padded number, once noticed, makes every other number suspect.
- **Evidence:** Intercom "Fin AI Agent outcomes" (B).
- **FollowUp today: ahead.**
  - *"Only replies to messages FollowUp sent on its own count here — your own replies are yours"* (`dashboard/page.tsx:401`).
  - *"Showing the last 60 events"* on Activity.
  - The weak spot is already on file: two tiles that read 0 on every holding account (`2026-09-24-simplify-the-app.md` #1(d)).

### C. "What can I do, and can I trust it?"

#### P7. Show the reply as it will arrive, and make editing normal

- **What works:** the drafted reply looks like the real message. Changing it is expected, not a fight.
- **How:**
  - Help Scout's AI Drafts arrive as ordinary drafts: "review, revise if needed, and send… just like any other draft". Nothing goes out on its own.
  - Superhuman's Auto Drafts appear in the thread about an hour before a follow-up is due, "ready for you to review and send".
  - Notion AI offers accept, discard, or try again on every change it makes.
- **Why:** the documented fear is that the business will sound fake (2026-09-12 trust file, Finding 2). You only lose that fear by reading the actual words, in the actual form.
- **Evidence:** Help Scout AI Drafts (B). Superhuman help centre (B). Notion help (B). Microsoft guideline 9, "Support efficient correction" (A).
- **FollowUp today:**
  - On the card, the lead's message is in full-strength ink and **the reply is in secondary grey** (`ApprovalQueue.tsx:154`), labelled "The draft reply:". The thing being approved looks less important than the thing it answers.
  - **"Edit" leaves the queue** for the lead page. There the same reply is headed "AI-suggested follow-up" and sent with "Send now", which has no undo. This is already covered as `2026-09-24-simplify-the-app.md` #4. The benchmark adds evidence that editing belongs where the reply is.

#### P8. When the customer writes again, anything waiting gets cancelled or rewritten, and the screen says so

- **What works:** new activity from the customer overrides whatever the software had planned.
- **How:**
  - Front cancels a snooze automatically if the recipient replies.
  - Linear brings a snoozed notification back automatically when there's new activity.
  - Intercom's Fin stops replying the moment a teammate answers.
  - HubSpot takes a contact off a sequence when they reply, and records why.
- **Why:** it's the same promise FollowUp makes ("stops the instant a lead replies"). The best products also *show* it happening.
- **Evidence:** Front snooze help (B). Linear inbox docs and 2021 changelog (B). Intercom Fin help (B). HubSpot (B).
- **FollowUp today:**
  - Automation stops on reply, and that's a real guarantee.
  - **But a held reply can go stale on the card.** The card shows the lead's *latest* message above a reply that may have been written *before* it. The fresh rewrite waits for the next hourly pass inside the send window (`automation.ts:712`, `suggestedDraftedFor`). Until then nothing on the card says "she wrote again after this was written".
  - An owner approving at 9pm can send an answer to the wrong question. **[inference: not observed, but the code allows it]**

#### P9. A short pause before sending, called what it is

- **How:** Gmail's Undo Send holds the message for 5, 10, 20 or 30 seconds (default 5). It delays the send; it doesn't recall anything.
- **Evidence:** Google Gmail help (B).
- **FollowUp today: ahead.**
  - A 10-second pause on single and bulk sends.
  - The wording tells the truth: "Sending to Priya in 10s", not "Sent".
  - Leaving the page still sends, and the reason is written down (2026-09-23 entries).
  - One open item carries over: after the pause the card simply disappears, with no "Sent" line (`2026-09-25-first-run-hunt.md` §2.7).

#### P10. A quick "no", with an optional reason that teaches

- **What works:** a wrong suggestion can be dismissed in one tap. The product can learn from why.
- **How:**
  - Apple Mail has "Clear Follow Up Suggestion" on each message.
  - Linear triage has Decline.
  - Fyxer learns when you move an email to a different category.
  - Microsoft's guideline 15 example is an email product letting the user mark something important that the AI missed.
- **Why:** false alarms are the main cost of an assistant that brings things to your attention (see the Gmail criticism in P2). Correcting one should also make the next one better.
- **Evidence:** Microsoft guidelines 8 and 15 (A). Apple Mail (C). Linear (B). Fyxer (B).
- **FollowUp today:**
  - "Don't send" exists and is one tap.
  - **There's no way to say "this isn't a customer".** On file: the photographer filed as a lead (2026-09-20) and Manoj's drafts for old threads (09-24, H2).
  - Also no optional reason. The passive-feedback pillar has no hook here.

#### P11. More freedom one kind of message at a time, earned by a track record

- **What works:** the software asks for more freedom per *kind* of action, not all at once, and after the user has seen it work.
- **How:**
  - HubSpot's prospecting agent has two plainly named modes, "review before sending" and "send automatically", and notifies the rep in the app when a draft is ready. Consultants' guides commonly advise reviewing 50–100 drafts before switching.
  - Linear auto-applies suggestions per property or per value.
  - Zendesk pre-approves specific actions.
- **Why:** trust is built on specific, repeated evidence. Microsoft guideline 14, "Update and adapt cautiously", points the same way.
- **Evidence:** HubSpot knowledge base (B). The 50–100 figure is from third-party guides (C). Linear (B). Zendesk (B). Microsoft (A).
- **FollowUp today:**
  - One account-wide permission, a per-lead mode and per-source rules.
  - The track record already exists as a number: "Drafts sent as written" (`analytics/page.tsx:104`). It sits as row 7 of 9 on Analytics.
  - Already proposed as `2026-09-24-simplify-the-app.md` #11. The benchmark adds the *per-kind* idea.

### D. "Reach me, and speak my language"

#### P12. Reach the owner outside the app: once, only when it matters now, and landing in the right place

- **What works:** a notification that is rare, accurate about urgency, and one tap from the decision.
- **How (Apple's own rules, read in full):**
  - *"Avoid sending multiple notifications for the same thing, even if someone hasn't responded."*
  - *"Build trust by accurately representing the urgency of each notification."*
  - Use the Time Sensitive level only for something *"happening now or will happen within an hour."*
  - A notification can offer up to four actions, and should *"avoid providing an action that merely opens your app"*. Calendar's Snooze is the example.
  - Avoid sensitive or personal information, because other people may see the screen.
  - A badge is for critical information only: *"Reserve badges for critical information so you don't dilute their impact."*
- **What the category does:**
  - Follow Up Boss pushes a notification for new leads and inbound texts.
  - HubSpot's agent sends an in-app notification when a draft is ready to review.
  - Podium pushes a notification when a teammate mentions you.
- **Why:** for an owner up a ladder, the app is only as good as the moment it gets opened.
- **Evidence:** Apple HIG, Notifications and Managing notifications (A). Follow Up Boss app and help centre (B/C). HubSpot (B). Podium (B).
- **FollowUp today:**
  - The bell checks every 45 seconds, but only while the app is open (`NotificationBell.tsx:24`).
  - One reminder goes out when a reply has waited too long (`staleApprovals.ts`), plus the Monday email digest.
  - **No push and no per-person email.** The phone app wrapper exists but has no push notifications yet (`mobile/README.md`).
  - The code records why this matters: on 2026-09-21 there were *"twenty-three leads in the approval queue, the oldest waiting 175 hours"* (`staleApprovals.ts` header).
  - The bell's badge counts unread notifications, not people waiting on the owner.

#### P13. Read it in your own language, with the original one tap away

- **What works:** the person approving can understand both sides, whatever language the customer wrote in.
- **How:**
  - Intercom's AI Inbox Translation shows the customer's message in the teammate's language and translates the reply back. The original language is noted under the message and is one click away.
  - Front shows a "[Language] detected" banner with the translation above the original, and it can be collapsed.
  - **The warning:** Help Scout's AI summary is always in English and has to be refreshed by hand. Its help page says summaries "can be inaccurate or misleading".
- **Why:** you can't approve words you can't read. FollowUp's mission is *"in every language"* (`PRODUCT_DIRECTION.md`, main goal 3).
- **Evidence:** Intercom help (B). Front help (B). Help Scout AI Summarize help (B).
- **FollowUp today:**
  - FollowUp writes replies in the lead's language, which is correct.
  - **The owner sees no translation of the lead's message or of the reply.**
  - The founder's own queue on 2026-09-20 held *"El costo será de $100"*, a made-up price in Spanish (2026-09-22 entry). An owner who doesn't read Spanish could only have caught it from the hold reason. **[inference]**
  - No earlier research in the repo covers this.

---

## 4. FollowUp, screen by screen

"Covered before" means an earlier report already has it. I don't re-argue those here.

### Today (`/dashboard`)

- **Shows first (phone, account with leads):**
  - "Good morning" as the largest text.
  - One computed sentence: "12 drafts need your OK · 4 leads going quiet".
  - Then "Needs your OK (3)", with "Start with Priya — Gmail, scored 72."
  - Then up to three full cards per channel. Each is about 509px tall on a phone (measured 2026-09-23), so **roughly one person per screen**.
  - Then a "Show 3 more" row and a routine row ("Send all" and "Read a few first").
  - Then three number tiles, "About to be lost" (up to 8), the setup list, "What FollowUp did for you this week", "Upcoming calls" and "See all numbers".
- **Asks for:** three buttons per card (Approve & send · Edit · Don't send), plus the fold, the routine send and the peek. With one channel and three cards, that's about 12 controls before the tiles.
- **Does well:**
  - The queue comes first.
  - A reason on every card.
  - The customer's words come before the reply.
  - Routine replies are fenced off, and "not checked" never counts as "safe".
  - A 10-second undo.
  - A calm all-clear.
  - Colour always comes with a word.
- **New gaps found here:**
  - No waiting time on cards (P2).
  - "scored 72" in the top line (P2, P4).
  - **The headline counts every held reply** (`dashboard/page.tsx:142-143`, `approvalItems.length`), **while the queue heading counts only the ones needing a decision** (`ApprovalQueue.tsx:289`, `summary.needsYou`). With routine replies waiting, the two numbers disagree a few lines apart. This arrived with the 2026-09-23 grouping, and the fix that day covered a different line.
  - The reply is in grey and the reason is 12px (P4, P7).
  - A card doesn't warn when the customer wrote again after the reply was written (P8).
  - Nothing says what FollowUp will do next (P1).
- **Covered before:**
  - Tiles that read 0 on holding accounts.
  - The same person shown twice.
  - "Automation is already working these" (still at `:343`) is false on holding accounts.
  - The card simply disappears after sending (`2026-09-24-simplify-the-app.md` #1; `2026-09-25-first-run-hunt.md` §2.7).

### The "Needs your OK" card, piece by piece

| Line | Today | What the best tools add |
|---|---|---|
| 1 | Lead name (link) | Name **+ how long they've waited + channel** (P2) |
| 2 | "Held because …" at 12px grey | The same sentence at reading size (P4). When the only reason is the account setting, lead with *why this person*, for example the lead's own score reason |
| 3 | "Priya said, over email:" + her message | Unchanged. This is right. Plus a translation when needed (P13) |
| 4 | "The draft reply:" + reply in grey | The reply at full strength, as the message she'll get, and editable right there (P7) |
| — | *(nothing)* | "She wrote again after this was written" when true (P8) |
| 5 | Approve & send · Edit · Don't send | Same three. "Don't send" can then ask an optional one-tap reason (P10) |

### Lead page (`/leads/[id]`)

- **Shows first:**
  - The name.
  - The reason this lead matters, plus "82/100".
  - A priority pill, the stage picker and "$X potential".
  - Contact chips.
  - The status box (what FollowUp is doing and why; it pulses when a reply is coming).
  - "AI-suggested follow-up" with Send now and Regenerate.
  - The conversation, then the score factors, then four folded sections and Delete.
- **Asks for:** about 10 controls.
- **Does well:**
  - The status box answers "what is FollowUp doing with this person, and why". That's rare in the category (P5).
  - It says "FollowUp hasn't reviewed this lead yet" instead of faking a verdict.
- **New gaps found here:**
  - Every sent message reads "You" (P5).
  - Failed deliveries aren't shown (P5).
  - Activity entries don't link to the setting behind them (P5).
  - No translation (P13).
  - The status dot pulses (`AutomationStatusBadge.tsx:222`, `:231`) on states that can be hours away. That's movement that doesn't explain a change (S-08), and it's mild urgency on the calmest screen (principle 2).
- **Covered before:** the reply box sits above the conversation, "Send now" has no undo, and the heading still says "AI-suggested follow-up" (`2026-09-24-simplify-the-app.md` #4).

### Leads (`/leads`)

- **Shows first:** "Leads · N total, sorted by follow-up priority", **[Add lead]** as the filled button, 9 filter chips, Custom filter, search, then one row per person (name, value, "Silent N days" plus up to two facts).
- **Does well:** the row facts are words that survive on a phone, and colour always comes with its word.
- **New gaps found here:**
  - A lead with a reply waiting for your OK doesn't say so in its row.
  - "Add lead" is the loudest button on a screen full of people going quiet. The brain's own CRM notes list exactly this as a mistake (`references/crm/README.md`). The code comment argues the opposite. **Flagged, not decided: Sahil's call.**
- **Covered before:** 9 chips down to 4, team words for a one-person business, and "following up soon" wording (`2026-09-24-simplify-the-app.md` #6, #8).

### Pipeline (`/pipeline`)

- **Shows first:** three tiles, a line explaining "Likely to close", then a seven-column board you swipe sideways.
- **New gap found here:** card text and the stage picker are 12px (`PipelinePageClient.tsx:237`, `:281`). That's below the 14px floor for real content (S-11). Cards also show a bare score number.
- **Covered before:** move it out of the menu and into Leads as a "By stage" view (`2026-09-24-simplify-the-app.md` #2).

### Activity (`/activity`)

- **Does well:** grouped by day, honest about being capped, and treats "Stopped itself" as a good event.
- **New gap found here:** entries don't link to the rule or setting that caused them (P5).
- **Covered before:** nearly empty on holding accounts; out of the menu (09-24 §2).

### Analytics (`/analytics`)

- **Does well:** honest sentences under the numbers.
- **Gap:** "Drafts sent as written" is the owner's track record, and the one number that could earn FollowUp more freedom. It's row 7 of 9 (P11; 09-24 #11).

### Follow-up plans, and Settings

- **Covered before**, in full (09-24 #3, #7, #12).
- **One thing FollowUp does well here:** before sending is switched on, the permission panel makes the owner read four facts. HubSpot's public docs describe its two modes, but I found no similar step described before switching. That's an absence in the docs, not something I saw in the product (B).

### Menu, bell and notifications

- **Shows first on a phone:** logo, bell and a menu button hiding seven items.
- **The bell's number counts unread notifications.** It doesn't count people waiting on the owner.
- **New gaps found here:**
  - The badge's meaning (P12: Apple says badges are for critical information).
  - Nothing reaches the owner outside the app (P12).
- **Covered before:** seven menu items down to three, with a bottom tab bar (09-24 #2); a message outside the app (09-24 #9). The benchmark **raises the priority** of the second.

### Where FollowUp is already ahead: say this plainly

1. A reason on every held reply. Microsoft's study found this is what most AI products fail to give (P4).
2. "Routine" is narrow, guarded, and can be spot-checked before a bulk send (P3).
3. A 10-second pause before sending, described honestly (P9).
4. Honest number labels (P6).
5. A calm, stated all-clear.
6. A status line per lead answering "what is FollowUp doing and why" (P5, the lead page).
7. Four facts to read before granting permission to send (P11).
8. Colour never appears without its word. That's better accessibility than most CRMs.

---

## 5. Ranked recommendations

**Effort:** S = under a day · M = 1–3 days · L = a week or more (these are guesses; see §7).
**Type:** *Presentation* changes what's shown or said. *Behaviour* changes what the product does, and needs **Sahil's decision** under `PRODUCT_DIRECTION.md`.
**Rule** refers to the six rules in `PRODUCT_DIRECTION.md`. "Table stakes" means needed to stay credible, not strategic.

### 1. Every card starts with who, what they want, and how long they've waited, and warns when the reply is out of date
- **What:**
  - The card's first line: name · waited 5h · Gmail.
  - Then one plain "what they want" line, reusing the lead's score reason, which FollowUp already writes.
  - The top line becomes "Start with Priya: she asked about Saturday's viewing 5 hours ago", instead of "scored 72".
  - When the customer's newest message is later than the reply was written, one line on the card: *"Priya wrote again after this reply was written. Read her new message first."*
- **Why:** P2, P4, P8. The owner decides in one glance (brand principles 4 and 6). It closes a real way to send the wrong answer (principle 1).
- **Effort:** S–M. The card needs the time of the lead's last message and the time the reply was written (`suggestedDraftedFor`). Both are already stored; neither is passed to the card yet.
- **Type:** presentation.
- **Rule:** 3; main goal 1 ("late or wrong follow-up").
- **Rejected-list check:** adds information and removes nothing (R-001). No number replaces the reason (D-007 excludes confidence percentages).

### 2. Tell the owner outside the app, once, when a real person is waiting
- **What:**
  - One message per *person*, never per reply.
  - Only for the time-sensitive case: someone new wrote and their first reply is waiting (`HOLD_ALL_FIRST_REPLY_REASON`, which the code already calls *"the most urgent kind of hold"*).
  - Never for routine replies.
  - The wording states a fact: *"A new customer wrote on Instagram. Your reply is ready for your OK."*
  - Put the customer's name and message in only if Sahil wants them on a lock screen (Apple advises against personal information there).
  - Tapping opens that exact card. At most one extra action: "Remind me in an hour".
  - **Not** "Approve" from the notification (D-007's exclusion).
  - Email now. Push once the phone app is built.
- **Why:** P12. The product's promise fails when the owner doesn't open the app. The 175-hour wait is the evidence.
- **Effort:** M for email. L for push, because it depends on the phone app's first real build.
- **Type:** **behaviour. Sahil's call.** This raises 09-24 #9 from #9 to #2.
- **Rule:** main goal 1; Rule 3.
- **Rejected-list check:** not a nagging loop. It's one message (principle 2), with no approve-from-lock-screen.

### 3. The reply is the main thing on the card, and the owner can fix it right there
- **What:**
  - The reply at full strength, labelled as the message it is ("Your reply to Priya").
  - The reason at reading size, 14px or more.
  - Tapping the reply makes it editable on the card, with the same "Approve & send" and the same 10-second undo.
  - The lead page uses the same words and the same undo (09-24 #4).
- **Why:** P7. D-007's own principle is that the message is the biggest thing, so approving it means having looked at it. S-11 sets the 14px floor.
- **Effort:** S for the look (Sahil designs it). M for editing on the card.
- **Type:** presentation.
- **Rule:** 3.
- **Rejected-list check:** not swipe, not approve-all, no keyboard (R-002), no "AI" label (S-13).

### 4. Every message says who sent it and whether it arrived, and every automatic action links to its setting
- **What:**
  - In the conversation: "You" when a person pressed send, and "FollowUp, on its own · first reply to a new enquiry" when nobody did (from `trigger` and the send record).
  - Show "Didn't arrive" (a colour with its word) from `deliveryStatus`.
  - In "What FollowUp did here" and on each hold reason, a small "Change this" link to the exact setting.
- **Why:** P5. Answers "What happened?" and "What can I do?" in one place. It also answers the open question in `ux-patterns/README.md` about how to show an automatic send in a thread.
- **Effort:** S–M.
- **Type:** presentation.
- **Rule:** 3, and Rule 2 (the record lives with us).
- **Rejected-list check:** FollowUp is named as the one acting. No persona, no avatar (S-13).

### 5. One number, one meaning
- **What:**
  - The headline, the queue heading and the bell badge (and a Today tab badge later) all count **people waiting for your OK**.
  - Routine replies get their own separate sentence ("9 more are routine").
  - Say "replies", not "drafts" (principle 9).
- **Why:** P12 (Apple: badges only for critical information), and brand principle 2: urgency stated once, precisely. Today three different numbers answer "how much needs me?".
- **Effort:** S.
- **Type:** presentation.
- **Rule:** table stakes.
- **Rejected-list check:** clean.

### 6. Read it in your own language
- **What:** when the customer's language differs from the owner's, show "In English: …" under the customer's message *and* under the reply. The original stays first.
- **Why:** P13. Approval without understanding isn't approval (principle 6). It serves the "every language" mission.
- **Effort:** M. One extra model call per held reply for a non-English lead.
- **Type:** **behaviour-adjacent** (cost). Sahil's call.
- **Rule:** 1 (depth on the job: this is moat, not parity) and 3.
- **Rejected-list check:** clean. The channel and the lead's language are unchanged (R-003).

### 7. Today's second list says what FollowUp will do next, and shows each person once
- **What:**
  - "About to be lost" becomes the list of people FollowUp will write to next, each with its time ("writes to her around 3pm, then asks you"), from the estimate the lead page already computes.
  - Leave out anyone already in "Needs your OK" (09-24 #1(b)).
- **Why:** P1 (the "Future" view). The owner trusts nothing is forgotten without having to remember it (principle 2).
- **Effort:** S–M.
- **Type:** presentation.
- **Rule:** 3.
- **Rejected-list check:** clean.

### 8. "Don't send" asks one optional question, and "Not a customer" teaches the filter
- **What:**
  - After "Don't send", one line with three optional taps: *Not a customer · I'll reply myself · The reply was wrong*.
  - Ignoring it costs nothing.
  - "Not a customer" moves the person out of Leads and records it for the import filter.
- **Why:** P10. It fixes the photographer and old-thread problems at the source, and gives the passive-feedback pillar a natural hook.
- **Effort:** S–M.
- **Type:** behaviour-adjacent (it feeds classification). Sahil's call.
- **Rule:** 2.
- **Rejected-list check:** optional and after the fact, so it adds no step to the main path.

### 9. More freedom one kind of message at a time, offered from the owner's own record
- **What:**
  - Offer permission by kind, not only account-wide or per lead: for example, "first replies to new enquiries" separately from "check-ins after a quiet week".
  - Offer it once the owner has sent enough of that kind unchanged, using the "Drafts sent as written" figure for that kind.
  - Honest numbers only, and dismissible.
- **Why:** P11. Extends 09-24 #11.
- **Effort:** L.
- **Type:** **behaviour. Sahil's call.**
- **Rule:** 5 (moat).
- **Rejected-list check:** no streaks or points; no pressure.

### 10. Settle "rows or whole cards on a phone" with a side-by-side choice, not an argument
- **What:**
  - Show Sahil two renders of the same real queue on a phone:
    - **(A)** today's full cards (about one person per screen);
    - **(B)** one short boxed row per person (who, why, how long) that opens into the full card in place.
  - He picks.
- **Why:**
  - Every triage tool in this benchmark has a skim layer (P1, P2).
  - The 2026-09-23 entry chose whole cards *on purpose* ("showing whole cards is the point").
  - A-006 already uses short boxed rows elsewhere on Today.
  - The two positions really do disagree. A-006's own lesson: when the direction is unknown, run a paired comparison instead of arguing a concept.
- **Effort:** S to prepare.
- **Type:** a question for Sahil.
- **Rejected-list check:** no concept is proposed from a guess (the standing note under R-002).

### 11. Small fixes
- **Pipeline card text:** raise it from 12px to the 14px floor (S-11). Effort S.
- **The pulsing dot** on "Writing a reply for you to approve": stop the pulse on states that are hours away. Keep the word. Effort S. Principle 2, S-08.
- **"Add lead" as the loudest button on Leads:** flag the conflict between the code and `references/crm/README.md` to Sahil. Don't change it quietly.

**Deliberately not proposed** (dead or excluded): keyboard shortcuts or a command palette (R-002); approving from a notification, swipe-to-approve, "approve all" beyond the routine pile, and confidence percentages (D-007); any channel fallback (R-003); celebration or "inbox zero" screens and streaks (2026-09-13); removing the greeting (part of the rejected D-020); AI labels or a persona (S-13).

---

## 6. Questions only Sahil can answer

1. **Outside-the-app message (rec 2):** email now, or wait for push in the phone app? And should the customer's name appear on a lock screen?
2. **Rows or cards on a phone (rec 10):** will you pick from two renders?
3. **Translation (rec 6):** worth one extra model call per non-English held reply?
4. **"Not a customer" (rec 8):** may one tap move a person out of Leads and teach the filter?
5. **Two conflicts in the brain, not resolved here:**
   - Today's largest text is the greeting, which the brain's dashboard notes call a mistake. But you rejected removing it (R-001 / D-020).
   - "Add lead" is the main button on Leads, which the brain's CRM notes call a mistake.
   - Which rule stands?

---

## 7. What I could not verify, and the weakest parts of this report

1. **No product was used.** Every product description comes from its public help pages or marketing, read through search summaries, because WebFetch was blocked. A help page says what should happen, not what ships.
2. **Grade B isn't a quote.** The search tool paraphrases the pages. Only the Microsoft paper and Apple's guidelines (grade A) were read word for word, and only those are quoted in quotation marks as their authors wrote them.
3. **Dropped for lack of evidence:**
   - How Attio shows its AI's reasoning (the search didn't show it).
   - HubSpot's line that a lead should "arrive with a reason it deserves attention". It's in the product lane's notes, but I couldn't find it again, so nothing here relies on it.
   - What Podium's AI Employee shows the owner after it replies (marketing pages only).
4. **Weaker than they look:**
   - The "review 50–100 drafts" advice is from consultants, not HubSpot (C).
   - The Oulasvirta 4–8 second figure comes from a summary. The paper's title says "4-second bursts".
   - The Gmail nudge criticism is 2018 press opinion (C).
   - Podium's complaint themes are from review sites (C).
5. **Most benchmark products serve desk workers.** I kept only mechanisms that survive a phone and a non-technical owner. That filter is my judgement.
6. **The ranking is judgement.** Nobody has watched an owner use FollowUp, for this report or before it. A five-minute test with one owner on one phone would check recommendations 1, 3 and 5 better than this document.
7. **Rec 1's "what they want" line is only as good as the score reason.** D-007 flagged this already: if the model writes "engagement lapse detected", the line fails. Not checked against real reasons here.
8. **The stale-reply risk (rec 1 and P8) comes from reading the code, not from seeing it happen.** One check: find a held reply whose lead has a newer message than `suggestedDraftedFor`.
9. **The effort sizes are guesses.** The 2026-09-23 log shows rendering finding problems the tests didn't. Assume every M also needs a rendering pass.
10. **Recommendation 2 is ranked high, but it's a behaviour change that also depends on an unbuilt phone app** (or on email). If Sahil defers it, recommendations 1, 3, 4 and 5 are all small presentation changes and can go first.

---

## 8. Sources

All checked on 2026-09-25.

**Primary, read in full (grade A):**
- Amershi et al., *Guidelines for Human-AI Interaction*, CHI 2019: [publication page](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/) and [paper PDF](https://www.microsoft.com/en-us/research/uploads/prod/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf). The 18 guidelines, the 49 practitioners and 20 products, and the finding that guideline 11 had among the most violations.
- Apple Human Interface Guidelines: [Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications), [Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications), [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars). Read through the site's public JSON data.

**Product docs via search summary (grade B):**
- Linear: [Triage Intelligence](https://linear.app/docs/triage-intelligence), [Auto-apply triage suggestions (changelog 2025-09-19)](https://linear.app/changelog/2025-09-19-auto-apply-triage-suggestions), [Inbox](https://linear.app/docs/inbox), [Inbox snooze (changelog 2021-06-17)](https://linear.app/changelog/2021-06-17-inbox-snooze-and-easier-issue-merge)
- Superhuman: [Auto Reminders & Auto Drafts](https://help.superhuman.com/hc/en-us/articles/46005658551053-Auto-Reminders-Auto-Drafts), [Auto Summarize](https://help.superhuman.com/hc/en-us/articles/38458640102291-Auto-Summarize)
- Front: [Snooze](https://help.front.com/en/articles/2088), [Activity history](https://help.front.com/en/articles/2414), [Translate with AI](https://help.front.com/en/articles/1402304)
- Intercom: [Fin AI Agent explained](https://www.intercom.com/help/en/articles/7120684-fin-ai-agent-explained), [Fin outcomes](https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes), [AI Inbox Translation](https://www.intercom.com/help/en/articles/10545610-ai-inbox-translation)
- Help Scout: [AI Drafts](https://docs.helpscout.com/article/1570-ai-drafts), [AI Summarize](https://docs.helpscout.com/article/1505-ai-summarize)
- Close: [Inbox](https://help.close.com/feature-guide/inbox)
- HubSpot: [Prospecting agent](https://knowledge.hubspot.com/prospecting/use-the-prospecting-agent), [Unenroll from a sequence](https://knowledge.hubspot.com/sequences/unenroll-from-sequence)
- Follow Up Boss: [Working Your Smart Lists](https://help.followupboss.com/hc/en-us/articles/360034301034-Working-Your-Smart-Lists), [iPhone App Overview](https://help.followupboss.com/hc/en-us/articles/360016174733-iPhone-App-Overview), [Mobile apps](https://www.followupboss.com/features/mobile-apps)
- Podium: [AI Employee](https://www.podium.com/product/ai-employee), [Release 25.4](https://www.podium.com/whats-new/25-4)
- Stripe: [Radar risk insights](https://docs.stripe.com/radar/reviews/risk-insights)
- Notion: [Suggested edits](https://www.notion.com/help/suggested-edits), [Review & approve plans before Notion AI runs](https://www.notion.com/help/review-and-approve-plans-before-notion-ai-runs)
- Zendesk: [About auto assist](https://support.zendesk.com/hc/en-us/articles/9945148867866-About-auto-assist)
- Fyxer: [Your new organized inbox, explained](https://support.fyxer.com/article/your-new-organized-inbox-explained)
- Gmail: [Send or unsend Gmail messages](https://support.google.com/mail/answer/2819488)
- Jobber: [Workflow overview](https://help.getjobber.com/en/articles/jobber-workflow-overview/) (read for the home-services context; not used in a recommendation)
- Google PAIR: [Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/)
- Nielsen Norman Group: [Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/)
- Oulasvirta, Tamminen, Roto, Kuorelahti, [*Interaction in 4-second bursts*, CHI 2005](https://dl.acm.org/doi/10.1145/1054972.1055101)

**Third-party via search summary (grade C):**
- [TechCrunch, "Gmail proves that some people hate smart suggestions" (2018)](https://techcrunch.com/2018/06/15/gmail-proves-that-some-people-hate-smart-suggestions/); [Slate on disabling Gmail's new features (2018)](https://slate.com/technology/2018/10/gmail-disable-annoying-new-features.html)
- [MacRumors, Apple Mail Follow Up](https://www.macrumors.com/how-to/use-follow-up-feature-apple-mail-ios/); [Apple Community thread on old emails moving to the top](https://discussions.apple.com/thread/254293018)
- [Salesforge, HubSpot Prospecting Agent review](https://www.salesforge.ai/blog/hubspot-prospecting-agent-review) and similar guides (the 50–100 drafts advice)
- [Capterra, Podium reviews](https://www.capterra.com/p/164285/Podium/reviews/)

**Internal (read first-hand at `b7b1f72`):**
- *App pages:* `src/app/(app)/{dashboard/page,leads/LeadsPageClient,leads/[id]/page,pipeline/PipelinePageClient,activity/page,analytics/page,workflows/page,settings/page,layout}.tsx`
- *Components:* `src/components/{ApprovalQueue,MessageComposer,ConversationThread,AutomationStatusBadge,LeadTrustPanel,CollapsibleSection,ItemBox,Sidebar,NotificationBell,SafePileAction}.tsx`
- *Libraries:* `src/lib/{pendingApprovals,approvalGroups,holdReasons,staleApprovals,leads-data,types}.ts`, `src/lib/automation.ts` (the stale-draft check)
- *Other repo files:* `mobile/README.md`, `followup/PRODUCT_DIRECTION.md`, and the design-brain and research files listed in §1
