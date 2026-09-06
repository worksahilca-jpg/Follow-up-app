# Product direction — build for 20-year survival, not just to ship features

Set by the CEO (2026-09-06). This is a standing filter, not a one-time memo — every
agent in `.claude/agents/` and every session working on this repo applies it before
adding anything, not just when it's freshly top of mind. `manager-agent.md` and
`growth-agent.md` point back here; if you're proposing a feature, a roadmap item, or
a positioning change and haven't checked it against these six rules, you're not done.

## The six rules

1. **Vertical depth over horizontal breadth.** Default to going deep on one industry
   (e.g. real estate, home services, insurance) over staying generic "follow-up for
   anyone." Features that only make sense "for everyone" lose to platforms; features
   that make this indispensable to one industry don't.

2. **Own the data, don't just view it.** Lead history, AI scoring reasoning, message
   templates, and outcomes must live in our own DB as permanent records — never just
   computed live from Gmail/Twilio/Instagram on each page load. Years of tuned
   history living only here is the real lock-in.

3. **Trust is a feature — ship it like one.** Every automation capability needs an
   explicit, user-visible guarantee about what it will never do, plus a test proving
   it. Model the "stops the instant a lead replies" guarantee. No automation ships
   silently.

4. **Don't build what Google/Salesforce will give away free.** Skip parity features
   big platforms are about to bake in for free. Spend effort on what's too
   vertical-specific or opinionated for them to bother with.

5. **Design for rising autonomy, not fixed human-in-the-loop.** Keep "AI drafts →
   human approves" swappable per lead/tier (like the Assisted/Autonomous selector
   already does) instead of hard-baked as permanent. More autonomy is coming — the
   architecture shouldn't need a rewrite to get there.

6. **Label every roadmap item "moat" or "table stakes."** Moat = hard for a
   competitor/platform to copy in 6 months. Table stakes = needed just to stay
   credible. Bias effort toward moat work once table stakes are covered.

**Before building a feature, state in one line which rule it serves.** If none, that's
fine — just flag it as short-term/table-stakes, not strategic. Don't retrofit a
justification onto a feature someone already wants to build; if it doesn't serve one
of these, say so plainly.

## Where this repo already stands against the rules, as of 2026-09-06

Not a self-congratulation pass — a real check, including the gaps.

- **Rule 1 (vertical depth) — the biggest open gap.** FollowUp is still explicitly
  horizontal ("follow-up for anyone" — see `growth-agent.md`'s thesis). Nothing built
  so far is vertical-specific. `research/customers/2026-09-05-icp-pain-and-trust-objections.md`
  found the single strongest quantified pain signal of any research pass
  (62% industry-wide missed-call rate, 391% conversion lift from a 1-minute callback)
  in **home-services contractors** specifically — the closest thing on file to a
  candidate vertical, but picking one is a CEO decision, not something to default
  into from a single research pass.
- **Rule 2 (own the data) — already true, verified, not assumed.** Lead conversations
  (`Conversation`/`Message`), AI scoring reasoning (`Lead.scoreReason`/`scoreFactors`),
  drafted messages (`Lead.suggestedMessage`), and outcomes (`FollowUp.repliedAt`,
  `Deal`) are all real Prisma-backed rows, not recomputed live from Gmail/Twilio/
  Instagram on page load. This has been true since the schema was first built, not
  something added for this rule — worth stating plainly rather than re-verifying
  every time it comes up.
- **Rule 3 (trust ships like a feature) — the strongest rule already in practice.**
  "Stops the instant a lead replies" (sequences), approval-first-by-default,
  per-lead Assisted/Autonomous, the TCPA and A2P 10DLC notices, and three
  concurrency-safety fixes this session (rapid-engagement dedup, missed-call
  text-back cooldown, the Ponds claim race) are all real, user-visible guarantees —
  but none of them currently ship with an automated test proving the guarantee
  holds, which the rule explicitly asks for. That's a real gap, not just a nuance.
- **Rule 4 (don't build free-platform parity)** — no violations found yet; nothing
  built so far duplicates what Gmail/Salesforce/HubSpot would give away. Worth
  re-checking whenever a "smart inbox" or "AI email assistant" style feature is
  proposed, since that's exactly the terrain Google is moving into.
- **Rule 5 (rising autonomy, not fixed human-in-the-loop)** — already the actual
  architecture: automation tier (OFF/ASSISTED/AUTONOMOUS) is a per-lead column, not
  a global flag, and every automation path already checks it per-lead rather than
  assuming one mode business-wide. No rework needed to raise the autonomy ceiling
  later.
- **Rule 6 (moat vs. table stakes)** — hasn't been applied retroactively before now.
  Rough first pass, to be refined as the vertical decision lands:
  - **Moat-leaning:** the visible-reason AI scoring (a real, defensible bet on
    trust-through-transparency, not just a score); the per-lead autonomy tier
    (structural, not cosmetic); Smart Views + Ponds (workflow-shaped, not feature-shaped
    — cheap for a competitor to clone the *idea* but the shared-pool + saved-filter
    combo is stickier once a team's real filters live in it).
  - **Table-stakes:** multi-channel capture (every competitor has this), Stripe
    billing, rate limiting, TCPA/A2P compliance notices (necessary to be credible,
    not a differentiator), the mobile app shell.
  - **Unclear until the vertical is picked:** almost everything proposed from here
    forward — a vertical-specific feature is moat by definition; the same feature
    built generic is table stakes at best.

## The one open question every other rule depends on

Rule 1 asks for a vertical. Nothing else in this framework can be applied with real
confidence — what's moat vs. table-stakes (rule 6), what a platform will give away
free (rule 4), what's worth building deep vs. skipping — until that's picked. This
is the CEO's call, not a default to research into on our own.
