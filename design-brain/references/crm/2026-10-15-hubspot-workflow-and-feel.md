# HubSpot: how pages open, how work flows, how clicks feel

**Source:** search summaries of HubSpot's knowledge base, its Canvas design principles and third-party guides
(links below). HubSpot's own sites (knowledge.hubspot.com, canvas.hubspot.com) are blocked from this sandbox, and
Mobbin needs a paid plan, so **no HubSpot screen was seen here**. Evidence grade C: what HubSpot does is reported,
not observed. The founder has a free HubSpot account; a look through it (Claude in Chrome, read-only) would raise
this to grade A.
**Category:** crm
**Added:** 2026-10-15
**Added by:** Claude, at the founder's request: *"analyse HubSpot's workflow, the interface, or the UI/UX … how they
open all the pages, whatever is connecting, the animations, the click effect … how we can make it as simple as we
can."*
**Status:** REVIEWED
**Files:** link only

---

## What is interesting

- **Record preview without leaving the list.** Clicking a contact's name in a list opens a panel on the right with
  their key details, recent activity and linked records; the list stays behind it. The full record is one more
  click. Board views do the same.
- **Task queues: one task, then the next.** A rep presses "Start N tasks"; HubSpot opens the first task's record with
  the task beside it and Complete / Skip / Reschedule; "Complete and move to next" brings up the next one with no
  trip back to a list.
- **Navigation (2024 redesign):** a vertical menu on the left replaced the top dropdowns; it is collapsed by default
  and can be pinned open; up to ten bookmarks can be pinned and reordered. A global search sits at the top.
- **Record page:** details on the left, an activity timeline (emails, calls, notes) in the middle, linked records on
  the right. Quick actions sit at the top: email, call, note, task.
- **Connecting things:** the account comes first; the personal inbox is connected later, from Settings. After owner
  complaints about "intrusive privileges", HubSpot changed its Google connections to ask only for what each one needs.
- **Canvas principles:** Clear ("we design for clarity and focus", help the user take the next right step), Human
  (joy, playful and personable interactions), Inbound, Integrated (one unified system), Collaborative. A HubSpot
  product blog post also names "one primary action per screen" as a rule.
- **Motion:** HubSpot is hiring to make motion "a core part of the design system", with motion tokens, timing rules
  and reduced-motion support. No published easing or duration values were found.

## UX principle

- **Keep the person's place.** Looking at one record should not cost the list you came from (preview panel).
- **The next thing comes to you.** After finishing one item, the next one arrives without a return trip (queues).
- **Ask for access when it's needed, and only for what's needed** (inbox connected later, smallest scopes).

## Visual principle

- One primary action per screen. HubSpot itself is dense (three columns, tabs, customisable cards): that density
  serves a sales rep who lives in it all day, and is **not** the lesson for FollowUp.

## Interaction principle

- A click should answer at once: a panel slides in, the next task appears. Waiting with nothing on screen reads as
  broken. (Reported, not observed: the exact animations, press states and timings were not seen.)

## Whose user is this?

A sales rep or marketer at a desk for hours, trained on the tool, often an admin who customises it. FollowUp's owner
is on a phone between jobs and will not learn a tool. Take HubSpot's flow ideas; leave its density, customisation,
bookmarks and three-column record.

## What FollowUp could learn

**Already done (no change needed):**
- One customer at a time with the next sliding up: Today (A-243, A-250) and the card fold (A-048) are FollowUp's
  task queue, with no "Start" step.
- A side panel beside the customer on Today (A-212); Settings and single tasks open as windows over the page (A-213).
- A customer opens in a panel over the Customers list on the computer, with "Open full page" (HubSpot's preview).
- Connect later, ask for little: Setup starts with Instagram or Gmail (A-241); Connect → Connected (A-253).
- Navigation goes between pages without a full reload (`next/link` in `Sidebar.tsx`); there is a sidebar search.

**Gaps found in the code (2026-10-15), proposals for the founder:**
1. **Every page opens with the wrong skeleton.** One `loading.tsx` covers the whole app and draws four stat boxes
   and a list, "shaped like the stat-card-row + list pattern most of those pages actually share". That was true
   before the redesign. Today is now one customer card, Customers is two-line rows and Settings is a side list, so
   each tap shows a shape that then jumps into a different one. Proposal: each place gets a loading shape that
   matches it.
2. **No press feedback.** No button in the app has a pressed state (`active:` appears nowhere; only the switch has
   `:active`). On a phone there is no hover, so a tap on Send shows nothing until the server answers. Proposal: every
   button and tappable row darkens slightly the moment it is pressed, using the existing `--motion-fast` (A-048);
   nothing bounces or scales under reduced motion.
3. ~~A customer opens as a whole new page on the computer.~~ **Wrong, corrected the same day:** a tap on a
   Customers row already opens the customer in a panel over the list, with "Open full page" (`/leads?p=…`). That is
   HubSpot's preview panel, already built. Only the `/leads/[id]` route had been read.

**Not taken:** collapsible pinned menus and bookmarks (three places don't need them), customisable record layouts,
the three-column record, a "Start N tasks" button (Today already starts with the first customer open).

## Sources

- [HubSpot design principles (principles.design)](https://principles.design/examples/hubspot-design-principles) ·
  [canvas.hubspot.com](https://canvas.hubspot.com/) (blocked here; read through search)
- [Work with records (HubSpot KB)](https://knowledge.hubspot.com/records/work-with-records) ·
  [Record previews (insidea)](https://insidea.com/blog/hubspot/kb/how-to-preview-records-and-customize-record-previews-in-hubspot)
- [Task queues guide (consultevo)](https://consultevo.com/hubspot-task-queues-guide/) ·
  [Tasks and queues (Octave)](https://www.octavehq.com/post/hubspot-tasks-queues-managing-sales-activity)
- [A guide to HubSpot's navigation (HubSpot KB)](https://knowledge.hubspot.com/help-and-resources/a-guide-to-hubspots-navigation) ·
  [May 2024 updates (MarTech)](https://martech.org/hubspots-may-2024-updates-advanced-email-metrics-custom-invoices-and-more/)
- [Motion design system role (HubSpot careers)](https://www.hubspot.com/careers/jobs/6909902)
- [Manage leads in the mobile app (HubSpot KB)](https://knowledge.hubspot.com/prospecting/manage-leads-using-the-hubspot-mobile-app)
- Earlier: HubSpot's smallest-scope change, in `research/ux-patterns/2026-09-25-site-to-first-value-benchmark.md`.
