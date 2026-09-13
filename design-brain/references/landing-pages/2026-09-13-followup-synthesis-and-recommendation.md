# FollowUp-specific synthesis — what the landing-page research means for us

**Companion to:** `2026-09-13-competitor-landing-page-research.md` (read that first — this
file only draws conclusions from it).
**Added:** 2026-09-13
**Added by:** Claude — research pass, positioning/copy recommendation, not implemented.
**Status:** REVIEWED — a proposal for the founder to weigh, not a design decision. Nothing
in this file has been built; see the parent task's instruction that this pass is research
only.

---

## Checked against `PRODUCT_DIRECTION.md` first, as instructed

- **Rule 1 (depth over breadth, resolved horizontal):** nothing below proposes a vertical
  pitch. Every recommendation stays horizontal, consistent with the 2026-09-06 decision.
- **Rule 4 (don't build what Google/Salesforce will give away free):** not applicable to
  copy/positioning directly, but worth naming: HubSpot's 2026 "agentic customer platform"
  push (Part B1 of the companion file) means "AI that works in your CRM" is about to be
  free-adjacent everywhere. FollowUp's landing page should not compete on "we have AI" —
  it should compete on the specific job (lead conversion, not generation) that a
  platform's AI add-on doesn't do.
- **Nothing here overstates what's shipped.** Every claim recommended below is checked
  against the "what's actually true today" list in this agent's brief (flat $29/mo, the
  channel list, live voice AI, approval-first default with autonomous-send audit trail,
  Ponds as the routing approximation) — nothing proposes claiming skill-based routing,
  full Meta/WhatsApp scale, or Outlook (not yet built per `PRODUCT_DIRECTION.md`).

---

## The single strongest headline pattern for FollowUp's actual thesis

**Pattern: the contrast formula, stated as a category correction — not a feature claim.**

Every strong example in the companion research either names an outcome or shows a
mechanism; none makes "AI" the subject of the sentence. FollowUp's current live headline
already uses the right shape:

> "Every tool answers the lead. FollowUp catches the one that went quiet."

This is structurally identical to the strongest pattern found (Podium's problem-then-fix
contrast) but sharper, because it names a *category-wide failure* rather than a personal
pain point — closer to a positioning statement than a feature pitch. That's the right
instinct and matches the thesis directly: it doesn't claim FollowUp finds more leads, it
claims FollowUp doesn't let the ones you have die in silence.

**The recommendation is to make the *thesis itself* — lead-generation vs. lead-conversion
— more explicit somewhere very early on the page, in the plainest possible words,** because
none of the research subjects state their category correction this directly. Structurely
and Ylopo both blur generation and conversion into one bundled pitch (Part A1/A2); Podium
has drifted toward "lead generation" language even though its actual mechanism is
response speed (Part A4). **Nobody in this entire research pass draws the
generation-vs-conversion line as their core hook.** That's a genuinely open, unclaimed
angle, not a crowded one — worth stating as directly as:

> "You don't have a lead-generation problem. You have a lead-conversion problem."

as a secondary line near the top of the page (subheadline or a short line directly under
the H1), not necessarily replacing the current H1, which already does its job well. The
research supports *stating the thesis in plain words*, not *replacing the existing
contrast headline* — the current H1 is a specific instance of the thesis; the thesis
sentence itself is the category-level claim that no competitor is making out loud. Having
both — the specific H1 and the blunt thesis line right under it — matches the
"problem/outcome stated in one line → mechanism → proof" order found across the strongest
examples.

## What should be on FollowUp's landing page, and why, per the research

1. **A real product visual, not an illustration, immediately in the hero** — the single
   most repeated finding across Linear, Vercel, and general 2026 design commentary. The
   existing `HeroMockup` component is the right instinct; the research adds urgency to
   making sure it renders an honest, real-feeling FollowUp screen (the score, the reason,
   the inbox) rather than an idealized illustration. This is a note for
   `frontend-3d-agent`, not a copy change.
2. **The flat $29/mo price, stated plainly, with what's included right beside it, above
   any objection-handling copy.** This is FollowUp's single strongest, most-defensible
   structural advantage found across the entire research pass — every competitor
   researched is either meaningfully more expensive (Structurely $299/mo+, Ylopo
   $1,500-3,500+/mo all-in, Close $9-139/user/month once seats stack up) or hides its
   price entirely (Podium). Per the Basecamp/Close contrast in the companion file, "flat
   and simple" reads as *more* trustworthy than "cheaper but tiered," even when a
   competitor's entry number is lower on paper. FollowUp should say the number, not gate
   it.
