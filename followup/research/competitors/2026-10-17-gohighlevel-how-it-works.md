# GoHighLevel: how it works, and how FollowUp works with it

**Question (founder, 2026-10-17):** "Check how GoHighLevel works. We have to coordinate with them. Our main goal is to
convert the lead by replying or following up, or booking the meeting or the call."

**Sources and grades.** GoHighLevel's docs site (marketplace.gohighlevel.com) could not be reached from the build
machine (DNS). Endpoints below are read from GoHighLevel's own JavaScript client, `@gohighlevel/api-client` 3.1.1,
downloaded only to read (not added to the app): **B** (their code, not yet called on a real account). How workflows,
goals and the Conversation AI bot behave comes from third-party guides and our 2026-10-07 study: **C**. Everything is
checked on the realtor's real account on Tuesday.

## The parts of GoHighLevel that touch a lead

| Part | What it does | Can FollowUp use it? (B) |
|---|---|---|
| Contacts | Every lead is a contact: name, phone, email, tags, do-not-disturb | Yes, already: read, and match the same person saved twice (`GET /contacts/?query=`) |
| Conversations | One inbox for text, email, Facebook, Instagram, WhatsApp | Yes, already: read every 2 minutes, reply through it (PR #535, #537) |
| Workflows | Automatic steps: "new lead → text → wait a day → text". Stop on reply or booking only if someone set a goal (C) | Read the list (`GET /workflows/`); add or remove a contact (`POST`/`DELETE /contacts/{id}/workflow/{workflowId}`) |
| Calendars | The team's booking calendar; appointments have a status (booked, confirmed, showed, no-show) that starts reminders and no-show workflows (C) | Free times (`GET /calendars/{id}/free-slots`), book (`POST /calendars/events/appointments` with calendarId, locationId, contactId, startTime), change (`PUT …/appointments/{id}`), read (`GET /calendars/events`) |
| Pipelines | Stages a deal moves through | Read (`GET /opportunities/pipelines`, `/opportunities/search`), move (`PUT /opportunities/{id}/status`) |
| Conversation AI | An optional bot that answers and books on its own (C) | No API found to see whether it is on. Its replies show up as messages from the business |

## How FollowUp should work with it (the goal: reply, follow up, book)

1. **Reply.** Done: FollowUp reads every channel in GoHighLevel and replies through it, from the owner's own number.
2. **Follow up, without two messages.** Done, PR for "never two messages": FollowUp asks GoHighLevel right before
   anything it sends on its own, and steps back while GoHighLevel (a workflow, the bot, or the owner) is in touch.
   Not done, on purpose: FollowUp never removes anyone from the owner's workflows on its own. That changes the owner's
   setup without asking.
3. **Book: the gap.** FollowUp's booking page uses FollowUp's own hours and Google Calendar. A GoHighLevel team books
   on GoHighLevel's calendar, where their reminders and no-show steps run. A booking made in FollowUp misses all of
   that. **Recommended next build:** for an owner on GoHighLevel, offer times from their GoHighLevel calendar and book
   the meeting there. Then GoHighLevel sends its reminders, the meeting shows in their calendar, and FollowUp stops
   following up because they booked.
4. **After the meeting.** Later: read the appointment's status. "No-show" → FollowUp drafts the rebook (the team's
   biggest leak in the 2026-10-07 study: about half of booked meetings don't show).

## Needs from the owner's key

The Private Integration key must allow calendars (read, and write events) for booking. The connect check (PR #537)
can ask for it the same way it asks for contacts and conversations. Exact permission names are not confirmed (C).
