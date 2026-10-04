# Does the solo owner actually have this problem? And what if they have few leads? — 2026-10-04

**The founder's two questions:** *"Lots of leads means a big business, and a big business has a team. Why
would they use FollowUp? Do solo owners and small teams even face this problem? And what if someone has no
leads?"* Grades as in the other notes: **A** primary number, **B** company's own page via snippet, **C** blog or
vendor study via snippet.

## In short

1. **The small ones are the slow ones.** Companies under 10 people answer a lead in 47 hours on average; the
   best of them in 32 minutes. In the 1-to-10 band, 13 percent answer within five minutes and 22 percent never
   answer. Big companies are slow too (the 42-hour median includes them), but they have a team and a CRM and
   are the per-seat market. The owner with nobody is the one with no safety net.
2. **Few leads, high value.** A solo realtor gets roughly 10 to 50 inquiries a month and closes 2 to 3
   percent of them; one closing is worth 2.8 percent of the sale (about $28,000 on a $1 million Toronto
   home). A plumber's lead costs $25 to $75 to buy and a job is worth $300 to $8,000. At that value, missing
   one lead a quarter costs more than FollowUp costs in a year. Low volume makes each lead *more* worth
   chasing, not less.
3. **The problem is time, not count.** Owners spend about a quarter of their week in email and the rest on
   the job. A lead that arrives at 2 pm while they are on a roof is answered at 9 pm or not at all. That is
   the same problem at 5 leads a month as at 50.
4. **No leads at all: FollowUp is the wrong tool, and we should say so.** FollowUp does not generate leads
   (`PRODUCT_DIRECTION.md`). The landing page should qualify: "for businesses that already get inquiries by
   email." The one thing we can do for a quiet account is the first Gmail sync: it reads the recent inbox and
   shows the inquiries they never answered. That is a real first-value moment and it exists in the code.

## 1. By company size: who answers, who doesn't

| Finding | Source | Grade |
|---|---|---|
| Under 10 employees: average lead response 47 hours; best-in-class 32 minutes | revenuehero benchmarks by size | C |
| 1 to 10 employees: 13 percent respond within five minutes; 39 percent in 1 to 24 hours; 21.7 percent never | same test, 1,000 B2B teams | C |
| 384 brokers (individual agents answering their own inquiries): 48 percent never responded; average 15 hours | WAV Group 2014 | A, old |
| 150 small businesses: 62 percent no reply within a week | Finnish mystery-shopper test | C |
| Across 2,241 firms of all sizes: median 42 hours | HBR | A |

Read: the problem exists at every size, and the big companies solve it by hiring: an SDR, a receptionist,
a CRM with action plans. The owner under 10 people has the worst numbers and no one to hire. That is the
audience, and it is 82 percent of US small businesses (SBA, A) and about 2 million self-employed in Canada
(Statistics Canada, A).

## 2. How many leads does a solo owner get, and what is one worth?

**Volume**
- Vendor advice to solo agents: aim for 40 to 50 leads a month; 22 percent of realtors spend $50 to $250 a
  month on leads; conversion 2 to 3 percent, so 33 to 50 inquiries per closing; referrals convert near 14
  percent (The Close, resimpli; C).
- The realistic solo realtor in our data: 16 to 22 customers in FollowUp after a few weeks on Gmail.
- A solo plumber or HVAC tech: 62 percent of calls missed (ServiceTitan via earlier note; C); a few inquiries
  a week by phone, form and email.

**Value**
- Zillow Premier Agent: $139 to $223 per lead on Zillow's own figures, $100 to $600 in practice (C).
- Buyer-side commission 2.82 percent on average (C); on a $1 million home that is about $28,000 for one
  closing.
- Plumbing lead $25 to $75, close rate 30 to 45 percent, job $300 to $8,000; HVAC lead $30 to $90, job $400
  to $12,000 (contractor benchmarks; C).
- Personal-injury legal lead $150 to $1,200 (C).

**The arithmetic the owner already understands:** at 2 to 3 percent conversion, every inquiry is worth
2 to 3 percent of a commission, so about $500 to $800 of expected value for the realtor and $100 to $3,000
for the tradesperson. Letting one go unanswered per month is a four-figure loss per year. FollowUp at $39 a
month is paid for by the first one it catches. Low volume does not weaken that; it means each lead is a
larger share of the owner's income.

## 3. Why the big business with a team is not the customer

- They answer slowly too, but they buy Follow Up Boss ($69 a seat), HubSpot ($1,600 a month for agents),
  Podium ($399 plus contract). That market is per seat, sales-led and crowded (`2026-10-04-crm-study`).
- Their problem is process and handoffs; ours is "nobody is there". Different buyer, different product.
- A team that grows out of FollowUp is a success, not a loss: the record goes with them (Rule 2), and a
  2-person team is still a FollowUp customer; a 20-person one is not.

## 4. What if the owner has no leads?

- FollowUp does not make leads; it keeps the ones that come. If fewer than one inquiry a week arrives, Today
  is empty and the product feels like nothing. That is not a product failure to fix with features; it is the
  wrong customer. Qualify on the landing page: "for businesses that already get inquiries by email."
- The exception that is already built: **the first Gmail sync** reads the recent inbox, finds sales
  conversations and scores them. For a quiet account this is the moment of value: "here are 6 people who
  wrote to you and never got an answer." That should be the first screen after Connect Gmail, before any
  settings.
- The booking link and the website form create inquiries from traffic the owner already has; they are
  capture, not generation, and stay.

## 5. What this changes

- Recruit owners who get inquiries by email, under 10 people, no CRM. Ask one question before inviting: "how
  many people emailed you about work last month?" Fewer than four: thank them, don't onboard yet.
- The landing page says who it is for in one line and shows the first-sync moment.
- Pricing stays flat and low; the value per saved lead carries the argument, not the volume.

## Sources
- Response by size: [revenuehero by company size](https://www.revenuehero.io/blog/inbound-lead-response-time-benchmarks-by-company-size), [revenuehero 1,000-team test](https://www.revenuehero.io/blog/b2b-lead-response-times), [salescaptain small business](https://blog.salescaptain.com/average-lead-response-time-statistics-for-small-business-2026/)
- Realtor volume and conversion: [The Close lead-gen statistics](https://theclose.com/real-estate-lead-generation-statistics/), [resimpli](https://resimpli.com/blog/real-estate-lead-generation-statistics/), [Ylopo spend](https://www.ylopo.com/ask-ylopo/how-much-do-realtors-spend-on-leads)
- Lead value: [Zillow Premier Agent cost](https://www.jamilacademy.com/blog/zillow-premier-agent-cost), [commission rates](https://listwithclever.com/average-real-estate-commission-rate/), [contractor CPL](https://beseencontractors.com/guides/contractor-cost-per-lead-by-trade-2026/), [pulseintel benchmarks](https://pulseintel.dev/resources/cost-per-lead-benchmarks)
- Owner time: [SCORE](https://www.score.org/articles/small-business-owners-work-long-hours-get-little-done/), [The Alternative Board survey](https://www.thealternativeboard.com/time-management)
