# Sourcing a real non-English test lead for task #63 — practical options

Checked: 2026-09-08. Task #63 (real non-English lead end-to-end test) has been blocked across the
whole project on "no real multilingual lead available." This pass researches concrete, low-cost ways
an early-stage startup actually gets this kind of coverage, and gives a specific recommendation
rather than a menu.

Per `research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md` and
`PRODUCT_DIRECTION.md`'s "Where we are right now" section: "No real non-English lead has been tested
end to end yet" is currently the single largest gap under Point 3 ("every language, every
platform"). This blocks confidence in `generateFollowUpMessage`'s non-English drafts, voicemail
transcription, and the live voice agent for anyone but an English speaker.

## What's actually needed, scoped down

The blocker as stated ("a real multilingual lead") is bigger than what's needed to unblock the
task. A full inbound "real" lead isn't required — what closes the gap is: **a native speaker
sending FollowUp a handful of realistic messages through a real channel (SMS/WhatsApp/Instagram DM),
in their own natural phrasing, and then judging whether FollowUp's AI-drafted replies read as
something a native speaker would actually send** — not translated-sounding, not tone-deaf, no
dropped idioms. That's a few hours of one person's time per language, not a real customer.

## Options found, cheapest/fastest first

**1. Fiverr — one-off native-speaker gigs, cheapest and fastest.** Gigs explicitly offering native
review/translation checking exist at $5–$30 per short task; broader "QA & review" services run
$100–$700 for larger scopes, but a single-conversation review doesn't need that tier. **[Grade C —
Fiverr's own category/gig listings, self-reported pricing by individual freelancers, not
independently audited.]** Practical use: hire a native Spanish speaker (see recommendation below)
for a $15–$40 gig scoped as "text/WhatsApp this number 5–6 times as if you were a real customer
inquiring about [home service], then tell me in a short written note whether each reply sounds
natural or awkward, and flag anything a native speaker wouldn't say." This is exactly the shape of
gig the platform already supports (translation-review and native-language-check gigs are a listed
subcategory).
Sources: https://www.fiverr.com/categories/writing-translation/quality-translation-services ,
https://www.fiverr.com/categories/programming-tech/qa-services

**2. Upwork — better for a slightly more structured one-off project or if bilingual QA experience
matters.** Upwork has both language-tutoring freelancers ($35–$60/hr) and dedicated
localization/QA-testing freelancers who explicitly offer product/app testing plus review. A fixed-
price micro-project ("test this SMS/WhatsApp flow in Spanish, 30–60 minutes, write up impressions")
posted with a set budget ($40–$100) rather than hourly is the natural format — several real Upwork
job posts of exactly this shape exist already (e.g. "Language Learners Needed – Quick App Test").
**[Grade C — Upwork's own hire-a-freelancer marketing pages and one live job posting found by
search; pricing is freelancer-set, not platform-guaranteed.]**
Sources: https://www.upwork.com/hire/localization-freelancers/ ,
https://www.upwork.com/hire/spanish-translators-writers/

**3. Rev.com and similar transcription/translation-QA vendors — better fit for the voicemail-
transcription half of the gap than the chat-draft half.** Rev's human transcription/translation
services run roughly $1.99/audio-minute (transcription) up to $5–$12/minute for translated
captioning, with human review built into the paid tier. **[Grade C — vendor and third-party review
sites, self-reported pricing.]** This is a better fit for validating the *voicemail transcription*
half of Point 3 (leave a Spanish-language voicemail, get it transcribed, check whether Twilio's
transcription — already flagged English-only in the prior voice-AI doc — mangles it, and whether a
Twilio Voice Intelligence multi-language alternative does better) than for judging chat-draft
naturalness, which needs a live conversational tester, not a transcription vendor.
Sources: https://sonix.ai/resources/rev-review-pricing/ , https://sonix.ai/resources/rev-pricing/

**4. A bilingual team member's own test — cheapest, fastest, but weakest evidence.** If anyone on
the team (or an easily-reached friend/advisor) is a native or near-native speaker of a target
language, having them run the exact same DM/SMS flow costs nothing and can happen today. The
tradeoff: a team member already knows what FollowUp is trying to say, so their judgment of
"does this sound natural" is contaminated by familiarity with the English source — useful as a fast
first pass and to catch obvious breakage, not a substitute for a genuinely blind native-speaker
review from options 1–2.

**5. Beta-tester / multilingual-small-business communities — higher effort, not recommended as the
first move.** Communities like r/smallbusiness, local Chambers of Commerce serving Spanish-speaking
business owners, or beta-testing marketplaces (BetaTesting.com, UserTesting's multilingual panel)
could recruit an actual target-ICP bilingual small-business owner, which would be higher-fidelity
than a freelancer with no home-services context. But this is slower (recruiting takes days-to-weeks
vs. a same-day Fiverr gig) and not obviously worth the wait just to unblock a stuck task — better
saved for a later, deeper "does this actually work for real Spanish-speaking customers" study once
the basic naturalness bar is already cleared by a cheap freelancer test.

## Recommendation

**Do this now, cheapest path first:** Post one Fiverr gig (or ask in a freelancer Slack/Discord if
one exists) for a native Spanish speaker — Spanish is the highest-value first language for
FollowUp's US home-services/realtor ICP by a wide margin, more common among small-business leads
than any other non-English language — scoped narrowly:

1. Give the tester a real FollowUp test number/account (SMS and/or WhatsApp, whichever channel is
   easiest to stand up a sandbox for) and ask them to send 4–6 messages as if they were a real
   customer inquiring about a service, in their own natural Spanish (not translated from English
   prompts — that defeats the point).
2. Capture FollowUp's AI-drafted (or auto-sent, if in that mode) replies for each turn.
3. Have the same tester rate each reply 1–5 on "does this read like something a native speaker
   would actually send" and flag anything that reads as machine-translated, overly formal/stiff,
   or grammatically off, with a one-line note per flagged reply.
4. Budget: $20–$50, same-day-to-48-hour turnaround. Repeat for a second language (Mandarin or
   Vietnamese are the next most common non-English languages among US small-business customers,
   depending on region) once the Spanish pass is done and any obvious bugs it surfaces are fixed —
   don't parallelize languages before the first pass validates the approach itself.
5. Separately, if voicemail transcription is in scope for task #63 too, do a second tiny Rev.com
   (or similar) one-off: leave one Spanish-language test voicemail through the real Twilio number
   and check what the transcript looks like, since the prior voice-AI research doc already flagged
   Twilio's built-in transcription as English-only — this is a fast way to confirm that's still
   live-broken today, separate from the chat-draft naturalness question.

This closes the task's actual blocker (a genuine native-speaker judgment call, not a "real"
customer) for under $100 and inside a few days, rather than waiting indefinitely for an organic
non-English lead to show up.

Sources checked 2026-09-08 (all via WebSearch; none WebFetch-verified):
- https://www.fiverr.com/categories/writing-translation/quality-translation-services
- https://www.fiverr.com/categories/programming-tech/qa-services
- https://www.upwork.com/hire/localization-freelancers/
- https://www.upwork.com/hire/spanish-translators-writers/
- https://www.upwork.com/freelance-jobs/apply/Language-Learners-All-Levels-Needed-Quick-App-Test-iPhone-Required-Hour-Bonus_~022046442379794375317/
- https://sonix.ai/resources/rev-review-pricing/
- https://sonix.ai/resources/rev-pricing/
- https://viston.tech/how-to-create-a-multilingual-cx-strategy-for-your-startup-in-2026/ (pilot-with-1-2-languages framing)
