# First realtor interview: how he qualifies a lead (2026-10-20)

**Source:** Sahil's interview with the first realtor who will connect GoHighLevel (Greater Toronto Area). Summary
from Sahil's transcript notes; no names kept. **Evidence: one realtor, his own words.** Not yet compared with others.

## What he said

**Follow-up**
- Leads can't be pushed: someone buys only when they want to.
- No specific phrases he wants avoided.

**His GoHighLevel**
- He has a few automations, possibly not active now.

**How he qualifies, in his order**
1. **Immigration status first.** Permanent residents qualify. Study-permit leads are, in his words, time wasters.
   Many calls come from work-permit holders and others he sees as not eligible.
2. **Income and down payment**, to judge whether they can afford it. PR plus money means eligible.
   Example: $30,000 income with a $10,000 down payment goes to nurture, not active pursuit.
3. **After that:** their job, where they live now, and the areas they want (Brampton and Mississauga given as
   examples).
4. Then he **sets up email listings** for those areas and keeps following up.

## How it compares with FollowUp today (A-299, `qualification.ts`)

- Buyer order today: area + timing → viewing + agent → lender + price range (money last, asked softly).
- He asks about status and money **first**, and area last.
- His "not now" leads match what FollowUp calls stay in touch (A-260), not a lost lead.
- "Can't push a lead" matches the trust rules (A-247): no pressure.
- Listing emails are outside FollowUp: it can't set up MLS alerts.

## Open questions for Sahil (product behaviour, his call)

- Should FollowUp ask about money (pre-approval, down payment) earlier for realtors like him?
- Immigration status: should an automated message ever ask it? Flagged: a written status question from a business
  can read as discrimination and may carry legal risk in Ontario. Not a legal opinion; check with RECO or a lawyer
  before any automated message asks it.

## Second conversation, same day (from Sahil's meeting summary)

**What he uses today**
- An Instagram messaging tool, built by someone he knows. It could not message the cold and warm customers in his
  GoHighLevel resale pipeline in one go ("too many messages"). It gave him a CSV of about 699 customers with
  instructions instead.

**What he heard about FollowUp**
- Sahil told him: it connects GoHighLevel and his other sources (Instagram, Gmail, website forms, CSV), learns his
  qualifying questions and his way of writing, chats with customers to find their status, budget and what home they
  need, gives a summary before the call, and hands over the ready ones. He said this would be very beneficial.

**What this tells us**
- His real pain is a pipeline of hundreds of old customers nobody is writing to, not only new messages.
- FollowUp can take the file: import accepts a CSV of up to 1,000 rows (`api/leads/import`), and importing sends
  nothing. It must stay that way: messaging 699 people at once is the blast FollowUp never does (trust rules,
  A-247). Old GoHighLevel conversations already come back 10 a day as drafts he approves (GHL wake-up).
- "Learns my questions and my style" is now a promise made to a real customer. Style is learned from his sent and
  edited replies today; his own question order is not (open: "teach it your own way", not built).
