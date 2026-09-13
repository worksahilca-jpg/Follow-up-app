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

## 2026-09-13 — What do inbound leads actually say, and what does that mean for scoring/drafting?

**Triggered by:** product-narrative-agent's customer/copy research charter — how real leads
(real estate first, small-service-business second) phrase first contact across channels,
and what that implies for the AI classifier and `suggestedMessage` drafting quality.
**Question:** What do inbound leads actually type/say in their first message and replies,
what intent signals show up in their wording, and what causes a genuinely-still-engaged lead
to get mislabeled cold?
**Method:** Checked existing repo research first (2026-09-05 ICP/trust file, the 2026-09-12
UX-patterns file above, `PRODUCT_DIRECTION.md`) — none of it covered lead *message content*
specifically. New WebSearch research conducted; WebFetch confirmed blocked network-wide
again this session (six direct-fetch attempts, all `EGRESS_BLOCKED`), so every citation is a
search-snippet, not a fetched page.
**Findings:** Six, written up in full in
`followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`:
1. The three most common inbound DM/text questions are almost entirely factual — "is it
   still available?", "when can I see it?", "what's the price?" — message length/politeness
   is a weak intent signal on its own.
2. Real intent signals are specificity + readiness-to-act (a named address/unit/service, a
   stated timeline, financing/budget language, offering a specific time slot) — not
   enthusiasm or tone.
3. A lead going silent is more often comparison-shopping than actually disinterested;
   one source puts "lost" leads at ~70% lost purely because follow-up stopped, not because
   interest did (single-sourced, not cross-checked — treat cautiously).
4. Terse/short replies from an already-engaged lead are a documented false-cold trap,
   distinct from silence — only an explicit negative statement should score a lead down.
5. A good automated first response answers the literal question first, then asks exactly
   one qualifying question — never several stacked together. A concrete, checkable
   structural bar for draft quality.
6. Instagram DM is reportedly the top lead-generation channel for realtors — NAR's 2025
   REALTORS® Technology Survey (primary-sourced, higher confidence than the rest of this
   pass) puts social media at 39% vs. CRM 23% and MLS 17% — and the least automated at the
   contact-creation step. A real Meta 24-hour DM messaging-window constraint was also
   surfaced and flagged for independent verification against Meta's own docs.
**Confidence:** Medium overall (search-snippet sourced per this repo's standing convention,
see `decisions/design-decisions.md` D-006), except Finding 6's NAR percentages, which trace
to NAR's own survey PDF and press release and are treated as higher confidence.
**Conclusion / what changes:** Gives whoever next tunes the scoring prompt or
`suggestedMessage` drafting a concrete, sourced signal list to work from (Findings 1, 2, 4,
5) instead of intuition; reinforces the existing "false cold" design concern from the
2026-09-12 pass with a distinct second mechanism (comparison-shopping, Finding 3, vs. terse
replies, Finding 4); and adds a validated, primary-sourced case that Instagram DM is a
high-value channel worth real design/product attention, not a secondary one (Finding 6).
**Written up in:**
`followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`

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
