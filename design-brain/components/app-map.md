# The app map: what lives where, and where new features go

**Refreshed 2026-10-17** (founder: *"lets jut keep organising every thing we will design and chose the colour later"*).
The section **"The app today (2026-10-17)"** below is the current truth. Older sections further down are kept for
history; where they disagree, this first section wins.

## The app today (2026-10-17)

FollowUp is organised like big software, simple on top (reports/UX laws and design psychology.md): **4 places**, **a
customer page**, **Settings with 5 groups**, **sheets and small windows** for single tasks, and **the back room** the
owner never sees.

### 1. The four places (tabs on the phone, sidebar on the computer)

| Place | What it holds, top to bottom | Decisions |
|---|---|---|
| **Today** | The day in one sentence · **Needs you** box, only when something broke (A-270) · the **first reply, open** (their words, the reply, Send / Change it / Skip) · **Then** rows: other replies ready, calls to make, "How did your call go?", before-your-call notes, their-moment notes, stay-in-touch notes, the practice customer · **Later** lines: tomorrow, done today, coming up, what FollowUp did on its own · one question a day · Home Screen and alerts cards until done | A-244, A-266, A-268, A-270 |
| **Customers** | Search · **one list** (reply ready first, then ready to book, then newest) with status words and Call on ready-to-book rows · **+ menu**: add a customer, log a call, import CSV, clean up · swipe left = Later | A-267, A-095 |
| **Activity** | One sentence ("This week it answered N people") · what FollowUp did **on its own**, by day; a day's sends fold into one line · link to Today for replies waiting | A-256, A-270 |
| **Results** | **Your week**: customers answered (one big true number), booked, first reply, won · "See everything FollowUp did" · everything else (customers, came back, on a plan, sent as written, plans finished) | A-220 (build 5), A-226 |

### 2. A customer (opens from Today, Customers, Activity)

Header (name, where they wrote, when) · **one box on top**: Before your call, or where they stand / Ready to view with
Call (A-269) · the **conversation** · FollowUp's reply waiting, Send / Change it · **About {name}** sheet: what
FollowUp knows about them, their follow-up plan, their moment, the CRM block and stage picker (A-275), "I already
talked to them", "Not a customer", details, delete.

### 3. Settings (top-right on the phone; bottom of the sidebar on the computer): 5 groups, one level per screen

| Group | What's inside |
|---|---|
| **Connected apps** | Email (Gmail, Outlook) · Instagram, Messenger, WhatsApp · Facebook Lead Ads · website form · your CRM (HubSpot, GoHighLevel, Follow Up Boss) · each row ends in its state ("Connected", "Set up") |
| **Sending replies** | Who sends (ask me / send by itself after your yes) · stop all sending · **When to check in** (follow-up plans, `/workflows`) · **Your free hours** (booking link and calendar) · team-only switches (only admins send, your team calls) |
| **Alerts** | Phone buzz, email, quiet hours, bursts become one |
| **Your business** | Business profile · **What FollowUp knows** (facts; "Teach FollowUp", `/teach`) · who isn't a customer · write like me · help improve FollowUp |
| **Account** | Team · Your plan · Sign-ins · Your data (download, delete) |
| *(hidden)* Advanced | Webhooks in and out, phone number, lead routing: no row leads here (A-253); a direct link still works |

### 4. Single tasks (small window on the computer, sheet on the phone)

Add a customer · log a call · import CSV · clean up · mark won · change it (edit in place) · why FollowUp thinks this ·
not a customer (2×2 answers) · invite a teammate · connect a channel · help / something broke.

### 5. Outside the app

Landing page `/` · privacy, terms, security · sign in · setup `/onboarding` (CRM first, then the apps the CRM misses;
ends on a real or practice customer) · customer-facing **booking page** `/book/[id]` and **website form** `/embed/[id]` ·
founder-only `/admin` and `/admin/office`.

### 6. Old addresses (kept so old links work, never linked in the app)

`/inbox` → Customers · `/pipeline` → Customers (all) · `/waiting` → Customers (waiting for their reply) ·
`/coming-up` is still its own page, reached from Today's "Later" line (candidate to fold into Customers as a filter).

### 7. The back room (never on screen)

Tokens, webhooks, signing secrets, retries, spam and friend checks, plan numbers, AI limits. Defaults decide; only
something broken reaches the owner, as one line with the fix in **Needs you**.

### Where a new feature goes (unchanged rule, see "The seven slots" below)

Name its slot first: Today (a decision now) · the customer page (about one person) · Customers (find or sort) ·
Results (value delivered, true numbers) · Settings (how FollowUp works, connections) · a small window (one task) · an
alert (something happened). A fifth place needs one removed.

---

# History (2026-10-10 version, kept for the record)


