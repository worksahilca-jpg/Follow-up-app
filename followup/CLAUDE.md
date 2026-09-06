@AGENTS.md

# Product Direction

The goal isn't just shipping features — it's building something that's still
the obvious choice in 20 years. That only happens by being genuinely useful
and trustworthy to users, not by chasing competitors feature-for-feature.
Beating other tools is a side effect of that, not a separate goal.

Before adding anything, weigh it against these rules:

1. **Vertical depth over horizontal breadth.** Go deep on one industry
   rather than staying generic "follow-up for anyone." A feature that only
   makes sense "for everyone" loses to platforms; one that makes this
   indispensable to one industry doesn't.

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
