# Calendar-source choice for booking links: competitive sanity check

**Date:** 2026-09-11
**Task:** sanity-check the just-shipped design — a business picks, per-business, between
FollowUp's built-in calendar or their real Google Calendar as the lead booking link's
availability source — against how Calendly, Acuity, HubSpot Meetings, Follow Up Boss, and
adjacent real-estate CRM booking tools actually handle calendar-source choice.

## What FollowUp actually shipped (read from the code, not inferred)

- `src/components/BookingCalendarConfig.tsx` presents this as a **binary, mutually-exclusive
  choice** in the Settings UI: a radio-style pair of buttons, "FollowUp's built-in calendar" vs.
  "My Google Calendar," gated on Gmail being connected for the Google option.
- `src/lib/booking.ts` (`getAvailableSlots`) — but the underlying *mechanism* is not actually
  "replace one source with another." Per the code's own comment: `"google" ADDS this on top of
  the fixed grid below, it never replaces it — a lead should never be offered 2am just because
  Google Calendar happens to show nothing there`. Concretely: the fixed Mon–Fri 9am–5pm grid
  always applies regardless of which option is chosen; picking "google" additionally narrows
  that grid by real Google Calendar busy times (via `getGoogleCalendarBusyTimes`,
  `freebusy.query`, best-effort — a missing connection, stale token, or API error just means an
  empty busy list, never a failure).
- `src/lib/integrations/gmail.ts` (`getGoogleCalendarBusyTimes`) uses **`calendar.freebusy.query`
  against `primary`** — busy intervals only, no event titles/descriptions, and only the single
  primary calendar on the connected Google account (no secondary/shared calendars).
- `createCalendarEvent` (same file) writes a confirmed booking to `primary` via
  `calendar.events.insert` with `sendUpdates: "all"` — one-way push, best-effort, no
  reconciliation loop back from Google.
- `MIN_NOTICE_MINUTES = 60` is hardcoded (not configurable per business), there is **no buffer
  time** around bookings (back-to-back slots on the 30-minute grid are allowed right up against
  an existing booking or Google event), and the lead-facing page (`src/app/book/[leadId]/page.tsx`)
  already renders every time in **the viewer's own browser timezone** via `toLocaleString`/
  `toLocaleTimeString` with no explicit timezone argument.

---

## 1. Is "choice between our calendar or Google Calendar" an actual product pattern?

**Short answer: not really — the dominant pattern is additive, not exclusive, and FollowUp's
framing is a genuine outlier versus the market, even though its *underlying mechanism* (fixed
grid, narrowed by an optional Google layer) already matches the market almost exactly.**

Every competitor researched works the same underlying way: a manually-defined **Availability**
schedule (weekly hours) is the base grid — usable with **zero** calendars connected — and
connecting one or more external calendars **narrows** that grid by adding conflict-checking on
top; it does not swap the grid out for a different one:

- **Calendly**: "You can create a schedule for your working hours in the Availability tab...
  This allows you to establish availability manually without integrating with an external
  calendar system," and the tradeoff of not connecting one is stated plainly — "Calendly won't be
  able to check your availability on multiple work and personal calendars to prevent double
  bookings" *(WebSearch 2026-09-11 — [Calendly Help: availability](https://calendly.com/help/availability), community threads on manual availability)*.
  Connecting a calendar in Calendly is framed as "connect to **check for conflicts**" — additive,
  not a replacement of the manual schedule.
- **Acuity Scheduling**: "Acuity syncs with your Google, Outlook, or iCal so your booking page is
  always 100% accurate. Acuity automatically **blocks off time** when you have existing
  commitments on synced calendars" *(WebSearch 2026-09-11 — [Acuity: calendar management](https://acuityscheduling.com/features/calendar-management))* — again, narrowing a base
  schedule, not choosing between two named sources.
- **HubSpot Meetings**: "Prospects will see all open slots on your calendar that are marked as
  free... if you have events set to busy, they will not show as bookable" *(WebSearch 2026-09-11 —
  [HubSpot: troubleshoot calendar availability](https://knowledge.hubspot.com/meetings-tool/why-does-my-availability-for-meetings-not-match-my-integrated-calendars))* — same additive-narrowing model, and notably HubSpot **requires** a connected
  calendar for the Meetings tool at all (no manual-only mode found in search).
- **Follow Up Boss**: doesn't build its own booking-link/availability product at all — it
  connects a Google/Microsoft 365 calendar for **2-way appointment sync** (its own scheduled
  appointments push to the real calendar and vice versa) and, for an actual public booking link,
  tells agents to paste **their Calendly link** into a merge field for outbound messages
  *(WebSearch 2026-09-11 — [Follow Up Boss: Google Calendar](https://help.followupboss.com/hc/en-us/articles/4402378555799-Google-Calendar), [Follow Up Boss: Calendly](https://help.followupboss.com/hc/en-us/articles/9411834368663-Calendly))*. So the real-estate-CRM comparable in this
  space doesn't even attempt the "own calendar vs. real calendar" choice FollowUp is making —
  it defers the whole problem to Calendly rather than building it. That makes FollowUp's
  built-in-calendar option more sophisticated than the direct competitor's default, not less.

The one place a *choice* framing does show up in the wild is different in kind: some tools let
the **guest** (not the host) choose, per booking, whether to connect their own calendar for
auto-detected free/busy or self-report availability manually — a different actor and a different
question than FollowUp's host-side, persistent, exclusive toggle *(WebSearch 2026-09-11 —
general scheduling-tool comparison search, guest-side calendar connection framing)*. And where a
host *chooses* something among connected calendars, it's typically "which of my several
**connected** calendars should new bookings write to" (Calendly: "select the calendar(s) Calendly
should check for conflicts, and choose where new bookings go" *(WebSearch 2026-09-11 — [Calendly:
connect your calendar](https://calendly.com/help/connect-your-calendar-to-calendly))*) — a write-target choice among multiple real calendars, not a
read-source choice between "the product's own calendar" and "a real calendar."

**So the verdict has two parts, and they point in different directions:** the *mechanism*
FollowUp built (fixed grid, optionally narrowed by Google) is not unusual at all — it's
essentially what Calendly/Acuity/HubSpot all do by default. What's unusual is **presenting it to
the business owner as an exclusive either/or choice** rather than as "also check my Google
Calendar" — an opt-in layer, which is how every competitor frames the equivalent setting. This is
a labeling/framing observation about the shipped UI, not a claim that the underlying availability
logic is wrong — see the Bottom line section.

---

## 2. Free/busy-only privacy — confirmed, matches industry norm

FollowUp's use of `freebusy.query` (busy intervals only, no titles/descriptions) matches how
every competitor researched describes its own privacy posture:

- Acuity: "Google events marked as 'Busy'... will sync to Acuity. However, events marked as
  'Free'... will not sync," plus an explicit option to "**Hide event title** and only show
  'Busy' to other users" *(WebSearch 2026-09-11 — [Acuity: syncing your calendar](https://help.acuityscheduling.com/hc/en-us/articles/16676868807181-Syncing-your-calendar))*.
- HubSpot: "if you have events set to busy, they will not show as a bookable time" — status-only,
  same model *(WebSearch 2026-09-11 — HubSpot troubleshooting doc above)*.
- Calendly: "Calendly checks your calendar for busy times and adds new meetings to it" — same
  framing, busy-time-only language throughout its own help docs *(WebSearch 2026-09-11 —
  [Calendly: connect your calendar](https://calendly.com/help/connect-your-calendar-to-calendly))*.

FollowUp's implementation is, if anything, more conservative than Acuity's default (Acuity
optionally shows event titles unless you toggle them off; FollowUp's `freebusy.query` call
structurally cannot return titles at all, confirmed by the API shape). This part of the design is
solidly in line with — not behind — the market.

---

## 3. What competitors do that FollowUp doesn't yet

**Multi-calendar support (real gap).** Calendly lets a host connect **up to six calendars**
across *different providers* (Google + Outlook + Exchange simultaneously) and checks all of them
for conflicts *(WebSearch 2026-09-11 — [Calendly blog: connect multiple calendars](https://calendly.com/blog/connect-multiple-calendars), comparison sources on the 6-calendar limit)*.
Acuity similarly syncs to **multiple Google (sub-)calendars within one account**, useful for
tracking several staff schedules on one Google login *(WebSearch 2026-09-11 — [Acuity: third-party
calendar sync](https://acuityscheduling.com/learn/sync-with-third-party-calendars))*. FollowUp's
`getGoogleCalendarBusyTimes` hardcodes `items: [{ id: "primary" }]` — a single calendar, on a
single connected Google account, for the whole business. A business with a shared team calendar
plus the owner's personal calendar, or a business where two people's calendars both matter,
cannot be represented at all today.

**Buffer time (real gap).** "Limits and buffers" — protected time immediately before/after a
booked meeting — is a named, first-class setting in Calendly *(WebSearch 2026-09-11 — [Calendly:
how to use buffers](https://calendly.com/help/how-to-use-buffers))*. FollowUp's slot generation
has no equivalent: a lead can book the 30-minute slot immediately abutting an existing booking or
a real Google Calendar event, back-to-back with zero gap.

**Minimum-notice window (partial gap).** FollowUp already has this mechanically
(`MIN_NOTICE_MINUTES = 60`), so it isn't missing — but it's a single hardcoded constant, not a
per-business setting, and it's shorter than what's typically shown as an example default
elsewhere ("requiring at least 24 hours' notice" is the example figure used in Calendly's own
documentation of the feature) *(WebSearch 2026-09-11 — [Calendly: fine-tune your availability
settings](https://calendly.com/help/how-to-fine-tune-your-availability-settings))* — worth
flagging as "exists but not adjustable," not "doesn't exist."

**Timezone display — FollowUp is already doing this correctly; not a gap.** The lead-facing page
renders every slot via the browser's own locale/timezone (`toLocaleString`/`toLocaleTimeString`
with `undefined` locale, no server-guessed timezone), which is exactly the failure mode
competitors' own troubleshooting docs warn about getting wrong: Calendly's timezone
troubleshooting guide describes confirmations landing in the wrong timezone specifically when a
tool can't detect the browser's timezone and "defaults to UTC" *(WebSearch 2026-09-11 — [Calendly
community: time zone troubleshooting guide](https://community.calendly.com/how-do-i-40/time-zone-troubleshooting-guide-242))*, and Microsoft Bookings has documented, live
support threads about confirmations showing the wrong timezone to clients *(WebSearch 2026-09-11 —
[Microsoft Community: Bookings wrong timezone](https://techcommunity.microsoft.com/t5/microsoft-bookings/bookings-confirmations-get-sent-to-client-with-wrong-time-zone/td-p/4006321))*. FollowUp's
approach (always render in the viewer's own detected browser locale, both on the slot list and
the confirmation) sidesteps this whole failure class already, and the actual calendar invite a
lead receives is a native Google Calendar invite (via `sendUpdates: "all"`), which Google itself
localizes per-recipient — so there's no separate FollowUp-authored notification with a
hardcoded timezone to get wrong either. This is a place to point to as already correct, not a
finding requiring action.

**Calendar-side cancellation/reschedule sync-back (real, and the most consequential gap).**
Calendly explicitly supports this in both directions, conditional on sync being turned on:
"When you delete or cancel the event in your calendar, Calendly also cancels the meeting and
notifies your invitee... To use this feature, make sure automatic sync is turned on" and, for
reschedules, "When you update the date or time of the event in Google Calendar, Calendly also
updates the meeting and notifies your invitee" *(WebSearch 2026-09-11 — [Calendly: cancel,
reschedule, and make changes to an event](https://help.calendly.com/hc/en-us/articles/223145167-How-to-cancel-reschedule-and-make-changes-to-an-event))*. HubSpot's "2-way sync" and Follow Up Boss's "appointments are synced 2-way" both
make the same bidirectional claim for their own products *(WebSearch 2026-09-11 — Follow Up Boss
Google Calendar doc above)*.

FollowUp's implementation is **one-way in both directions**, not two-way: it reads Google
free/busy fresh on every `getAvailableSlots()` call (so a *new* conflict on the owner's real
calendar correctly blocks a *new* booking attempt), and it writes a confirmed booking to Google
once at creation time — but there is **no mechanism for a change on the Google side to flow back
into FollowUp's own `Booking` row**. If a business owner deletes or moves the calendar event
directly in Google Calendar after the fact, FollowUp's `Booking.status` stays `"confirmed"`
forever, `Lead.nextFollowUp` stays pointed at the old time, and nothing tells the salesperson the
meeting no longer exists on the real calendar. This would require either a push mechanism (Google
Calendar watch/push notification channels) or a polling reconciliation job — neither exists today
— and it is the one gap in this list that a business could plausibly discover the hard way (a
lead never shows up because the owner had actually canceled on their phone's calendar app, and
FollowUp never found out).

---

## 4. Real complaint patterns worth flagging

**"Sync failing → double-booked" is a recurring, named complaint category on Calendly's own
community forum**, not a rare edge case: threads titled "Calendar Sync Failing, Getting Double
Booked," "Double booking, despite all of my troubleshooting," and "Calendly Double Booking Issue"
all describe the same root shape — the busy-time check silently stops working (stale
auth, wrong calendar selected, sync toggle quietly off) and the *booking page itself never signals
that anything is wrong*; it just quietly offers times that are actually taken *(WebSearch
2026-09-11 — [Calendly community: sync failing/double booked](https://community.calendly.com/how-do-i-40/calendar-sync-failing-getting-double-booked-1154), [double booking despite
troubleshooting](https://community.calendly.com/how-do-i-40/double-booking-despite-all-of-my-troubleshooting-4415), [double booking issue](https://community.calendly.com/how-do-i-40/calendly-double-booking-issue-1941))*.

This is directly relevant to FollowUp's own design choice: `getGoogleCalendarBusyTimes` is
explicitly "best-effort... no connection, a stale token, or any API error just means no busy
blocks are known" — i.e., FollowUp has **deliberately built the exact silent-degradation
behavior that produces this complaint category in Calendly's own user base**, as a considered
tradeoff (never let a Google API hiccup block a real lead from booking at all). That tradeoff is
individually reasonable, but the Calendly complaint pattern is evidence for a specific refinement:
distinguish, in the Settings UI, between "Google not connected" (expected, fine) and "Google
connected but the last busy-time check failed/the token looks expired" (should surface a warning
to the business owner) — right now `BookingCalendarConfig.tsx` only checks whether Gmail is
connected at all, not whether the connection is currently healthy enough to actually be checked.

**HubSpot's own troubleshooting docs acknowledge sync-delay double-booking windows directly**:
"If there's a sync delay, you may need to manually reschedule," alongside "you may have connected
the wrong Google or Outlook calendar" as a named root cause of "unexpected bookings"
*(WebSearch 2026-09-11 — [HubSpot troubleshooting](https://support.werx.marketing/troubleshooting-hubspot-meeting-booking-issues), community threads above)*. The "wrong calendar
connected" failure mode is structurally impossible for FollowUp today (there's only ever one
Google account, one calendar — `primary`), which is a small, real point in FollowUp's favor
precisely because it doesn't yet support multiple calendars (§3) — worth naming, since adding
multi-calendar support later would reintroduce exactly this failure mode and should carry an
explicit "which calendar" confirmation step when it ships.

**Reschedule-sync is documented as less reliable than cancel-sync even where two-way sync
exists**: Calendly's own community acknowledges "when someone reschedules a Calendly meeting,
the original meeting that was synced onto the calendar is not automatically moving to the
rescheduled time on the calendar. If they cancel a meeting, it is taking it off the calendar" —
i.e., even the vendor that ships two-way sync finds cancel-sync more reliable than reschedule-sync
in practice *(WebSearch 2026-09-11 — [Calendly community: meeting rescheduling and calendar
sync](https://community.calendly.com/how-do-i-40/meeting-rescheduling-and-calendar-sync-809))*. Useful context for prioritization if/when FollowUp
builds the sync-back gap from §3: cancellation sync-back is the higher-value, more tractable half
to build first; full reschedule-sync-back is documented as the harder problem even for a mature
competitor.

---

## 5. Bottom line: reasonable design, or reconsider?

**Reasonable to keep, with one framing refinement worth making, and one real gap worth
prioritizing — not a design to reverse.**

- The underlying **mechanism** (fixed business-hours grid, optionally narrowed by real Google
  busy times, best-effort/never-blocking on API failures) is not a departure from the market —
  it's close to identical to what Calendly, Acuity, and HubSpot all do by default. This part of
  the design doesn't need reconsidering.
- The **presentation** as an exclusive either/or choice, rather than "also check my Google
  Calendar" framed as an additive opt-in, is the one place FollowUp's shipped design diverges
  from every competitor studied. This is worth a UI-copy-level look (not a re-architecture — the
  code comment in `booking.ts` already describes the real, additive behavior correctly; only the
  Settings screen's radio-button framing implies exclusivity that isn't actually there) but does
  not on its own justify walking back the feature.
- The **one gap that's more than cosmetic** is §3's sync-back problem: no competitor researched
  ships one-way-only calendar sync as a permanent design — Calendly, HubSpot, and Follow Up Boss
  all advertise genuine 2-way sync as a selling point specifically because a booking tool that
  can silently drift out of truth with the real calendar is exactly the failure class that
  generates the double-booking complaints in §4. FollowUp doesn't need full reschedule-sync-back
  on day one (even Calendly's own users report that half being flaky) — but shipping with zero
  cancellation sync-back indefinitely is the one part of this design that plausibly gets a real
  business burned before FollowUp hears about it.

---

## So what — next actions for FollowUp

1. **Reframe the Settings toggle from an exclusive choice to an additive opt-in** ("Also check my
   Google Calendar for conflicts") to match both the actual underlying mechanism (which already
   narrows, never replaces, per the code's own comment) and how every competitor studied presents
   the equivalent setting — a copy/UX change, not a logic change.
2. **Build minimal cancellation sync-back before reschedule sync-back.** A polling job (or a
   Google Calendar watch/push channel) that checks whether a `Booking`'s linked Google event
   still exists, and flips `Booking.status` if it was deleted on the real calendar, closes the
   most concrete gap found against every 2-way-sync competitor — and Calendly's own community
   confirms cancel-sync is the more tractable half to get right first.
3. **Distinguish "not connected" from "connected but failing" in the Settings UI**, surfacing a
   warning when `getGoogleCalendarBusyTimes` has been erroring rather than silently returning an
   empty list — directly targets the root cause named in Calendly's own double-booking complaint
   threads (a broken sync that gives no signal to the user).
4. **Make `MIN_NOTICE_MINUTES` a per-business setting** (even a simple one exposed in the same
   Settings card) rather than a hardcoded 60 minutes, matching the configurable minimum-notice
   pattern every competitor researched exposes.
5. **Add a lightweight buffer-time setting** (e.g. 0/15/30 minutes before and after) before
   multi-calendar support — it's a smaller build than multi-calendar, addresses a named
   competitor feature FollowUp lacks entirely, and reduces back-to-back-booking friction for the
   business owner independent of which calendar source is chosen.

---

## Sources (WebSearch, 2026-09-11)

- https://calendly.com/help/availability
- https://calendly.com/help/connect-your-calendar-to-calendly
- https://calendly.com/blog/connect-multiple-calendars
- https://calendly.com/help/how-to-use-buffers
- https://calendly.com/help/how-to-fine-tune-your-availability-settings
- https://help.calendly.com/hc/en-us/articles/223145167-How-to-cancel-reschedule-and-make-changes-to-an-event
- https://community.calendly.com/how-do-i-40/meeting-rescheduling-and-calendar-sync-809
- https://community.calendly.com/how-do-i-40/calendar-sync-failing-getting-double-booked-1154
- https://community.calendly.com/how-do-i-40/double-booking-despite-all-of-my-troubleshooting-4415
- https://community.calendly.com/how-do-i-40/calendly-double-booking-issue-1941
- https://community.calendly.com/how-do-i-40/time-zone-troubleshooting-guide-242
- https://acuityscheduling.com/features/calendar-management
- https://help.acuityscheduling.com/hc/en-us/articles/16676868807181-Syncing-your-calendar
- https://acuityscheduling.com/learn/sync-with-third-party-calendars
- https://knowledge.hubspot.com/meetings-tool/why-does-my-availability-for-meetings-not-match-my-integrated-calendars
- https://support.werx.marketing/troubleshooting-hubspot-meeting-booking-issues
- https://help.followupboss.com/hc/en-us/articles/4402378555799-Google-Calendar
- https://help.followupboss.com/hc/en-us/articles/9411834368663-Calendly
- https://techcommunity.microsoft.com/t5/microsoft-bookings/bookings-confirmations-get-sent-to-client-with-wrong-time-zone/td-p/4006321

**Note on sourcing:** all `calendly.com`, `acuityscheduling.com`, `help.followupboss.com`, and
similar vendor/community domains were not directly fetchable in this environment (outbound
`WebFetch` was blocked by the network egress proxy for every domain tried, including these) —
every quoted or paraphrased claim above is drawn from the search-result snippets `WebSearch`
returned (which quote or closely paraphrase the underlying page), not from a full independent
read of the page. Where a claim is this document's own inference from the code rather than a
sourced claim, it's stated as such inline (e.g. all descriptions of FollowUp's own current
behavior, drawn from reading the code directly, not from search).

**Internal files read:** `src/components/BookingCalendarConfig.tsx`, `src/lib/booking.ts`,
`src/lib/integrations/gmail.ts` (SCOPES, `createCalendarEvent`, `getGoogleCalendarBusyTimes`),
`src/app/book/[leadId]/page.tsx`, `src/app/api/book/[leadId]/route.ts`,
`src/app/api/business/booking-source/route.ts` (existence confirmed via grep, not fully read).
