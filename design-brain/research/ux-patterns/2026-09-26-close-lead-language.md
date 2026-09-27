# Close: how to talk about leads and follow-up

**Date:** 2026-09-26 · **Asked by:** Sahil ("next", after the reference strategy review) · **Status:** STUDIED,
proposals pending approval

**Question (from the founder's reference strategy, one of the five deepest):** How should FollowUp talk about leads
and follow-up? Study Close's lead-response language, reminders, communication, and follow-up workflow.

close.com is blocked from this environment, so the sources are Close's own pages and help docs as search results
show them (listed at the end). These are principles only; no Close screen or line is copied.

---

## What Close does

- **The customer's side is the unit of work, not the record.** Close's Inbox mixes new messages, missed calls,
  voicemails and due reminders into one list. It's work to do, not a table to manage.
- **Three places a conversation can be:**
  - **Inbox:** needs you now.
  - **Future:** snoozed or scheduled, and comes back by itself.
  - **Done:** handled.

  Every conversation is in exactly one of them. This is the "open loops" idea from the reference strategy, in
  product form.
- **Reminders that know about replies.** You set a follow-up on an email ("remind me in 3 days"), and it's
  cleared automatically if they answer. When it does come due, Close suggests the follow-up text right there.
- **Stalled means "longer than usual", not a fixed number.** Close reminds you when an opportunity has sat in a
  status longer than is typical for that status.
- **Speed is the headline promise, said plainly.** Their copy leans on "respond while leads are at their warmest",
  "never miss a lead", "nothing slips through the cracks". The blog's advice: respond faster than the next company,
  and a perfect pitch matters less than a fast human reply.
- **Proof is a before and after in the customer's own number.** Case studies name the pain, what changed, and one
  measured result, for example response time from 72 hours to 15 minutes. It isn't a star rating.
- **Close talks like its user.** Its user is a salesperson, so it says "lead", "pipeline", "opportunity", "power
  dialer".

### The principles underneath

- **P1:** Use the word your user uses. Close's user says "lead". Ours, a busy owner, says "customer".
- **P2:** Every conversation lives in one of three places: needs you, waiting on them, done. Show all three, so
  nothing is in two places or none.
- **P3:** A reminder is a promise with a condition: "I'll check in Thursday, unless they write first."
- **P4:** Speed is the value. Show the owner their own real response speed, never an industry statistic.
- **P5:** Proof is one specific before and after, in the customer's own numbers and words.

---

## Where FollowUp stands (checked on main, 2026-09-26)

1. **Our vocabulary is split.**
   - The brand rule is "customer" over "lead" (brand principle 9), and Today and most of the landing page follow it.
   - The app still says "Leads", "No leads yet", "Search leads…", "Total leads" and "When a lead writes…".
   - The approved headline "Never lose a lead…" (A-013) is the founder's own line and stays.
2. **Two of the three places are named, not the middle one.**
   - "Needs your OK" (needs you) and "handled today" (done) are on Today.
   - **"Waiting on the customer"** (we replied, they haven't) has no home.
   - Coming up lists who FollowUp writes to next, but not everyone we're simply waiting on.
3. **The condition in the reminder already exists, on the lead page only.**
   - `automationStatus.ts` knows "checks in Thursday unless they reply".
   - Today's "Coming up" lists the date but not "unless they write first".
4. **Speed isn't shown.**
   - FollowUp knows how fast each customer got an answer, but never tells the owner.
   - The weekly line says who answered, not how quickly we did.
5. **The proof section is empty (correctly, A-023).** There's no template waiting for a tester's real before and
   after.

---

## Proposals (ranked)

1. **Three places, named on Today (P2).**
   - Under the queue, one quiet line: "Needs you 3 · Waiting on customers 7 · Handled today 4".
   - "Waiting on customers" opens the list of everyone we've replied to who hasn't answered yet. Each one shows when
     FollowUp will check in, "unless Priya writes first".
   - On the phone, only the line (R-015).
2. **Your real reply speed (P4).**
   - One fact, from our own data, on desktop Today's week line and in the weekly email: "Customers heard back in 6
     minutes this week (median)".
   - It's shown only when there were replies, and no industry statistics are ever used.
3. **"Customer" in the app, everywhere a customer would say it (P1, brand principle 9).**
   - Copy only, no layout: "Leads" becomes "Customers", "No leads yet" becomes "No customers yet", "Search leads…"
     becomes "Search customers…", "When a lead writes" becomes "When a customer writes".
   - The page route stays `/leads`. The approved hero headline stays.
4. **The condition on every reminder (P3).** Wherever a check-in date shows (Coming up, the waiting list, the lead
   page), it says "unless Priya writes first". It's the same fact the lead page already has, said everywhere.
5. **A proof section that waits for real numbers (P5, A-023).**
   - A designed but hidden section: a tester's own before and after ("replied in 2 days → replied in 9 minutes"),
     their words, and their first name and business.
   - It appears only with their written OK and real numbers, as the reference strategy's Proof step.

**Guardrails:**
- No invented statistics ("78% buy from the first responder" is not ours to quote).
- No urgency theatre.
- The reply speed is the owner's own, so it's never compared with anyone else.

**Rejected-list check:** clean. R-015 is respected (the phone gets one line). A-023 is respected (no fake proof).
There's no "blast" language (brand principle 7).

---

## Sources

- Close:
  - [Close CRM home](https://close.com/)
  - [CRM](https://close.com/crm)
  - [Automation](https://close.com/automation)
  - [Sales communication](https://close.com/communication)
  - [Never miss a lead again: automate every follow-up](https://close.com/blog/automate-follow-ups-with-close-workflows)
  - [How to reach out to leads fast](https://www.close.com/blog/how-to-reach-out-to-leads-fast)
  - [Customer stories](https://close.com/customers)
  - [14 CRM implementation case studies](https://close.com/blog/crm-implementation-case-studies)
- Close Help:
  - [Inbox](https://help.close.com/docs/inbox)
  - [Emailing and follow-up reminders](https://help.close.com/docs/emailing)
  - [Tasks](https://help.close.com/docs/tasks)
  - [Search and Smart Views](https://help.close.com/docs/search-and-smart-views-legacy)
  - [Inbound lead response](https://help.close.com/docs/inbound-lead-response)
