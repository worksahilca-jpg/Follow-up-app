# Why FollowUp should exist — the evidence, for and against

**Date:** 2026-09-07. **Asked by the CEO:** "convince me more and do proper research."
This is evidence, not a pep talk: every claim carries a source and a confidence grade.
Help-center and some news domains are egress-blocked from the build sandbox, so several
figures come from aggregator pages that cite the primary study; graded accordingly.

**Grades.** A = primary source or large sample. B = credible secondary citing a named
primary. C = vendor-published aggregate, plausible but self-interested.

## Verdict first

The direction holds, on evidence rather than belief:

1. The problem is measured and large — most businesses answer leads in days or never.
2. The customer FollowUp is built for (small, no CRM, inbox-and-phone, often
   multilingual) is the majority of small businesses, not a niche.
3. The money is proven: owners already pay $450–$5,800 a month for the human or the
   suite that does this job; FollowUp replaces it at a fraction.
4. The gap is real: every competitor automates the lead; nobody watches the human.
5. Speed is the single highest-leverage lever, which is exactly what Phase A targets.

And three things that could kill it, stated plainly in section 6: Meta giving away an
inbound AI agent on WhatsApp/Instagram, consumers' strong preference for humans, and
the current zero-test, single-developer state of the codebase.

## 1. The problem is measured, not assumed

| Finding | Figure | Grade |
|---|---|---|
| B2B teams that never responded to a test inbound lead (1,000 companies) | 63.5% | B |
| Average B2B lead response time | 29–47 hours | B |
| Companies responding within 5 minutes | 23% | B |
| Real estate agents' average response time (NAR) | 15 hours | B |
| Home services: most common response time | 1 day (37% of firms) | C |
| Close rate when contacted < 5 min vs > 24 h | 32% vs 12% (2.6×) | B |
| Calls to small businesses that go unanswered (411 Locals, 85 businesses, 58 industries) | 62% | B |
| Callers who reach voicemail and hang up without a message | ~80% | C |
| Missed callers who never call back | up to 85% | C |
| Estimated annual revenue lost to missed calls per small business | ~$126,000 | C (vendor estimate) |

