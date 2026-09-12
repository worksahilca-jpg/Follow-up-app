# Research log

Every design research pass, dated, with its question and its conclusion.

**The log's job is to prevent two failures:** researching the same question twice, and
citing a "finding" nobody can trace back to a source.

## Format

```
## YYYY-MM-DD — [Question being answered]
**Triggered by:** [the design task or decision that needed this]
**Question:** [one specific, answerable question]
**Method:** [what was actually done — sources consulted, products examined, docs read]
**Findings:** [what was learned, with sources]
**Confidence:** [high | medium | low — and what would raise it]
**Conclusion / what changes because of this:** [the design implication, or "nothing"]
**Written up in:** [path to the detailed file, if any]
```

**"Nothing changes because of this" is a valid and honest conclusion.** Research that
confirms the current approach is useful and should be logged as such — it stops the
question being reopened.

## Rules

1. **Research answers a question.** If you can't write the question in one sentence,
   you're browsing, not researching. (`workflows/research-workflow.md`)
2. **Cite sources.** A finding with no source is an opinion with a footnote.
3. **State confidence honestly.** "Three products do X" is weak evidence. "Three products
   do X and a usability study found Y" is stronger. Say which you have.
4. **Distinguish observed from inferred.** "Linear's list has one action per row" is
   observed. "Because they found more actions confused users" is a guess — mark it.
5. **Never invent research.** No fabricated statistics, no imagined user quotes, no
   citations to studies you haven't read. A design brain that contains one fabricated
   finding cannot be trusted on any finding.
6. **Reuse the repo's existing research first.** `followup/research/` already holds real,
   dated findings on customers, competitors, and integrations — including
   `customers/2026-09-05-icp-pain-and-trust-objections.md`, which is directly relevant to
   onboarding and empty-state design. Read before researching.

---

## Log

## 2026-09-12 — What does the existing repo research imply for design?

**Triggered by:** Founder asked for the first research pass. `followup/research/` held 19
dated files (~3,800 lines) of real customer, market, and competitor findings that had never
been read through a design lens.
**Question:** What in FollowUp's existing research changes how the product should be
designed?
**Method:** Read `customers/2026-09-05-icp-pain-and-trust-objections.md` in full; scanned
the 12 `market/` files for design-relevant findings. **No new external research** — this is
a re-reading of work already in the repo.
**Findings:** Six, written up in
`ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`:

1. **Approval-first is validated** (77% of consumers want human approval before an agent
   acts; 1 in 10 accept full independence). The five-part trust checklist in that study is
   usable directly as a design checklist.
2. **The fear is "my business will feel fake", not "the AI will be wrong"** — 65.5% of
   owners worry AI makes them seem less authentic; 79% of customers prefer a human. This is
   the sharpest finding: it turns brand principle 3 from a taste position into an
   evidence-backed one.
3. **Speed is the product, and the user is on a phone** — 62% missed-call rate in home
   services, 86% of voicemail callers hang up, 391% conversion lift from a 1-minute
   callback. Settles mobile-first for the core loop.
4. **Push, not pull** — the dashboard opens on "about to be lost", each lead carrying a
   rescue score *with its reason*. Resolves the table-vs-list question in favor of a
   prioritized list.
5. **Complexity is the category's failure mode** — competitors are repeatedly marked down
   for setup burden and learning curve by exactly this ICP.
6. **SMS consent is a design surface** — TCPA liability sits with the business, so consent
   state belongs where sending happens, not only in settings.

**Confidence:** **Medium, and capped there deliberately.** The underlying customer research
states that WebFetch was blocked in its sandbox, so every figure is a search-snippet
citation rather than a fetched source; its author flagged some quotes as possibly
vendor-influenced and several percentages as third-party aggregations. Strong enough to
steer design; **not strong enough to put on a screen.** No number from this pass may appear
in product copy or marketing without a direct fetch first. Raising confidence needs primary
sources, and ideally a FollowUp user — nothing here comes from one.

**Conclusion / what changes:** Four things in the design brain now have evidence behind
them rather than conviction (principles 3, 4, 6, 7); two open questions are resolved
(mobile-first for the core loop; prioritized list over table); and the **approve-a-draft
screen is now the highest-priority screen to design**, ahead of the dashboard — it is where
the trust this research describes is either earned or lost.

**Written up in:** `ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`

---


**Known, already-available inputs that have not yet been mined for design implications:**
- `followup/research/customers/2026-09-05-icp-pain-and-trust-objections.md` — ICP pain
  and, importantly, **trust objections**, which are a design problem as much as a copy one
- `followup/research/market/2026-09-05-competitor-feature-gaps.md`
- `followup/research/market/2026-09-07-lead-rescue-gap-and-strategy.md`
- `followup/research/market/2026-09-06-realtor-tool-landscape.md` — names real competitors
  (Structurely, Ylopo) worth examining as UX references
- `followup/PRODUCT_DIRECTION.md` — the canonical product statement

A first useful research pass would be reading these through a design lens and extracting
the UX implications. That has not been done; don't cite it as though it has.
