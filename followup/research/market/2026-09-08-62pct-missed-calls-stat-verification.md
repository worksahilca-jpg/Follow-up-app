# Verifying the "62% of calls to small businesses go unanswered" stat (411 Locals)

Checked: 2026-09-08. This is a spot-check of one row in
`research/market/2026-09-07-why-followup-evidence-for-and-against.md`'s evidence table: "Calls to
small businesses that go unanswered (411 Locals, 85 businesses, 58 industries) — 62% — grade B."
That doc's grading convention: B = credible secondary citing a named primary. This pass tries to
find the actual primary source rather than more secondary citations of it, the same way the $126k
figure was chased down in `research/market/2026-09-08-missed-calls-126k-stat-verification.md`. **Not
editing the original evidence doc — this is a standalone note per the task instructions.**

**WebFetch is blocked in this sandbox; findings below are WebSearch-snippet-sourced, not a direct
read of 411 Locals' own page. Grade accordingly.**

## Headline finding: the primary source exists and the number checks out arithmetically, but it is older and thinner than how it's typically cited — including possibly in FollowUp's own evidence doc

**The primary source is findable and is exactly what the evidence doc's citation says: 411 Locals,
85 businesses, 58 industries.** It's 411 Locals' own page,
`https://411locals.us/small-business-owners-dont-answer-62-of-phone-calls/` — a **direct, first-party
primary source**, not a secondary citation of one. **[This upgrades the sourcing situation: the
evidence doc's own citation format ("411 Locals, 85 businesses, 58 industries") already correctly
names the primary, so whoever wrote that row apparently already found the actual source — good
sign for the original doc's care — but it was graded B ("credible secondary citing a named
primary") rather than as a primary itself, which suggests the original pass cited it secondhand via
a roundup rather than confirming the 411locals.us page directly.]**

**The breakdown behind the headline number, per multiple independent-looking search-result
summaries of the same 411 Locals page:** of calls monitored across the 85 businesses over 30 days,
37.8% were answered live, 37.8% went to voicemail, and 24.3% got no response of any kind (no answer,
no voicemail option). **37.8% (voicemail) + 24.3% (no response) = 62.1% ≈ "62%."** The arithmetic is
internally consistent across every source that quoted the three-way breakdown, which is reassuring —
it isn't a number that's been quietly altered in transmission. **[Grade C — several
secondary/aggregator sources (OnCrew, a Medium post, majleads.com) independently reproduce the same
three numbers, which is corroboration of *what the study reported*, but all are still relaying it
from the same one 411 Locals page rather than being independent re-measurements.]**

**The important correction: this is a 2016 study, not a recent one — and it appears to be
routinely mis-dated to 2023/2024 across the industry, a mistake FollowUp's own evidence doc should
double check it hasn't made.** Two independent search-result summaries (one referencing OnCrew's
"Verified Numbers, Real Sources" fact-check page, another referencing majleads.com's "We
Fact-Checked the 5 Statistics Every AI-Receptionist Vendor Quotes") both state plainly that the
underlying 411 Locals study was **published January 2016**, a single 30-day sample, and that it is
"routinely misdated to 2023 or 2024" by the many vendor blogs that cite it. One search snippet even
surfaced a conflicting claim that a fresh "2024 study" reproduced the identical 37.8/37.8/24.3
breakdown — which, given the numbers are exactly identical down to one decimal place, is almost
certainly the same 2016 study being re-published or re-dated by a secondary source, not a genuine
new study. **[Grade C — the "it's actually 2016, and mis-dated everywhere" claim itself rests on two
aggregator fact-check pages rather than a direct read of the 411 Locals page's own timestamp, so
this correction is itself unverified at the primary-source level — but two independent fact-check
sources agreeing on the same specific date (January 2016) is more convincing than the single-source
"2024" framing that most vendor content uses.]**

**Methodology and independence caveats, consistent with the original evidence doc's own posture on
other rows:** 411 Locals is a local-SEO marketing agency, not a research firm or neutral third
party — the study is vendor-published content marketing, with no disclosed sampling method
(how the 85 businesses were selected/recruited is not stated in any source found), no confidence
interval, and a small, non-random-looking sample (85 businesses is thin for a claim this widely
generalized across "small businesses"). MAJ Leads' own fact-check article states this directly: "the
honest way to cite this number is as narrow as the study that produced it... it is not an ongoing
industry benchmark."

## Recommendation for the evidence doc (not applied here, per instructions — flagging for whoever next edits it)

1. **The grade should probably be reconsidered.** As a self-published, methodology-undisclosed,
   decade-old vendor study being used to characterize a *current* market condition, this leans closer
   to the evidence doc's own definition of C ("vendor-published/self-interested") than B ("credible
   secondary citing a named primary") — especially once "credible secondary" is understood to mean
   an independent journalist/analyst characterizing someone else's primary data, which isn't quite
   what's happening when the "secondary" source is itself paraphrasing the vendor's own numbers.
2. **If kept as evidence, the citation should say "2016" explicitly**, not leave the date implicit
   or (worse) let a reader assume it's recent — the number itself is fine to keep (the arithmetic is
   sound and it's the only real study anyone points to for this exact figure), but stating it as
   current-market evidence without the date is the same kind of quiet staleness risk this whole
   research function exists to catch.
3. **Worth one more check before finalizing**: whether FollowUp's own evidence doc's row already
   states the year anywhere nearby that this pass didn't quote — recommend the next editor open
   `research/market/2026-09-07-why-followup-evidence-for-and-against.md` and confirm.

Sources checked 2026-09-08 (all via WebSearch; none WebFetch-verified):
- https://411locals.us/small-business-owners-dont-answer-62-of-phone-calls/ (identified as the primary source; not fetched)
- https://oncrew.ai/resources/missed-call-statistics
- https://www.majleads.com/blog/ai-receptionist-statistics-fact-check
- https://medium.com/@jtgrahamm/the-silent-profit-killer-why-62-of-your-business-calls-go-unanswered-and-what-its-costing-you-7619af72cce4
- https://www.getaira.io/blog/missed-business-calls-statistics
