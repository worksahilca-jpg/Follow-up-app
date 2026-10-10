# The app map: what lives where, and where new features go

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
| **Results** | Place. What FollowUp did for me, real numbers only | Sidebar | Tab |
| **Settings** | A **window** over the page, with a side list of sections | Sidebar (bottom) | Tab → a sheet that rises |
| **A customer** | A page opened from Today or Customers: the conversation, plus a side panel | Side panel on the right | "Details" below the chat |
| **Small windows** | One task each (add a customer, mark won, invite a teammate…) | Centred window | Sheet from the bottom |
| **Alerts** | Phone notifications; the bell holds the recent ones | Bell (no word) | Bell + "Alerts" |
| **Setup card** | Temporary. "Finish setting up", until it's done | Sidebar | Top of Settings |
| **Your business menu** | Email, plan, team, Sign out | The business name at the foot of the sidebar (opens upward) | In the Settings sheet |
| **Search** | Find a customer by name, email or phone | A "Search" row, opening a small window (Ctrl+K or ⌘K) | The search box on Customers |

**Hard limits:**
- **Three places + Settings.** A fourth place needs one removed (the phone's tab bar holds 4 comfortably, 5 at most).
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