3. **One or two specific, numeric proof points placed directly before the final CTA** —
   matching the repeated pattern (Podium's "%," Housecall Pro's customer count). FollowUp
   doesn't yet have a large customer count to lead with (Housecall Pro's pattern isn't
   available yet), but a specific number *is* available and already partially in use: the
   21× qualification-rate stat currently in the hero. Per the research, that kind of stat
   is more persuasive placed as a proof point right before the CTA than as hero
   decoration — worth a structural note to `frontend-3d-agent`, not a copy rewrite, since
   moving it is a layout decision.
4. **Objection-killers clustered directly beside the CTA button** (Pipedrive's pattern:
   "no credit card," "full access," together, right at the point of decision) rather than
   spread into a separate FAQ. FollowUp's real, true objection-killers are "no credit
   card required," "$29/mo, everything included, no seats," and "cancel anytime" (if
   true — verify with whoever owns billing before using it as a claim).

## What should NOT be on FollowUp's landing page, per the research

1. **No AI-as-employee or AI-as-personality framing anywhere** — the research turned up a
   real, documented cautionary tale (Artisan's "Stop Hiring Humans" campaign, covered by
   the press as controversial, not admired). This directly reinforces brand principle 3
   and the existing S-13 rejection. Worth flagging as a **hard line**, not just a style
   note, because FollowUp's own mission language ("remove the position of the
   salesperson") makes it tempting to say this out loud the way Artisan did — the
   research says explicitly: don't.
2. **No hidden or "contact sales" pricing anywhere on the page.** Podium is the clearest
   negative example in the entire pass — the one page in this research with hidden
   pricing is also the one with the worst-documented trust complaints (contract lock-in,
   billing disputes, cancellation difficulty). FollowUp's flat price is a genuine
   structural edge; hiding it would throw the edge away.
3. **No manufactured urgency** (countdown timers, "X spots left") — not even the
   competitors closest to FollowUp's own category use this. It isn't just off-brand, it's
   not even standard practice among direct competitors, so there's no competitive
   pressure to adopt it.
4. **No feature-grid "50 reasons to choose us" section.** The one example in this pass
   leaning toward exhaustive capability-listing (HubSpot) is also the one carrying a
   documented "overwhelming" complaint pattern. FollowUp's page should stay narrow and
   specific, matching the horizontal-but-narrow positioning in `PRODUCT_DIRECTION.md`
   (deep on the job, not broad on features).
5. **No claim of scale FollowUp doesn't have.** Housecall Pro's "200K+ Pros trust us" only
   works because it's true and large. Don't manufacture a customer-count claim to mimic
   the pattern before it's honestly available — a fabricated or rounded-up number is
   exactly the "scammy" register brand principle 7 and rejection S-01 rule out.

## One live finding worth flagging back to whoever owns `frontend-3d-agent`'s queue

The current hero (`followup/src/app/page.tsx`, line 46) carries a badge reading
**"AI-native, not AI-bolted-on"** next to a `Sparkles` icon. `decisions/rejected.md`
standing rejection **S-13** explicitly names "sparkle icons... ✨AI-powered" as a banned
pattern, and this research pass independently found the same category of framing (AI as
the subject of the pitch, decorated with an AI-associated icon) to be the weakest, most
negatively-received pattern anywhere in the competitive set (Artisan). This is a plain
observation of an existing inconsistency between what's shipped and the design brain's
own standing rule — not a design decision made in this pass, and not something this
research task is authorized to fix (research only, per this task's scope). Flagging it
here so it's on record rather than silently noticed and dropped.

## What I did not find, and said so rather than guessing

- No exact, verbatim hero headline for HubSpot's actual homepage (as opposed to its 2026
  campaign theme) surfaced via WebSearch this pass — the "agentic customer platform"
  framing is well-corroborated as the *theme*, not confirmed as the literal H1 string.
- No exact current Pipedrive H1 text surfaced — only the CTA-cluster pattern.
- Section-by-section scroll order for every example is inferred from search snippets and
  design-commentary roundups, not a direct visual walkthrough (see the sourcing note in
  the companion file). Anyone using this research to spec an exact new FollowUp section
  order should treat the *order logic* (problem/outcome → real visual → mechanism → proof
  → simple pricing → CTA) as solid, and the exact competitor-by-competitor section list
  as directional, not pixel-verified.
