# Close: the sales follow-up workflow, and what FollowUp should take

**Asked by:** the founder, 2026-09-26: *"study Close ... lead response language, reminders, communication, follow-up, sales
workflow ... and let me know how we can implement [it in] our follow-up product."* ("NAR" read as "our".)
**Method:** WebSearch summaries of Close's help centre and blog. close.com itself can't be fetched from this session.
**Grades:** B = search summary of Close's own help or blog; C = third-party review or blog.
**Builds on:** `research/market/2026-09-05-competitor-feature-gaps.md` (Close Smart Views, already built as Saved lists,
used by 0 of 10 accounts), `design-brain/research/ux-patterns/2026-09-25-in-app-experience-benchmark.md` (Close Inbox).

## 1. What Close does

| Area | Close | Grade |
|---|---|---|
| **Lead response** | A Workflow triggered when a lead is created runs the first week. Leads are assigned round robin or by source. A task for the rep is created in the first minute ("an actionable to-do, not just a notification"). | B (Inbound Lead Response guide) |
| **Reminders** | The Inbox is a to-do list: inbound email, SMS, missed calls and tasks due today. There's a **Done** view and a **Future** view (snoozed or scheduled). Anything can be snoozed; "Move to Inbox" pulls a future task forward. | B (Inbox, Tasks docs) |
| **Communication** | Email, calls and SMS in one lead timeline. Templates, an AI email assistant, and a call assistant that transcribes, summarises and drafts the follow-up. | B / C |
| **Follow-up** | Multi-step Workflows: email, SMS and **call-task** steps, for example day 0, 3, 8, 14, 21. They pause on any reply, bounce or unsubscribe. **"Mark as Responded"** pauses them when the contact answered somewhere Close can't see, such as a call or in person. | B (Workflows, Workflow steps) |
| **Measuring it** | Workflow reports show response rate, average response time, goal met, and **"responded by step"**, meaning which step brought people back. | B (Inbound Lead Response, Reports) |
| **Language** | Close's blog and the wider playbook: every follow-up adds one new reason to reply; never "just checking in"; end with a graceful close that leaves the door open. | C |

## 2. Where FollowUp already matches it

- **Language:** the drafting rules ban "just checking in", "circling back" and "touching base" (`openai.ts`, `automation.ts`,
  `dmDrafts.ts`). Each of the 4 check-ins has its own angle, and the 4th is the graceful close ("leave it here for
  now, the door is open").
- **Follow-up:** day 3, 7, 14 and 30; stops on reply; stops on opt-out (`reminderCadence.ts`, `suppression.ts`).
- **Communication:** more channels than Close for this owner (Gmail, Outlook, Instagram, Messenger, WhatsApp, website),
  drafts written for every reply, and a voice agent.
- **Assignment:** `pickAssignee` exists for teams.

## 3. What FollowUp is missing, ranked

1. **"We talked" (Close's Mark as Responded).** If a customer phones the owner or they meet, FollowUp can't see it
   and keeps checking in. That is embarrassing, and it undermines trust (principle 1). One tap on the person, "We talked",
   stops the plan and removes them from Needs you. *Small: one action and one audit event.*
2. **"Later" plus a "Coming up" line (Close's Snooze and Future views).** An owner who can't deal with Priya now has only
   Send, Edit or Don't send. "Later" (tonight, tomorrow) hides the card until then. Today also gets one quiet line:
   "Coming up: FollowUp will check in with 4 people tomorrow." The earlier benchmark found this gap too. *Small to
   medium.*
3. **Which check-in brings people back (Close's "responded by step").** Count replies by check-in (day 3, 7, 14, 30) on
   /admin. It tells us whether day 30 earns its place, and it will tune the plan with real data. *Small: FollowUp
   rows already store the trigger and `repliedAt`.*
4. **Speed to lead while everything is held.** Close answers within a minute and gives a person a task. FollowUp's
   instant "got your message" is held too on accounts that hold everything, the default since 2026-09-21. And the
   analytics show owners press Send slowly: 23 waiting against 5 sent. **This is the founder's call (product
   behaviour):** let the "got it" reply go on its own again, at least for website forms and DMs, where the
   sender is clearly a customer writing to the business. Keep email held, where a newsletter can look like a lead.
5. **A call nudge for hot leads (Close's call-task step).** When someone asked about a price and has waited a day,
   Today could say "Call Priya" with their number, when we have one. A call often beats a fourth message. *Later.*

## 4. Not taken

- **The pipeline, opportunities and dialer.** Rule 4 in PRODUCT_DIRECTION: don't rebuild a CRM. The pipeline is used by
  1 of 10 accounts.
- **Workflow builders with branching.** Calendly lesson (A-027 area): one plan in one card.
- **Open tracking to pause or trigger steps.** It's unreliable (Apple Mail privacy) and feels like surveillance in a
  small-business relationship.

## Sources

- Close, Inbound Lead Response: https://help.close.com/docs/inbound-lead-response
- Close, Workflows: https://help.close.com/docs/workflows · Workflow steps: https://help.close.com/docs/workflow-steps
- Close, Inbox: https://help.close.com/docs/inbox · Tasks: https://help.close.com/docs/tasks
- Close blog, Never Miss a Lead Again: https://close.com/blog/automate-follow-ups-with-close-workflows
- Close blog, Sales follow-ups guide: https://close.com/blog/follow-up
- Close blog, Catch missed leads with Smart Views: https://close.com/blog/crm-automation-prevent-lost-leads
- ZoomInfo, Close CRM review 2026 (C): https://pipeline.zoominfo.com/sales/close-crm-review
- HubSpot, alternatives to "just checking in" (C): https://blog.hubspot.com/sales/follow-up-sales-email-templates-instead-checking-in