**Why this exists:** the founder, 2026-10-10: *"we have to arrange a lot of things right, so we have to keep the plan
in mind while building, because we have to fit new features too."* This is that plan. Read it **before** designing or
building any feature. Every new feature names its slot here first; a feature that fits no slot is a design question
for the founder, not something to squeeze in.

**Builds on:**
- A-209: four places, one customer at a time.
- A-211: our look, Wispr's calm.
- A-212: side panel, two-line rows, tidy sidebar, Settings sections.
- A-213: Settings and single tasks open as windows.
- A-214: the layout may follow Wispr's app closely; never its logo, words or assets.
- Research: `research/ux-patterns/2026-10-09-app-strategy-simple-familiar.md`.

---

## The skeleton (fixed: it does not grow)

| Part | What it is | Desk | Phone |
|---|---|---|---|
| **Today** | Place. What needs me now: one customer at a time, then "Next" | Sidebar | Tab |
| **Customers** | Place. Everyone, grouped by who needs you | Sidebar | Tab |
| **Activity** | Place (A-256). Everything FollowUp did, and the owner's own "Needs you" lines | Sidebar | Tab |
| **Results** | Place. What FollowUp did for me, real numbers only | Sidebar | Tab |
| **Settings** | Its **own page** with a tree (A-257): five parents, the open one's branches on a stem, "Settings › Account" on each page | Sidebar (bottom); inside Settings the sidebar becomes the tree | Top bar, right, with its word; one level per screen |
| **A customer** | A page opened from Today or Customers: the conversation, plus a side panel | Side panel on the right | "Details" below the chat |
| **Small windows** | One task each (add a customer, mark won, invite a teammate…) | Centred window | Sheet from the bottom |
| **Alerts** | Phone notifications (the buzz). No bell since A-256: what happened is in Activity | Settings › Alerts | Settings › Alerts |
| **Setup card** | Temporary. "Finish setting up", until it's done | Sidebar | Top of Settings |
| **Your business menu** | Email, plan, team, Sign out | The business name at the foot of the sidebar (opens upward) | In the Settings sheet |
| **Search** | Find a customer by name, email or phone | A "Search" row, opening a small window (Ctrl+K or ⌘K) | The search box on Customers |