Read together: the lead a business paid for usually waits a day, often forever, and
the close rate falls by more than half while it waits. That is the "no / late" in
Point 1 of the main goal, quantified. Sources: [Apten speed-to-lead benchmarks 2026](https://www.apten.ai/blog/speed-to-lead-benchmarks-2026),
[Workato 114-company study](https://www.workato.com/the-connector/lead-response-time-study/),
[Outsales lead response statistics](https://outsales.ai/blog/lead-response-time-statistics),
[GreetNow 2026 statistics](https://greetnow.com/blog/lead-response-time-statistics),
[Rework 5-minute rule](https://resources.rework.com/libraries/lead-management/lead-response-time),
[getaira missed-call statistics](https://www.getaira.io/blog/missed-business-calls-statistics),
[Sawy missed-call statistics](https://getsawy.com/statistics/missed-call-statistics),
[Phone2 cost of missed calls](https://www.phone2.io/post/true-cost-of-missed-calls).

## 2. The customer is the majority, not a niche

| Finding | Figure | Grade |
|---|---|---|
| Businesses with < 10 employees using any CRM | 50% | B |
| Businesses with 11+ employees using a CRM | 91% | B |
| Small businesses overall using a CRM (Freshworks / Capterra 2025) | 71% / 74% | B |
| Small businesses using AI (Q3 2025); of those, planning to spend more | 37%; 71% | B |
| Canada: share of employer businesses owned by immigrants | 32–33% | A (StatCan) |
| Canada: immigrant-owned share of restaurants / trucking / dentists' offices | 53% / 56% / 43% | A (StatCan) |
| US: share of businesses owned by immigrants (SBA) | ~20% | A |
| US: new businesses founded by immigrants (Gusto 2024) | 17–18% | B |

Two things follow. First, half of the smallest businesses have no CRM to "integrate
with," so a product that works straight from Gmail and the phone number — which is
what FollowUp is — matches the customer; a CRM-connector product would not. Second,
"every language" is not a nice-to-have: a third of Canadian employers and a fifth of
US business owners are immigrants, concentrated in exactly the trades that live on
inbound calls and messages. The first outside tester (a Punjabi-speaking realtor)
asked for this unprompted. Sources: [SchedulingKit](https://schedulingkit.com/statistics/crm-statistics),
[Wave Connect](https://wavecnct.com/blogs/crm-statistics), [DemandSage](https://www.demandsage.com/crm-statistics/),
[Statistics Canada, immigrant-owned businesses](https://www150.statcan.gc.ca/n1/pub/11-621-m/11-621-m2022021-eng.htm),
[BDC on immigrant entrepreneurship](https://www.bdc.ca/en/articles-tools/blog/immigrant-entrepreneurship-taking-centre-stage-canada),
[American Immigration Council](https://www.americanimmigrationcouncil.org/about-immigration/entrepreneurship/),
[Gusto 2024 report](https://gusto.com/resources/gusto-insights/2024-immigrant-entrepreneur-report),
[SurveyMonkey AI statistics](https://www.surveymonkey.com/curiosity/ai-workplace-statistics/).

## 3. The money is already being spent

What an owner pays today for someone or something to do the following up:

| Alternative | Cost per month | Grade |
|---|---|---|
| Real estate inside sales agent, US average ($69,398/yr) | ~$5,800 | B |
| ISA base salary only | $2,000–2,500 | B |
| Dedicated virtual assistant (agency, 40 h/week) | $1,300–3,200 | B |
| Podium (Core $399 + AI $99–399 + fees; annual contract) | $450–800 real | B |
| Birdeye, per location | from $299 | B |
| Sierra Interactive + Lead Engage AI | $299–599 + $199 | B |
| HighLevel AI Employee (on top of the platform fee) | $50–97 | B |
| Structurely's marketed return | "21× ROI" | C (vendor) |

Willingness to pay for this job is proven at $300–$6,000 a month. A horizontal
product at $49–149 a month is a 5–40× cheaper substitute for the human and a 3–5×
cheaper substitute for the suite. What is **not** proven is FollowUp's own price:
that needs the recovered-leads report (so an owner can see the return) and a
willingness-to-pay test with real users. Sources: [ZipRecruiter ISA salary](https://www.ziprecruiter.com/Salaries/Real-Estate-Inside-Sales-Agent-Salary),
[Smart Sales Coaching on ISA pay](https://smartsalescoaching.com/how-to-pay-an-inside-sales-agent/),
[MyOutDesk VA cost](https://www.myoutdesk.com/blog/virtual-assistant-cost/),
[Astucia on Podium pricing](https://astucia.io/blog/podium-pricing-2026-what-smbs-actually-pay),
[Recoverly missed-call tools](https://recoverlyhq.com/blog/best-missed-call-text-back-software-2026),
[NextPhone AI receptionist pricing](https://www.getnextphone.com/blog/ai-receptionist-pricing-guide).

## 4. The gap is real (from the 2026-09-07 competitor pass)

Every competitor automates the *lead*. None watches the *human* by default: Follow Up
Boss reassigns after a recipe is configured, HighLevel escalates only inside a
workflow the owner builds, Lofty tells you when asked, Sierra does it inside its own
real-estate-only bundle. No product has a rescue score or a report of revenue
recovered from leads a human had abandoned. Details and sources in
`research/market/2026-09-07-lead-rescue-gap-and-strategy.md`.

## 5. Speed is the lever, and it is the cheapest one to pull

Contact inside five minutes closes at 2.6× the rate of contact after a day (section
1). Today a new email lead can wait 10 minutes to be seen and then waits for the
owner's approval. Phase A (instant safe acknowledgement, Gmail push, hourly silence
check) attacks the largest measured effect in this whole document with the least
new surface area. That ordering is now evidence-backed, not taste.

## 6. What could kill it — the honest part

**6a. Meta is giving away an inbound AI agent on WhatsApp, Instagram and Messenger.**
Meta Business Agent went global on 2026-06-03, free for now with paid tiers to
follow, already used by over a million businesses. It answers questions, recommends
products, books appointments, qualifies leads and hands to a human. Rule 4 in
`PRODUCT_DIRECTION.md` says don't build what a platform is about to give away, and
"auto-reply to your Instagram DMs" is now exactly that. **What it does not do,
per Meta's own partners:** it is inbound-only — no proactive follow-up when a lead
goes silent, no outbound campaigns or reminders, no email, no phone calls, no team
inbox, no CRM connection in the self-serve tier. **Implication:** on Meta channels
FollowUp should stop competing on the first reply and treat Meta Business Agent as a
*source* — capture what it handled, follow up on what it dropped, keep the one view
across email, calls, texts and DMs that Meta will never have. Add this to Phase C.
Sources: [TechCrunch, 2026-06-03](https://techcrunch.com/2026/06/03/metas-ai-agent-for-whatsapp-business-is-now-available-globally/),
[Meta newsroom](https://about.fb.com/news/2026/06/meta-business-agent/),
[Wati on limitations](https://www.wati.io/en/blog/meta-business-agent/),
[Omnichat explainer](https://blog.omnichat.ai/meta-business-agent-platform-explained-features-pricing-and-what-the-2026-whatsapp-changes-mean-for-your-business/). Grade B.

**6b. Google already nudges, and could act.** Gmail's follow-up nudges resurface a
sent email with no reply after three days, and Gemini drafts replies inside Gmail.
Today Google *reminds*; it does not *do*. If Gmail ever auto-follows-up, FollowUp's
email channel loses its first-reply value the same way. Defense is the same as 6a:
act rather than remind, across every channel, with the human-neglect trigger and the
proof report Google has no reason to build. Sources: [Agentys Gmail Gemini review](https://www.agentys.io/en/blog/gmail-gemini-review),
[Google Workspace updates 2026](https://workspaceupdates.googleblog.com/2026/). Grade B.

**6c. People prefer humans — strongly.** 79% of Americans strongly prefer a human
over an AI agent in customer service; only 8% prefer AI; 75% report frustration with
AI customer service; resolution matters more than speed. This is the best argument
against "AI replies to your leads," and it must shape the product: messages in the
owner's own voice (voice samples already exist), never an invented fact (shipped
2026-09-07), fast handoff to the human when the lead is real, and disclosure where
the law requires it. The counter-argument the data also supports: the alternative to
an AI reply is not a human reply — it is a 47-hour silence or nothing (section 1),
and among those who do prefer AI, availability and speed are the reasons. A short,
honest, human-sounding acknowledgement plus a real human within the hour beats both.
Sources: [SurveyMonkey customer service statistics](https://www.surveymonkey.com/curiosity/customer-service-statistics/),
[PR Newswire, 75% frustrated](https://www.prnewswire.com/news-releases/75-of-consumers-left-frustrated-by-ai-customer-service-302644290.html),
[CX Dive on human connection](https://www.customerexperiencedive.com/news/consumers-human-connection-speed-customer-service/743364/),
[Forbes, 2026-04-20](https://www.forbes.com/sites/terdawn-deboe/2026/04/20/customers-hate-your-ai-chatbot-small-businesses-should-listen/). Grade B.

**6d. Compliance.** CASL, PIPEDA, TCPA and A2P 10DLC are all real constraints on a
product that messages on an owner's behalf; covered in earlier research, and the
per-lead consent record is Phase D. Not a reason to stop; a reason not to skip Phase D.

**6e. Execution.** Zero automated tests, one developer, Google OAuth still in Testing
mode (7-day token expiry), Twilio still on trial, two testers. None of the market
evidence above matters if a real customer's first week breaks. Phase A's test suite
and Phase C's unblocks are the answer.

## 7. What the evidence changes in the plan

- Phase A stays first and unchanged: speed is the largest measured effect.
- Phase C gains "Meta Business Agent as a source": capture its handled conversations,
  follow up on what it drops, never compete with it on the first DM reply.
- The non-English end-to-end test moves up inside Phase C: a third of the Canadian
  customer base is immigrant-owned.
- Phase B's recovered-leads report is also the willingness-to-pay experiment: an
  owner who can see "FollowUp saved these" can be asked what it is worth.
- Voice fidelity (sounding like the owner) is promoted from nice-to-have to a trust
  guarantee, because of 6c.

## 8. Confidence scorecard

| Claim | Confidence |
|---|---|
| Businesses respond late or never, and it costs them | High (many independent studies agree) |
| The no-CRM, inbox-and-phone small business is the majority | High |
| Multilingual is a wedge, not a nicety | High for Canada, medium for US |
| Owners already pay hundreds to thousands a month for this job | High |
| FollowUp's own price point | Unproven — needs the report + a test |
| Nobody watches the human by default | Medium-high (snippet-sourced, help centers blocked) |
| Meta Business Agent is inbound-only today | Medium (partner sources, not Meta's own doc) |
| Consumers prefer humans | High — design constraint, not a veto |
