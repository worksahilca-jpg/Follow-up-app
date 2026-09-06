@AGENTS.md

# Product Direction

The actual mission: **no lead ever goes cold, and no business owner loses a
deal because a follow-up was late, wrong, or never sent — on any channel, in
any language.** Every CRM already does lead generation and lead sorting;
none of them are actually on the hook for the leads that get spammed past,
ignored, or left to rot in an inbox or DM. That's the gap this product
exists to close. The long-term version needs no dedicated human just to
keep that promise — AI should be able to receive a call, read a DM, or
answer an email, in the lead's own language, well enough that a business
never has to hire someone whose whole job is "don't let leads go cold."

Getting there is a sequencing problem, not a switch to flip. Earn full
autonomy channel by channel — text/email/DM first (reversible, low-stakes,
easy to hold-for-review), live voice calls last (highest-stakes, hardest to
undo, hardest to get right in a language other than English). Skipping
straight to unsupervised multilingual phone calls is the fastest way to
become this category's own cautionary tale — see
`research/customers/2026-09-05-icp-pain-points-trust-pricing.md` section
3.2: the most autonomous "AI SDR" in the category has the *lowest* rating
among reviewed competitors, precisely because generic-sounding automation
tanks response rates once a lead notices, and voice has no
hold-for-review safety net once the call already happened. Rule 5 below
(design for rising autonomy) is exactly this: each channel earns its way
there, not all of it on day one.

"Every language" should mean every language the underlying speech/LLM stack
actually covers well (major world languages first: Spanish, Mandarin,
Hindi, Arabic, Portuguese, etc.), stated honestly rather than promised
absolutely — and it's a real, underused wedge regardless: most competitors
in this category barely support non-English leads at all, which is a gap
worth owning before anyone else does.

Before adding anything, weigh it against these rules:

1. **Vertical depth over horizontal breadth.** Go deep on one industry — or
   one underserved language/region — rather than staying generic "follow-up
   for anyone." A feature that only makes sense "for everyone" loses to
   platforms; one that makes this indispensable to one industry or one
   underserved market doesn't.

2. **Own the data, don't just view it.** Lead history, AI scoring
   reasoning, message templates, and outcomes live in our own DB as
   permanent records — never just computed live from Gmail/Twilio/Instagram
   on each page load. A user's years of tuned history living only here is
   the real lock-in, and it's also what makes the product get better for
   them over time instead of staying static.

3. **Trust is a feature — ship it like one.** Every automation capability
   needs an explicit, user-visible guarantee about what it will never do,
   plus a test proving it. Model the "stops the instant a lead replies"
   guarantee. No automation ships silently. A user should never be
   surprised by what this sent on their behalf.

4. **Don't build what Google/Salesforce will give away free.** Skip parity
   features big platforms are about to bake in for free. Spend effort on
   what's too vertical-specific or opinionated for them to bother with —
   that's usually also the part that helps a specific user the most.

5. **Design for rising autonomy, not fixed human-in-the-loop.** Keep
   "AI drafts → human approves" swappable per lead/tier (see the
   Assisted/Autonomous selector) instead of hard-baked as permanent. As
   trust is earned, let the product do more for the user with less
   supervision — don't force them to keep babysitting it forever.

6. **Label every roadmap item "moat" or "table stakes."** Moat = hard for
   a competitor/platform to copy in 6 months. Table stakes = needed just to
   stay credible. Bias effort toward moat work once table stakes are
   covered — and moat work here should almost always be legible to the user
   as "this actually helps me," not just a defensive business move.

Before building a feature, state in one line which rule it serves. If none,
that's fine — just flag it as short-term/table-stakes work, not strategic.
