# First 5–10 paying customers in the GTA — email + website-form channel, $0 ad spend

**Date:** 2026-09-10
**Question asked:** how does a solo Toronto founder with zero paying customers and no ad budget land
the first 5–10 paying customers on the only channels live today without third-party verification
paperwork — email (Gmail/Outlook) and the website widget?
**Method:** internal research corpus read first (`research/market/`, `research/customers/`, `docs/PRD.md`,
`src/lib/billing.ts`); external facts via WebSearch. WebFetch is egress-blocked in this sandbox, so
every external claim is search-snippet-sourced, not page-verified — graded accordingly.

**Grades (house style, per `2026-09-08-pentest-vendor-options.md`):** A = primary source or large
independent sample. B = credible secondary citing a named primary, or a platform's own help-centre
description of its own mechanics. C = vendor/practitioner blog, plausible but self-interested, not
independently verified. D = hypothesis or anecdote; this document's own inference.

---

## 0. The answer in one paragraph

Run two tracks in parallel for 10–12 weeks. **Track A — skilled trades (HVAC/plumbing/electrical,
then renovators)** reached through named trade communities (HRAI, OEL chapters, two Ontario contractor
Facebook groups, HomeStars scouting), where trust is built in person and the pitch is "the furnace
quote that sat in your inbox until the customer called someone else." **Track B — email-native
professionals (small law firms, paralegals, immigration consultants, dental front desks)** reached by
CASL-compliant, hand-personalized cold email and LinkedIn, where the evidence of the problem is the
strongest on file (Clio: only 33% of law firms answered a test email) and the buyer already lives in
the inbox. Open every conversation with a real measurement of *their* response time (the "secret
shopper" opener), demo live in the lead's language, and run a 30-day pilot with success criteria
agreed up front and a hard go/no-go date. At benchmark conversion rates this produces roughly **4–6
paying customers from ~25–30 demos**; getting to 10 requires the first 5 to refer (Section 5).
Before any of it: finish Google OAuth verification, or run email pilots on Outlook/widget, because
unverified Gmail tokens expire in 7 days and would break a 30-day pilot (Section 6).

---

## 1. Which GTA segments to target first

### 1.1 What the internal research already established

- The ICP is a small owner-operated business with more inbound than it can answer across several
  channels and no follow-up person; **home-services contractors carry the strongest quantified pain
  signal in the corpus** (62% missed-call rate; 391% conversion lift from a 1-minute callback),
  and med-spas / salons / small law-firm intake are a second concrete cluster
  (`research/customers/2026-09-05-icp-pain-and-trust-objections.md` Finding 1;
  `research/market/2026-09-09-business-model-case.md` §2).
- Real estate is **declined as the primary vertical by the CEO** — most crowded segment (Ylopo,
  Structurely, Sierra, Lofty already sell cold-lead rescue to realtors)
  (`research/market/2026-09-07-lead-rescue-gap-and-strategy.md`). Not revisited here.
- The business-model case's own GTM plan for the first 10: founder-led, "one narrow vertical
  community, not a broad cold-email blast," white-glove setup, and the first 10 conversations double
  as customer interviews (`2026-09-09-business-model-case.md` §10).
- A separate CEO-supplied GTA report (not in this repo) pointed at solo skilled trades — HVAC,
  plumbing, electrical, with the "annual furnace check" rebooking loop — as the closest fit to
  FollowUp's existing shape. This document takes that as the starting hypothesis and tests it against
  the *email + web-form only* constraint, which the earlier research did not have to respect.
- Pricing on file: $29/mo flat (Section 4); every comparable tool charges 3–20× that
  (`2026-09-08-pricing-validation-home-services-icp.md`).

### 1.2 The constraint that changes the ranking: only email and web forms are live

The earlier ICP work ranked segments partly on *phone* pain (missed calls, voicemail hang-ups).
Phone/SMS is gated today. So each segment below is scored on four things: (a) how much of its inbound
actually arrives by email or a website/directory form, (b) evidence it is answered slowly or never,
(c) revenue per lead high enough that one rescued lead pays for a year of FollowUp many times over,
(d) whether it can be reached for free in the GTA.

### 1.3 The ranked shortlist

| # | Segment | Email/form share of inbound | Evidence of slow/no response | Revenue per rescued lead | Free reach in GTA | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Solo/small HVAC, plumbing, electrical contractors** (1–5 people) | Medium — phone-first trade, but HomeStars/Google/website quote requests arrive as email | Strong (home services is the worst-measured industry) | High: GTA furnace replacement $3,500–$7,000; maintenance plans $99–$199/yr with 75–90% renewal | Excellent: HRAI in Mississauga, OEL chapters, two Ontario contractor FB groups, HomeStars | **Primary, Track A** |
| 2 | **Renovation contractors / remodelers** (RenoMark-tier and below) | High — nearly all first contact is a web form, HomeStars/Houzz quote request, or email | Moderate (anecdotal, HomeStars review complaints) | Very high: Toronto bathroom ~$17k avg, kitchen $15k–$100k+ | Excellent: BILD RenoMark directory, Renovation Contractors Ontario FB group | **Primary, Track A (second wave)** |
| 3 | **Small law firms, paralegals, immigration consultants (RCICs)** | Very high — email and web-form intake is the norm; clients are often multilingual | **Strongest on file:** Clio found only 33% of law firms answered a test email (down from 40% in 2019) | High: a single retainer; RCIC applications are multi-thousand-dollar files | Excellent: LSO directory (searchable by language + postal code), CICC public register, OBA Sole/Small Firm section, TLA, CAPIC | **Primary, Track B** |
| 4 | **Dental clinics (new-patient web forms)** | High for new-patient requests; existing-patient comms usually live in practice software | Moderate (vendor-published: ~35% of calls missed; 78% book with first responder) | High: new-patient LTV $5,000–$8,000 | Good: RCDSO Find-a-Dentist, ODA (11,000 members), Google Maps | **Secondary, Track B** — test 2–3, not a focus |
| — | Med-spas / aesthetic clinics | Low on email — inbound is Instagram DM | Vendor-stated, strong | High | Good | **Defer** until Meta verification; wrong channel today |
| — | Realtors, mortgage brokers | High on email | Strong | High | Excellent | **Declined** (CEO) / crowded — not pursued |

**Why two tracks and not one.** The trades are the best *product* fit (multi-channel chaos, the
rebooking loop, immigrant-owned, the CEO's own direction) but the worst *email-only* fit — most of
their leads are phone calls FollowUp cannot touch yet, and trust there is built face-to-face over
weeks. Law/paralegal/RCIC is the best *email-only* fit with the hardest evidence and can be reached
by cold email starting tomorrow, but it is a less-explored persona in the corpus. Running both
hedges the biggest unknown (which persona actually converts) without diluting either: Track A is
mostly in-person and evenings; Track B is mostly desk time in the morning. Pick the winner at week 6.

### 1.4 Segment evidence, with grades

**Skilled trades (HVAC/plumbing/electrical).**
- Home services: most common response time to a new lead is 1 day (37% of firms); only 3% respond
  in under a minute; 63% of companies overall never respond to a form submission.
  [Grade C — vendor-aggregated (Apten, Endigita), snippet-sourced; consistent with the corpus.]
  https://www.apten.ai/blog/speed-to-lead-benchmarks-2026 ,
  https://endigita.com/blog/lead-response-time-home-service-business-2026/
- ServiceTitan's 2025 Home Services Benchmark (as relayed by CustomerFlows): average home-service
  company takes 42 minutes to respond, and **23% of leads never get a response**; contractors
  responding within 2 minutes convert 62% vs 28% at the 42-minute average.
  [Grade C — vendor study relayed by a third-party marketing blog; not fetched.]
  https://customerflows.com/research/contractor-lead-response-time-study/
- 62% missed-call rate / 86% voicemail hang-up — already on file, Grade B/C
  (`2026-09-05-icp-pain-and-trust-objections.md`).
- GTA revenue per job: new gas furnace installed **$4,300–$7,000** for most Toronto homes;
  Ontario average ~$6,800 before tax; replacement projects $3,500–$6,500 all-in.
  [Grade C — three GTA contractor pricing pages converge on the range; self-interested but
  consistent.] https://hvactrust.ca/furnace-prices-toronto-2026/ ,
  https://www.custom-contracting.ca/resources/hvac-cost-ontario ,
  https://megacityhvac.com/blog/furnace-cost-toronto
- The rebooking loop: HVAC maintenance memberships run **$99–$199/yr** (or ~$20–30/mo), renewal
  rates 75–90% in successful programs; plan members are worth an estimated $3,000–$5,000 in repair
  and replacement revenue over five years. This is the "annual furnace check" the CEO's GTA report
  named, and it is exactly a *follow-up* job (remind, rebook, chase the silent customer), not a
  lead-gen job. [Grade C — US contractor-software blogs; no Ontario-specific figure found.]
  https://www.smartservice.com/blog/how-much-hvac-service-agreements ,
  https://www.constructioncostaccounting.com/post/hvac-maintenance-plans-pricing-profitability
- Immigrant ownership: a third of Canadian employer businesses are immigrant-owned, concentrated in
  trades that live on inbound calls and messages — already on file, Grade A (StatCan), and the
  reason the in-language instant reply is a wedge in Brampton/Mississauga/Markham specifically
  (`2026-09-07-why-followup-evidence-for-and-against.md` §2).

**Renovation contractors.**
- Toronto bathroom renovation **$15,000–$30,000**, most mid-range projects ~$17,000; kitchens from
  $15,000 to $100,000+. [Grade C — HomeStars price guide plus renovator blogs; converge.]
  https://www.homestars.com/bathroom-sanitary/price-guides/bathroom-renovation-cost-toronto ,
  https://www.homestars.com/home-constructions-renovations/price-guides/renovation-costs-toronto
- HomeStars reviews include homeowners reporting quote follow-ups going unanswered and contractors
  who "don't respond after several phone calls." [Grade D — anecdotal review snippets, not a
  measured rate.] https://ca.trustpilot.com/review/homestars.com
- No renovation-specific response-time study found. The 63%/23%-never-respond figures above are
  cross-industry and are the best available proxy. [Honest gap.]

**Small law firms / paralegals / immigration consultants.**
- Clio hired a third-party firm to contact 1,000 law firms by email and phone; **only 33% responded
  to the email inquiry**, down from 40% in 2019. [Grade B — Clio's own press release describing its
  Legal Trends Report methodology; a real mystery-shopper study, vendor-published.]
  https://www.clio.com/about/press/clios-legal-trends-report-reveals-law-firms-struggle-to-respond-to-client-inquiries/ ,
  https://www.2civility.org/2024-clio-legal-trends-report-fixing-the-first-impression-problem-for-law-firms/
- Immigration consultants: **no response-time or inquiry-volume data found** for RCICs. Public
  review sites (Rate My RCIC) rate consultants on "responsiveness" and client complaints about
  unanswered emails exist, which is signal, not measurement. [Grade D.]
  https://ratemyrcic.ca/consultants/toronto
- CAPIC (the RCIC professional association) has 4,300+ members and is headquartered in Toronto.
  [Grade B — association's own site.] https://www.capic.ca/
- Why this segment fits the *product* and not just the channel: intake email arrives in the language
  of the prospective client (Punjabi, Mandarin, Tagalog, Farsi, Portuguese) and a one-line "we
  received your message, we'll reply within one business day" in that language is a trust signal a
  sole practitioner cannot deliver at 11pm. This is inference from the multilingual evidence already
  on file, not a measured effect. [Grade D.]

**Dental clinics.**
- Practices miss ~35% of incoming calls; 65% of missed calls are from prospective new patients; a
  clinic that cut email response from 24h to under 10 min reported +40% new-patient bookings.
  [Grade C — dental AI-receptionist vendors; unverified.]
  https://www.getviva.ai/lead-response-time-statistics-dental-2026/ ,
  https://www.resonateapp.com/resources/missed-calls-dental-practices-statistics
- New-patient lifetime value $5,000–$8,000; cost per new patient $150–$400 (Canadian source).
  [Grade C.] https://dentx.ca/blog/dental-new-patient-cost/ ,
  https://www.meetdandy.com/learning-center/articles/whats-the-lifetime-value-of-a-dental-patient/
- Caveat that keeps this secondary: a practice with Dentrix/Curve-style software may already have
  patient messaging for *existing* patients; FollowUp's wedge is the *new-patient* form and email
  the front desk reads between patients. Test with 2–3 clinics before investing.

---

## 2. Where exactly to find and reach them for free

Everything below is a named venue with a URL. "Free" means no membership fee or a guest visit
allowed; where a fee exists it is stated.

### 2.1 Track A — trades and renovators

**Associations and chapters (in-person, trust-building)**
- **HRAI — Heating, Refrigeration and Air Conditioning Institute of Canada.** Headquartered in
  Mississauga; 1,150+ member companies; consumer-facing "find a contractor" tool lists member
  contractors (a scouting list). Attend a member event as a guest/vendor prospect; ask the Ontario
  contractor division for their next chapter meeting. [Grade B — association's own site.]
  https://www.hrai.ca/ , https://www.hrai.ca/consumer
- **Ontario Electrical League (OEL).** Non-profit for *independent* licensed electrical contractors —
  the solo/small operator, not the unionized ECAO shop. 23+ chapters, 2,500+ members; chapter
  meetings are "grassroots gatherings at local restaurants and halls." Use the chapter map to find
  the Toronto / York / Peel chapters and ask the chapter chair to attend as a guest.
  [Grade B — OEL's own site.] https://www.oel.org/ , https://www.joinoel.ca/chapter-map/
- **ECAO** (550 IBEW-signatory contractors) — larger union shops; lower priority for a $29 tool but
  their events are where trade suppliers exhibit. https://www.ecao.org/
- **BILD GTA / RenoMark.** "Find a RenoMark Renovator" is a public directory of GTA renovators who
  signed a code of conduct (i.e. the professionalized tier that cares about customer service);
  BILD runs RenoMark awards and events. Directory is the scouting list; renomark@bildgta.ca is the
  program contact. [Grade B.] https://www.bildgta.ca/find-a-renomark-renovator/ ,
  https://renomark.ca/
- **Ontario Plumbing Contractors Association** — searched, not found as a distinct active body;
  plumbing contractors in the GTA cluster under HRAI (mechanical) and the FB groups below. [Honest
  gap.]

**Facebook groups (post value first, pitch never in the first two weeks)**
- **HVAC-R Contractors In Ontario** — https://www.facebook.com/groups/hvaccontractorsontario/
- **HVAC and Plumbing Business Owners and Contractors** —
  https://www.facebook.com/groups/25281616931449856/
- **Renovation Contractors Ontario Canada** — https://www.facebook.com/groups/contractorsontario/
- **Jobber Entrepreneurship Group** — Jobber is Toronto-based; the group is "where thousands of home
  service pros go to trade advice." Also Jobber's forum at community.getjobber.com.
  https://www.facebook.com/groups/jobberentrepreneurshipgroup/
- **HVAC Ontario** (page, Toronto) — https://www.facebook.com/hvacontario/
  [All Grade B — the groups exist per search results; member counts and rules not visible without
  joining. Read each group's rules before posting.]

**Directories for scouting (who to contact, and proof of slow response)**
- **HomeStars** (Toronto-founded). Category pages list every HVAC/plumbing/electrical/general
  contractor in Toronto with a Star Score that *includes response rate*. Use it to build the
  contact list and to spot slow responders. [Grade B — HomeStars' own scoring description via
  search.] https://www.homestars.com/heating/hvac-contractor-pros/toronto ,
  https://www.homestars.com/home-constructions-renovations/general-contractor-pros/toronto
- **Yelp** publicly displays each business's **response rate and median response time** (last 30
  days, business hours) on its page, and disables Request-a-Quote after 7 days of no replies.
  A visible "Responds in about 2 days" is a pre-qualified prospect and a personalized opener.
  [Grade B — Yelp's own help centre.]
  https://biz.yelp.com/support-center/article/How-is-the-response-time-and-response-rate-calculated-for-messaging-my-business
- **Google Maps / Business Profile categories** to search by municipality (Mississauga, Brampton,
  Vaughan, Markham, Scarborough, Etobicoke): `HVAC contractor`, `Furnace repair service`,
  `Heating contractor`, `Plumber`, `Electrician`, `Remodeler`, `Bathroom remodeler`,
  `Kitchen remodeler`. Filter to 3.5–4.7 stars with 10–150 reviews (busy enough to have leads,
  small enough to have no front office). [Grade B — category names per GBP category lists.]
  https://daltonluka.com/blog/google-my-business-categories ,
  https://www.shiftflow.app/playbook/best-google-business-profile-categories-for-hvac-contractors
- **Toronto Construction Network** and **GTA Trades Daily** — verified-trades directories, useful as
  a second list. https://torontoconstructionnetwork.com/directory ,
  https://www.gtatradesdaily.com/directory

### 2.2 Track B — law, paralegal, immigration, dental

- **Law Society of Ontario directory** — every licensed lawyer and paralegal, searchable by
  **language, area of law, city or postal code**. Filter: sole practitioner, family/immigration/
  real-estate/criminal, non-English language, postal codes L6 (Brampton), L5 (Mississauga),
  L3 (Markham), M1 (Scarborough). This is the single best free list in this document.
  [Grade A — regulator's directory.] https://lsodirectory.lso.ca/en-US/
- **Ontario Paralegal Association — Find a Paralegal** (search by area and location).
  [Grade B.] Referenced at https://stepstojustice.ca/steps/criminal-law/2-find-lawyer-or-paralegal/
- **OBA Sole, Small Firm and General Practice Section** — CPD and networking for exactly this buyer;
  OBA's Ontario Legal Conference is in downtown Toronto. Section membership requires OBA
  membership; events are often open to non-members for a fee. [Grade B.]
  https://www.oba.org/Sections/Sole-Small-Firm-and-General-Practice
- **Toronto Lawyers Association** — many free/low-cost events; membership $127 + HST for
  practising lawyers (the founder is not a lawyer; ask about vendor/guest attendance). [Grade B.]
  https://www.canadianlawyermag.com/news/general/networking-for-the-solo-or-small-firm-practitioner/268047
- **CICC public register** — every licensed RCIC, searchable by city and company name.
  [Grade A — regulator.] https://register.college-ic.ca/Public-Register-EN/Public-Register-EN/RCIC_Search.aspx
- **Rate My RCIC (Toronto)** — consultant profiles rated on *responsiveness*; low-responsiveness,
  high-volume profiles are the target. [Grade C — third-party review site.]
  https://ratemyrcic.ca/consultants/toronto
- **CAPIC** — 4,300+ members, Toronto HQ, runs CPD summits; ask about the Ontario chapter meeting.
  https://www.capic.ca/
- **RCDSO Find a Dentist** (regulator) and **ODA Find a Dentist** (11,000 members) — searchable by
  location. https://www.rcdso.org/find-a-dentist , https://www.oda.ca/find-a-dentist/
- **Google Maps categories:** `Immigration attorney`, `Immigration & naturalization service`,
  `Law firm`, `Paralegal services provider`, `Family law attorney`, `Dental clinic`, `Dentist`.
- **LinkedIn** — lawyers, RCICs and dentists are on it; tradespeople mostly are not. Benchmarks in
  Section 5.

### 2.3 Cross-segment, multilingual and general small-business venues

- **BNI GTA Plus** — 21 chapters, 459 members; visiting is free, max two visits before a join
  decision; contact the chapter president first; you may not pitch if your category is already
  represented. Chapters are full of exactly Track A/B people (a plumber, a paralegal, a dentist
  per chapter). [Grade B — BNI's own visitor rules.] https://bnigtaplus.ca/en-CA/findachapter ,
  https://bnicanada.ca/en-CA/find_a_chapter
- **GTApreneurs** — free/low-cost networking: Toronto 1st Wednesday 6–8pm, virtual 2nd Wednesday
  noon, Newmarket 3rd Tuesday, Vaughan/Richmond Hill last Tuesday. [Grade B.] https://gtapreneurs.com/
- **City of Toronto — Small Business Forum, business webinars, startup events** (free).
  https://www.toronto.ca/business-economy/new-businesses-startups/small-business-startup-events/
- **CanadianSME Small Business Summit 2026** — October, Metro Toronto Convention Centre, free
  registration. https://smesummit.ca/
- **Toronto Region Board of Trade** events calendar (some open to non-members). https://bot.com/Events
- **Facebook:** Toronto Small Business Owners (facebook.com/groups/smallbusinessownersTO/),
  Toronto Entrepreneurs & Startups (facebook.com/groups/toronto.entrepreneurs.startups),
  Small Business Toronto (facebook.com/groups/21463251615/).
- **Immigrant-owned business networks (the multilingual wedge):**
  - Markham Richmond Hill & Vaughan Chinese Business Association (MRVCBA), (905) 731-8806,
    https://mrvcba.ca — co-hosts networking with the Markham Board of Trade.
  - Mississauga Chinese Business Association, https://mcba-canada.com/
  - South Asian Business Association Toronto, https://sabatoronto.com/saba-events/ ,
    info@sabatoronto.com
  - Indo-Canada Chamber of Commerce (holds events in Brampton), https://www.iccconline.org/
  - Brampton Board of Trade and Mississauga Board of Trade (guest event tickets).
  [All Grade B — organizations confirmed via their own sites/LinkedIn; event schedules not
  verified for 2026.]
- **Reddit** — useful for listening, weak for selling: r/sweatystartup (home-service owners),
  r/smallbusiness, r/HVAC, r/Plumbing, r/electricians, r/LawFirm, r/ImmigrationCanada. Reddit's
  norm is 90/10 participation and most trade subs ban vendor posts; treat as a place to read how
  owners describe missed leads and to answer questions, not to post links. [Grade C — general
  self-promotion guides; subreddit-specific rules not fetched.]
  https://redship.io/blog/reddit-self-promotion-rules

### 2.4 The scouting method that turns a list into a warm opener ("secret shopper")

For every target on the list, before the first message, do one of:
1. Read their public **Yelp response time / HomeStars response rate / Rate My RCIC responsiveness**.
2. Send **one genuine inquiry through their website form** at 7pm on a weekday, in the language
   their Google reviews suggest their customers write in, and time the reply. Be honest about it in
   the first message ("I sent your site a quote request on Tuesday evening to see what a customer
   sees — I haven't heard back yet"). Do this once per business, never repeatedly; it is a common
   sales tactic and some owners find it irritating, which is why the message must be short, kind,
   and offer something back (their own numbers).

This converts a generic pitch into a specific, verifiable observation about *their* business, which
is the personalization the benchmarks say matters most (Section 5). There is no benchmark for this
specific opener's reply rate. [Grade D — this document's recommendation.]

---

## 3. Outreach playbook

### 3.1 CASL first — the founder's own cold email must be compliant

CASL applies to any commercial electronic message sent to a Canadian address; **there is no
blanket B2B exemption.** Cold email to a business you have never dealt with is lawful only under
implied consent by **conspicuous publication**: the recipient's address is published (website,
directory, LinkedIn) with no statement declining unsolicited messages, and the message is relevant
to their business role. Every message must still identify the sender, give contact information, and
include a working unsubscribe mechanism. Penalties run to $10M per violation for businesses.
[Grade A for the rule — CRTC's own guidance; Grade C for the vendor summaries.]
https://crtc.gc.ca/eng/com500/guide.htm , https://crtc.gc.ca/eng/com500/faq500.htm ,
https://www.smarte.pro/blog/casl-compliance

Practical rules for this playbook:
- Only email addresses found on the business's own website, the LSO/CICC/RCDSO directories, HRAI/
  RenoMark listings, or a LinkedIn profile — and note where each came from in the tracking sheet.
- Every email: real name, "FollowUp, Toronto," a mailing address line, and "reply 'no' and I won't
  write again." No purchased lists. No mass-mail tool needed at this volume; send from Gmail.
- A message replying to *their* inbound inquiry (the product's instant acknowledgement) is a
  response to a request, not a solicitation; this is outside the cold-outreach concern. [Grade D —
  inference; not legal advice.]
- **Never send a test inquiry to a law firm that could be read as seeking legal advice** — use a
  plain "do you handle X, what is your consultation fee" question.

### 3.2 First message — cold email (Track B; also works for renovators)

Subject: `your website form — Tuesday 7:12pm`

> Hi [First name],
>
> I'm Sahil, I build a small tool in Toronto called FollowUp. On Tuesday at 7:12pm I sent a
> consultation request through [firm].ca in [Punjabi/English] to see what a prospective client sees.
> It's Thursday — no reply yet. Not a criticism; Clio's study found only 1 in 3 law firms answer a
> new-client email at all, and the ones that answer first usually win the file.
>
> FollowUp watches your inbox and website form, sends a one-line "we received your message, we'll
> reply by [time]" in the client's own language within a minute, and — the part nobody else does —
> flags the inquiries *you* forgot to answer and drafts the follow-up for you to approve. It sits
> next to Gmail/Outlook; nothing to migrate.
>
> Would you give me 15 minutes this week to run it live against your own inbox? If it doesn't catch
> at least one inquiry you'd have lost, I'll tell you so and leave you alone.
>
> Sahil [surname] · FollowUp · followupbase.io · [street address], Toronto
> Reply "no" and I won't write again.

Trades variant (email or FB DM after a group interaction): swap the middle paragraph for:

> The furnace quote request that lands in your inbox at 9pm while you're on a call gets answered by
> whoever texts back first. FollowUp answers it for you in a minute — in English, Punjabi, or
> whatever the customer wrote in — then nudges you on the ones that went quiet, and in the fall
> it can chase last year's furnace-check customers so you're not doing it from the truck.

Two follow-ups only (day 3 and day 8), each one line, each adding one new thing (a screenshot of the
"About to be lost" view; a one-sentence result from another pilot once one exists). Two to three
follow-ups generate up to 42% of replies (Section 5).

### 3.3 First message — Facebook group post (Track A; no product mention in the first two weeks)

Week 1–2: answer questions, share nothing. Week 3, one value post:

> Ran a small test: sent a quote request through 25 GTA HVAC/plumbing websites at 7pm on a weekday.
> [N] replied by the next morning, [N] within 24h, [N] never. Curious what you do with after-hours
> form leads — text back yourself, an answering service, or let it wait? (I build software in this
> space, so obviously biased — genuinely asking what works for a one-truck shop.)

Run the test for real so the numbers are true. The post is the ask; the DMs that follow are the
demos. Disclose the affiliation in the post, per group norms.

### 3.4 First message — LinkedIn (lawyers, RCICs, dentists)

Connection request with note (personalized requests are accepted ~45% vs 12–18% generic, Section 5):
"Hi [name] — Toronto founder, building a small tool that answers new-client emails in the client's
language and catches the ones that get forgotten. Read your post on [x]. Would value 15 minutes."
After acceptance: the same secret-shopper observation as 3.2, three sentences.

### 3.5 The 15-minute demo script

Pre-call (5 minutes of prep): have the prospect's website open; have a demo inbox connected; ask
them, in the invite, to send a test inquiry to the demo address from their phone during the call,
in the language their customers actually write in.

| Min | Beat | What is on screen | What to say |
|---|---|---|---|
| 0–2 | Their reality | Nothing yet | "Walk me through what happens when a new inquiry lands at 8pm." Write down their answer; it is the pilot's baseline. |
| 2–5 | The instant reply | Their phone → demo inbox | "Send it now, in Punjabi/Mandarin/Portuguese." Within a minute they see the acknowledgement on their phone, in that language, from the business's own address (PRD §6: fixed-template ack within the minute, in the lead's language, on the channel used). "That's the part your competitors don't do at 8pm." |
| 5–9 | The lead you forgot | Dashboard "About to be lost" | Show a seeded lead that was answered once and went quiet. Show the rescue score with its visible reason, the drafted follow-up, and the approve/send button. "Nobody watches whether *you* replied. This does. Default is it asks you first." |
| 9–12 | What it will not do | Settings: automation tier, stop-on-reply, audit trail | "Three guarantees: it never invents a fact that isn't in the thread; it stops the instant the customer replies; every automated send is logged with why. You can keep every lead on approve-first forever." (Consumers prefer humans 79/8 — this beat is the answer to that objection, `why-followup` §6c.) |
| 12–14 | The scoreboard | "What FollowUp saved you this week" report | "At the end of 30 days this shows you the inquiries it answered, the ones it rescued, and the ones you closed from those. That's the only number we'll judge it on." |
| 14–15 | The ask | Calendar | Section 3.6. |

Keep the sequence order. The instant reply is the emotional moment (it happens on *their* phone);
the forgotten-lead view is the differentiator; the guarantees are the trust close; the report is the
pilot's success criterion.

### 3.6 The ask — 30-day pilot, then paid

> "Let's run it for 30 days on your real inbox. I'll connect it with you today — it takes 10
> minutes. We agree now on what 'worked' means: [X] inquiries acknowledged inside a minute, at
> least [Y] follow-ups you'd have missed, and one booked job/consult that traces back to one of
> them. On day 30 we look at the report together and you either go to $29 a month or we switch it
> off — no hard feelings either way. Which day next week works to set it up?"

Mechanics that matter (from the evidence in Section 5 and the code):
- **Agree success criteria in writing before connecting** and put a date in both calendars. Free
  pilots without a deadline and a binary ask are "unlikely to convert" — the design-partner
  literature is blunt about it. [Grade C — BVP.]
- The product's built-in trial is **14 days, no card** (`src/lib/billing.ts`
  `TRIAL_PERIOD_DAYS = 14`). A 30-day pilot therefore needs the founder to extend `trial_end` on the
  Stripe subscription for pilot accounts, or a `PILOT30` coupon; decide once, do not improvise per
  customer.
- **Ask for the card at the day-21 check-in**, not day 30: card-on-file trials convert at roughly
  30–48% vs 9–18% without (Section 5). Framed as "so day 30 is automatic if the report is good; you
  can still cancel with one click."
- Weekly 10-minute check-in (day 7, 14, 21). Each is also a customer interview
  (`business-model-case` §11's missing validation step).
- Ask every converted pilot, on day 30, for **one introduction** to a peer in the same trade
  association or Facebook group. This is where customers 6–10 come from.

---

## 4. Pricing hypothesis for pilot → paid

**What the code says today (verified 2026-09-10):**
- Single flat plan, one Stripe price (`PLAN_PRICE_ID = process.env.STRIPE_PRICE_ID`,
  `src/lib/stripe.ts` line 20); currency is not visible in code.
- Every new subscription starts with a **14-day free trial, no card required**
  (`src/lib/billing.ts`: `TRIAL_PERIOD_DAYS = 14`; `BILLING_LOCKED_MESSAGE = "Start your free 14-day
  trial to unlock this — see Billing in Settings."`; `src/app/api/billing/checkout/route.ts` line 59
  `subscription_data: { trial_period_days: TRIAL_PERIOD_DAYS }`).
- The price shown to customers is **$29/mo**: landing page `src/app/page.tsx` line 385 and settings
  `src/app/(app)/settings/page.tsx` line 886 ("FollowUp — $29/month after a 14-day free trial").
- Prior research: $29 is underpriced against every comparable ($97–$600/mo) except QuoteIQ
  ($29.99); a $49–79 cohort test is recommended by research and **explicitly deferred by the CEO**
  ("hold off on pricing," `docs/PRD.md` §9).

**Hypothesis for the first 10, respecting the CEO's deferral:**

1. **Keep the list price at $29/mo for all pilots.** The first 10 are for proving the mechanism and
   the report, not for price discovery under pressure. Value math the founder can say out loud:
   $29/mo is $348/yr; one rescued furnace replacement ($3,500–$7,000), one bathroom ($17,000), one
   retainer, or one new dental patient ($5,000–$8,000 LTV) pays for 10–50 years of it. Sources in
   Section 1.4.
2. **Quote in CAD and add HST.** GTA owners read "$29" as CAD; if the Stripe price is USD, a
   surprise conversion on the first invoice is a churn event at exactly the fragile moment. Confirm
   the price currency in the Stripe dashboard before the first pilot; if USD, create a CAD price
   (~$39 CAD is the honest equivalent, but see point 1 — do not change the number without the CEO).
   [Grade D — this document's recommendation; Stripe supports multi-currency prices.]
3. **Founding-customer annual option at day 30: $290/yr (two months free), price locked 24 months.**
   This is not a price increase (the CEO's constraint), it pulls cash forward, cuts the first-year
   churn that the business-model case's bear scenario worries about, and gives the founder a
   testimonial-for-lock-in trade. [Grade D — hypothesis; annual-discount conversion for this
   segment is unmeasured.]
4. **Collect the willingness-to-pay data without changing the price.** At the day-30 review, with
   the recovered-revenue report on screen, ask two questions and record the answers verbatim: "What
   would you have paid for what you just saw?" and "At what price would you cancel?" Ten answers is
   the first real WTP dataset the corpus lacks (`business-model-case` §7 point 3), and is the input
   the CEO needs to un-defer the $49–79 test.
5. **Hypothesis to test, stated so it can fail:** ≥50% of pilots that reach day 30 with ≥1 rescued
   lead in the report convert at $29/mo; <25% conversion among pilots with ≥1 rescued lead means the
   problem is not price but trust or workflow, and the day-7/14/21 interview notes will say which.

---

## 5. Realistic numbers: conversations → demos → pilots → paying

### 5.1 Benchmarks used (all SMB/B2B SaaS, none FollowUp-specific)

| Step | Benchmark | Grade and source |
|---|---|---|
| Cold email reply rate | 3.4% average; **5.8% for campaigns under 50 recipients** vs 2.1% for large sends; 2–3 follow-ups produce up to 42% of replies | C — Mailshake/Instantly aggregated vendor data. https://mailshake.com/blog/cold-email-benchmarks-2026/ , https://instantly.ai/cold-email-benchmark-report-2026 |
| Cold email → meeting booked | 0.5–2.5% of emails sent; ~1–2 meetings per 100 for well-targeted SaaS | C — https://emailbison.com/blogs/cold-email-saas-startup , https://www.cleverly.co/blog/cold-email-benchmarks-by-industry |
| Cold call dial → meeting | 2–3% (≈1 meeting per 40 dials); connect rate 3–10%; ~8 attempts to reach a decision-maker | C — https://www.cleverly.co/blog/cold-calling-statistics , https://leadsatscale.com/insights/cold-calling-statistics-2025-what-10-million-calls-taught-us/ |
| LinkedIn | 28–30% connection acceptance (13.2M requests); ~45% with a personalized note; ~10% message reply | C — https://expandi.io/blog/linkedin-outreach-benchmarks-2026/ , https://overloop.com/blog/linkedin-outreach-benchmarks |
| Demo → closed-won, SMB | ~25–32% median; 40%+ top quartile | C — https://optif.ai/learn/questions/demo-to-close-conversion-rate/ , https://www.puppydog.io/blog/demo-to-close-rate-benchmark |
| SMB sales cycle | median 27–40 days from first contact to close (<$10K ACV) | C — https://saasdash.ai/blog/saas-sales-cycle-benchmarks-2026 |
| Trial → paid, no card (opt-in) | 8.9% (2026, 200 products) to 18.2% (2025) | B/C — ChartMogul report and First Page Sage, via snippets. https://chartmogul.com/reports/saas-conversion-report/ , https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/ |
| Trial → paid, card required (opt-out) | 31.4% (2026) to 48.8% (2025) | B/C — same sources |
| Free design-partner pilots | "unlikely to convert" without a hard deadline and binary ask | C — https://www.bvp.com/atlas/design-partners-the-pre-launch-edge-most-ai-founders-ignore |
| Warm/community/referral conversion | No reliable benchmark found; general founder-led guidance says the first ~20 customers come from network and personal outreach | C — `business-model-case` §10 |

Important caveat: these are benchmarks for *self-serve* trials and *sales-team* demos. A founder who
personally connects the inbox on the call, sets success criteria, and checks in weekly is running a
different, higher-touch motion; the honest expectation is "at least the benchmark," not "the
benchmark." Nothing here has been measured for FollowUp. [Grade D on any adjustment above benchmark.]

### 5.2 The model — 12 weeks, ~2 hours/day of founder outreach

Activity assumptions (per week): 40 hand-personalized cold emails to Track B and renovators (8/day;
the secret-shopper prep is what limits volume), 30 cold calls to trades with a visible slow
response, 25 LinkedIn requests, one in-person event or group interaction, two FB-group value posts a
month.

| Source | 12-week volume | Rate used | Demos |
|---|---|---|---|
| Cold email (small, personalized batches) | 480 emails | 1.5% meeting rate (between the 1–2.5% band) | ~7 |
| Cold calls (trades, Yelp/HomeStars slow responders) | 360 dials | 2.5% dial-to-meeting | ~9 |
| LinkedIn (law/RCIC/dental) | 300 requests → ~100 accepted → ~10 replies | ~30% of replies → demo | ~3 |
| In-person (BNI visits, OEL/HRAI chapters, GTApreneurs, MRVCBA/SABA, Small Business Forum) | ~12 touches | ~0.5 demo per touch (unbenchmarked) | ~6 |
| FB groups (value posts → DMs) | ~6 posts | ~0.5 demo per post (unbenchmarked) | ~3 |
| **Total** | | | **~28 demos** |

Then:
- Demo → pilot: assume **50%** (a free 30-day pilot with the founder doing setup is a much smaller
  ask than a purchase; benchmark demo→closed-won is 25–32%, so 50% to a *free pilot* is a moderate
  assumption, not an optimistic one). → **~14 pilots.**
- Pilot → paid: assume **35%** (card collected at day 21 puts this in the opt-out band of 31–48%;
  using the low end). → **~5 paying customers at week 12–14.**
- Conservative case (demo→pilot 40%, pilot→paid 20% — i.e. the opt-in trial band, which is what
  happens if the day-21 card ask is skipped): **~2 paying.**
- Target case (demo→pilot 60%, pilot→paid 45%, plus one referral demo per converted pilot):
  **~8–10 paying by week 16.**

**The honest read:** 5 paying customers by roughly week 12–14 is the median outcome of this plan
executed daily. Reaching 10 depends on the referral loop from the first 5 (each converted pilot
introducing one peer in the same association or group) and on the pilot→paid step, which is the
step the founder controls most — criteria in writing, weekly check-ins, card at day 21.

### 5.3 Leading indicators to track weekly (a one-page sheet)

Emails sent / replies / demos booked; dials / connects / demos; group posts / DMs; demos held /
pilots started; pilots with ≥1 rescued lead in the report by day 14; card on file by day 21;
paid at day 30; referrals asked / received; verbatim WTP answers. If the reply rate on cold email is
under 3% after 100 sends, the personalization is not landing — re-read the secret-shopper openers.
If pilots are not showing a rescued lead by day 14, the product has a problem this playbook cannot
fix, and that is the most valuable thing the pilot can tell the founder.

---

## 6. Pre-requisites and risks specific to an email-only pilot (from the repo)

1. **Google OAuth verification is still open** (`docs/PRD.md` §9, task #65). The corpus notes Google
   OAuth "still in Testing mode (7-day token expiry)" (`2026-09-07-why-followup-evidence-for-and-
   against.md` §6e). A Gmail-connected pilot that silently stops syncing on day 8 is a lost customer
   and a lost referral. Either complete verification before the first pilot, or run the first pilots
   on **Outlook** (shipped, poll-based, `docs/PRD.md` §6.1) and the **website widget**, or add the
   pilot's Google account as an OAuth test user and re-authorize weekly at the check-in (fragile;
   only as a stopgap). This is the single most important action before outreach starts.
2. **The non-English end-to-end test is still open** (task #63, `docs/PRD.md` Phase C). The demo in
   Section 3.5 is built on the in-language instant reply. Run the Punjabi, Mandarin and Portuguese
   paths end-to-end on a real Gmail before demoing them to a Brampton HVAC shop or a Markham RCIC.
3. **The 30-day pilot vs the 14-day trial** mismatch (Section 3.6) needs a one-time decision on the
   Stripe mechanism.
4. **CASL** applies to the founder's outreach, not just to the product (Section 3.1).
5. **Consumer preference for humans** (79% vs 8%, Grade B, on file) is the objection that will come
   up in every demo; the guarantees beat at minute 9–12 is the answer, and approve-first stays the
   default for every pilot.

---

## 7. What was not found (so nobody cites it later as if it were)

- No response-time or inquiry-volume data for immigration consultants specifically; no
  renovation-specific response study; no Ontario-specific HVAC maintenance-plan figures.
- No count of HVAC/plumbing/electrical *businesses* in the GTA (StatCan NAICS 238220 pages returned
  definitions only, not counts).
- No benchmark for in-person / trade-association conversion; those rows in 5.2 are assumptions.
- No measured reply rate for the "secret shopper" opener.
- Membership counts and rules for the named Facebook groups (visible only after joining).
- Nothing in this document was fetched from a source page directly; every external figure is a
  search-result snippet and should be re-verified before it appears on a landing page or in a deck.

---

## Sources checked (2026-09-10)

Internal:
- `research/market/2026-09-09-business-model-case.md` (§2, §7, §10)
- `research/market/2026-09-07-lead-rescue-gap-and-strategy.md`
- `research/market/2026-09-07-why-followup-evidence-for-and-against.md`
- `research/market/2026-09-08-product-direction-synthesis.md`
- `research/market/2026-09-08-pricing-validation-home-services-icp.md`
- `research/market/2026-09-08-pentest-vendor-options.md` (grading style)
- `research/customers/2026-09-05-icp-pain-and-trust-objections.md`
- `docs/PRD.md` (§6, §9), `src/lib/billing.ts`, `src/lib/stripe.ts`,
  `src/app/api/billing/checkout/route.ts`, `src/app/page.tsx`, `src/app/(app)/settings/page.tsx`

External (WebSearch snippets; none fetched):
- https://crtc.gc.ca/eng/com500/guide.htm
- https://crtc.gc.ca/eng/com500/faq500.htm
- https://www.smarte.pro/blog/casl-compliance
- https://www.clio.com/about/press/clios-legal-trends-report-reveals-law-firms-struggle-to-respond-to-client-inquiries/
- https://www.2civility.org/2024-clio-legal-trends-report-fixing-the-first-impression-problem-for-law-firms/
- https://www.apten.ai/blog/speed-to-lead-benchmarks-2026
- https://endigita.com/blog/lead-response-time-home-service-business-2026/
- https://customerflows.com/research/contractor-lead-response-time-study/
- https://leadferno.com/blog/research-website-contact-forms-and-lead-management-uncovering-costly-mistakes
- https://hvactrust.ca/furnace-prices-toronto-2026/
- https://www.custom-contracting.ca/resources/hvac-cost-ontario
- https://megacityhvac.com/blog/furnace-cost-toronto
- https://www.smartservice.com/blog/how-much-hvac-service-agreements
- https://www.constructioncostaccounting.com/post/hvac-maintenance-plans-pricing-profitability
- https://www.homestars.com/bathroom-sanitary/price-guides/bathroom-renovation-cost-toronto
- https://www.homestars.com/home-constructions-renovations/price-guides/renovation-costs-toronto
- https://www.homestars.com/heating/hvac-contractor-pros/toronto
- https://ca.trustpilot.com/review/homestars.com
- https://biz.yelp.com/support-center/article/How-is-the-response-time-and-response-rate-calculated-for-messaging-my-business
- https://www.getviva.ai/lead-response-time-statistics-dental-2026/
- https://www.resonateapp.com/resources/missed-calls-dental-practices-statistics
- https://dentx.ca/blog/dental-new-patient-cost/
- https://www.meetdandy.com/learning-center/articles/whats-the-lifetime-value-of-a-dental-patient/
- https://www.hrai.ca/ , https://www.hrai.ca/consumer
- https://www.oel.org/ , https://www.joinoel.ca/chapter-map/
- https://www.ecao.org/
- https://www.bildgta.ca/find-a-renomark-renovator/ , https://renomark.ca/
- https://www.facebook.com/groups/hvaccontractorsontario/
- https://www.facebook.com/groups/25281616931449856/
- https://www.facebook.com/groups/contractorsontario/
- https://www.facebook.com/groups/jobberentrepreneurshipgroup/
- https://www.facebook.com/groups/smallbusinessownersTO/
- https://www.facebook.com/groups/toronto.entrepreneurs.startups
- https://torontoconstructionnetwork.com/directory , https://www.gtatradesdaily.com/directory
- https://daltonluka.com/blog/google-my-business-categories
- https://www.shiftflow.app/playbook/best-google-business-profile-categories-for-hvac-contractors
- https://lsodirectory.lso.ca/en-US/
- https://stepstojustice.ca/steps/criminal-law/2-find-lawyer-or-paralegal/
- https://www.oba.org/Sections/Sole-Small-Firm-and-General-Practice
- https://www.canadianlawyermag.com/news/general/networking-for-the-solo-or-small-firm-practitioner/268047
- https://register.college-ic.ca/Public-Register-EN/Public-Register-EN/RCIC_Search.aspx
- https://ratemyrcic.ca/consultants/toronto
- https://www.capic.ca/
- https://www.rcdso.org/find-a-dentist , https://www.oda.ca/find-a-dentist/
- https://bnigtaplus.ca/en-CA/findachapter , https://bnicanada.ca/en-CA/find_a_chapter
- https://gtapreneurs.com/
- https://www.toronto.ca/business-economy/new-businesses-startups/small-business-startup-events/
- https://smesummit.ca/ , https://bot.com/Events
- https://mrvcba.ca , https://mcba-canada.com/ , https://sabatoronto.com/saba-events/ ,
  https://www.iccconline.org/
- https://redship.io/blog/reddit-self-promotion-rules
- https://mailshake.com/blog/cold-email-benchmarks-2026/
- https://instantly.ai/cold-email-benchmark-report-2026
- https://emailbison.com/blogs/cold-email-saas-startup
- https://www.cleverly.co/blog/cold-email-benchmarks-by-industry
- https://www.cleverly.co/blog/cold-calling-statistics
- https://leadsatscale.com/insights/cold-calling-statistics-2025-what-10-million-calls-taught-us/
- https://expandi.io/blog/linkedin-outreach-benchmarks-2026/
- https://overloop.com/blog/linkedin-outreach-benchmarks
- https://optif.ai/learn/questions/demo-to-close-conversion-rate/
- https://www.puppydog.io/blog/demo-to-close-rate-benchmark
- https://saasdash.ai/blog/saas-sales-cycle-benchmarks-2026
- https://chartmogul.com/reports/saas-conversion-report/
- https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/
- https://www.bvp.com/atlas/design-partners-the-pre-launch-edge-most-ai-founders-ignore