**Hard limits:**
- **Four places + Settings** (A-256: Today, Customers, Activity, Results; Settings in the phone's top bar). A fifth
  place needs one removed (the phone's tab bar holds 4 comfortably, 5 at most).
- **Settings holds at most about 8 sections.** Past that, group them under a heading in the side list.
- **Today never shows a list.** It shows the next decision only.
- **One black button per screen or window.**

## The seven slots: where a new feature goes

Ask in this order. The first "yes" is its home.

1. **Does the owner have to decide something now?** → **a card in Today.**
   It waits its turn in the one-at-a-time queue, with the reply or choice ready.
2. **Is it about one customer?** → **the customer's side panel** (phone: "Details").
   It's a short block with a title, at most three lines, and its own link if there's more.
3. **Is it a way to find or sort customers?** → **a tab or filter in Customers.**
   A tab shows only when it has people; everything else is a filter.
4. **Does it show value FollowUp delivered?** → **a number on Results.**
   Use real records only, beside last week. If it can't be measured, it isn't shown.
5. **Is it how FollowUp works, or a connection?** → **a section or row in the Settings window.**
6. **Is it a single task with a start and an end?** → **a small window.**
7. **Did something happen while the owner was away?** → **an alert** that opens straight to the customer.

A feature often touches more than one slot. Example: the voice agent is a Settings row (turn it on), a side-panel block
(the call summary), a Today card (when a call needs you) and a Results number (calls answered). It never gets a place
of its own.

## Today's screens, mapped (what we keep, what folds in)

| Route today | Goes to | How |
|---|---|---|
| `/dashboard` | **Today** | As drawn (A-209, A-212) |
| `/leads` | **Customers** | As drawn: grouped by state, two-line rows |
| `/inbox` | Customers | Already folded in (A-082) |
| `/waiting` | Customers | The "Answered" group or tab |
| `/coming-up` | Customers | The "Checking in" group, plus each customer's panel: "Next check-in Tue" |
| `/pipeline` | Customers | A "by stage" view of the same list (a filter, not a place) |
| `/activity` | Customer side panel + Results | "What FollowUp did" per customer; totals on Results |
| `/leads/[id]` | **A customer** | Conversation + side panel |
| `/analytics` | **Results** | As drawn |
| `/settings` | **Settings window** | Five groups (A-220, build 4, 2026-10-10): Where customers write · How replies go out · Alerts · Your business · More. Phone: four rows + More, then Help and Sign out |
| `/workflows` | Settings › How replies go out (the follow-up plan) | "Change" opens it in the window |
| `/teach` | Settings › Your business › What FollowUp knows | Plus "Parking: not known yet" moments on Today |
| `/onboarding` | Before the app; continued by the setup card | Ends on a real or practice customer |
| `/book/[leadId]`, `/embed/...` | Outside the app (customer-facing) | Unchanged |

## Features on the way, and their slots

From `followup/PRODUCT_DIRECTION.md` and the open work list.

| Feature | Today | Customer panel | Customers | Results | Settings window | Small window | Alert |
|---|---|---|---|---|---|---|---|
| **Qualification** (realtors first, then every business) | "Qualified: hand off" card | The card: each answer with the customer's own words | "Qualified" tab | qualified count | Section: "What you ask" (per business type) | — | "Nadia is ready" |
| **Booking** (calls, viewings, visits) | Only a clash | "Booked: Sat 10:30" | "Booked" tab | booked | Booking hours, calendar | Pick a time | "Booked with Priya" |
| **Closing** ("Moved: closed, confirmed by you") | — | "Mark won" | "Won" tab | won by you ($) | — | Mark won + deal value | — |
| **Voice agent** (calls answered) | "Called, needs you" | Call summary + transcript | — | calls answered | Where customers write › Phone and calls | — | "Missed call, answered" |
| **More channels** (Instagram, Messenger, WhatsApp, Lead Ads, website form; texts later) | — | "Wrote on Instagram" | Channel filter | — | Where customers write | Connect a channel | — |
| **Team** (Pro: shared customers, who's behind) | Only my customers | "Assigned to" | "Mine / Everyone" filter | who's behind | More › Team | Invite a teammate | "Assigned to you" |
| **Old customers** ("Send all N") | One card with the count | — | "Old" filter | — | — | Review and send | — |
| **"We got you" holding message** | Shown on the card ("Sent a holding note") | In "What FollowUp did" | — | — | How replies go out | — | — |
| **Reply timing strategy** | — | "Will reply at 2:40, when they're still looking" | — | heard back in… | How replies go out | — | — |
| **What FollowUp knows** (facts it learns) | "Not known yet" moments | "Used: Commission 2.5%" | — | — | Your business › What FollowUp knows | Add or fix a fact | — |
| **One question a day** | A small card after the queue | — | — | — | — | — | — |
| **Languages** | — | "Writes in Punjabi" | Language filter | — | How replies go out | — | — |
| **Training opt-in** | — | — | — | — | More › Your data | — | — |
| **Alerts settings** (quiet at night, bursts) | — | — | — | — | Alerts | — | — |
| **CRM, Zapier, routing** | — | "In HubSpot" link | — | — | More › Advanced | — | — |
| **Help / Something broke?** | — | — | — | — | — | Tell us (window) | — |

**What this shows:** every planned feature fits the skeleton. None needs a fourth place.

## How the slots look when they're full (drawn 2026-10-10, board version 6)

**The Settings window, with everything planned**, under four headings:
- **How it works:** Follow-up plan · How it writes · What you ask · Booking and calendar *(Soon)*.
- **Where customers write:** Email and website form · Instagram, Facebook, WhatsApp · Phone and calls *(Soon)*.
- **Your business:** What FollowUp knows · Team · Alerts.
- **Account:** Plan and billing · Sign-ins and security · Your data · Advanced.

*SUPERSEDED (2026-10-10) for Settings by A-220 build 4:* the five groups are Where customers write · How replies go out (the plan, replies, booking, pause) · Alerts · Your business · More (team, plan, sign-ins, your data, advanced).

**A customer's side panel** is one column of same-shaped blocks, in this order:
1. About;
2. Qualification (the realtor card: what they want, when, budget, viewing);
3. Booking;
4. What FollowUp did (it includes the follow-up plan);
5. then one row of quiet actions: Already spoke · Copy booking link · Mark won · Details.

Calls, team ("Assigned to") and language add blocks in the same shape.

**"Soon" tag:** anything drawn but not built carries a small grey "Soon". A drawing never passes off an unbuilt feature
as real (brand: "every number true", and the same goes for features).

## Rules that keep it calm as it grows

1. **Name the slot before designing.** The design review fails a feature that has no slot.
2. **Reuse the slot's pattern.** A side-panel block looks like every other side-panel block. A Settings row looks like
   every other row. No one-off layouts.
3. **Say each fact once.** If the side panel says "Booked: Sat 10:30", the row in Customers says "Booked", not the time
   again.
4. **Things that come and go** stay inside their slot and never take over a screen (the setup card, holding notes,
   one question a day).
5. **Windows are for tasks, places are for living.** If people will spend time in it every day, it's a place (and then
   rule 1 of the skeleton applies). If they do it and leave, it's a window.
6. **Phone first.** Every slot has a phone form: side panel → Details, window → sheet, sidebar → tabs.

## Open questions (for the founder)

- Does `/pipeline` (stages) stay as a Customers view, or is it no longer needed once Customers groups by state?
- Is "Results" also where the team view lives (who's behind), or does Pro get a "Team" section in Results?
