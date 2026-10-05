# Watch a tester: 15 minutes, five tasks (2026-10-05)

**Why:** the Laws of UX study (2026-10-03, rule 9) and the density study say to test by task, never by
asking "do you like it". People are polite about screens and honest with their hands. This script turns
four open questions into things you can see:

| Open question | Where it came from | Which task answers it |
|---|---|---|
| Is setup step 2 too long on a phone? (#10) | Check-up | Task 1 |
| Does anyone read the "This week" line and the work line? | Density study (C2), A-088 | Task 3 |
| Do owners look for the word "Inbox"? | Today vs Inbox study (A-082) | Task 4 |
| Do they trust a reply enough to send it unchanged? | CRM study: the proof number | Task 2 |

## Before

- Their own phone, their own account, ideally with a real customer email waiting. If the inbox is quiet,
  have them press "See it work: send yourself a practice email" first.
- Screen recording on (with their OK), or sit beside them.
- Say once: *"I'm testing FollowUp, not you. If something's confusing, that's our mistake. Please think
  out loud."* Then say as little as possible.

## The five tasks (read each one out, then stay quiet)

1. **"Set up FollowUp as if it's the first time."** (only for a new tester)
   Watch: on step 2, do they scroll to find the button? Do they stop and read? Time it.
2. **"Someone is waiting for an answer. Answer them."**
   Watch: do they find the person in under 10 seconds? Do they read the reply before Send? Do they press
   Edit? What do they change? Do they press Send?
3. **"You're done. What did FollowUp do for you this week?"**
   Watch: do their eyes go to the bottom line of Today? Do they read it out, or open something else?
4. **"Find the conversation with [a customer they named]."**
   Watch: do they look for "Inbox"? Do they use search, the Customers tab, or scroll?
5. **"Make FollowUp stop writing to that customer."**
   Watch: do they find the switch on the customer's page, or go to Settings?

**Don't help.** If they're stuck for 30 seconds, ask *"What are you looking for?"* and write down the
exact words. Those words are the fix.

## After (three questions, then stop)

- "What was the most annoying moment?"
- "What would make you open this every morning?"
- "Would you be OK with FollowUp sending replies like that one without asking you?"

## Write it down the same day

In `design-brain/research/ux-patterns/YYYY-MM-DD-watched-<role>.md` (role only, never a name), one line per
task: **did / didn't, how long, their exact words.** Then tell me "I watched a tester" and I'll turn it into
fixes. Anything they never looked at (for example, the "This week" line) is a candidate to remove (R-026).
