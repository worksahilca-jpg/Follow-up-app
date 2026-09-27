# Brand principles

The non-negotiables. Everything else in `brand/` is an expression of these.

---

## 1. Trust is the product, not a feature of it

FollowUp is given access to a business's leads, inbox, and reputation — and then acts on
its behalf. Every design choice either deposits trust or withdraws it.

**Design consequence:** no dark patterns, no hidden automation, no "we sent 47 messages"
surprises. The user must always be able to see what was sent, to whom, why, and how to
stop it. A confirmation step that costs a click is cheaper than a customer who feels
ambushed by their own software.

**Test:** would a business owner be comfortable if their customer saw this screen?

---

## 2. Calm over urgent

The category norm is manufactured urgency: red badges, flashing counters, "12 HOT LEADS!"
FollowUp inverts this. The product's job is to *remove* the owner's anxiety about leads
going cold — an interface that generates anxiety is working against its own purpose.

**Design consequence:** urgency is stated once, precisely, where it's actionable. Not
repeated across every surface. Color signals meaning, never excitement. Silence is a valid
state and empty screens are allowed to look calm rather than apologetic.

**Test:** does this screen feel like a to-do list that's on top of things, or an inbox
that's drowning?

---

## 3. AI is invisible capability, never personality

The moment FollowUp feels like "an AI product," it has lost. Business owners don't want a
robot colleague — they want their follow-ups done. AI is the mechanism, not the pitch.

**Design consequence:** no sparkle icons as a substitute for explanation, no typing-dot
theater, no chat bubble mascot, no "✨ AI-powered" labels on things. When automation acts,
it explains itself in plain language a busy person reads in two seconds.

Every automated action must let the user answer, unaided:
- **What happened?**
- **Why did it happen?**
- **What can I do about it?**
- **What does FollowUp recommend?**
- **What needs my attention?**

**Test:** remove every AI-referencing word from the screen. Is it still fully
understandable? It must be.

---

## 4. The user is busy, distracted, and not a software person

The ICP is an owner or a small team running the business *and* the follow-ups. They open
FollowUp between jobs, on a phone, with 90 seconds. They will not read a paragraph, learn
a mental model, or hunt through settings.

**Design consequence:** the most important thing on a screen is the biggest, first, and
unambiguous. Defaults are correct for the 80% case. Jargon is banned — no "cadence",
"sequence enrollment", "orchestration" where "follow-up", "added to", "plan" will do.
Configuration is progressive: powerful when sought, invisible when not.

**Test:** would someone who has never seen this screen know what to do in five seconds?

**The phone is not a shrunk desktop** (founder, 2026-09-26: *"it is not supposed to be same… the information should be same, the message should be same… the diagrams and all that are consuming lots of space in mobile version"*). On a phone, keep every word and every claim, and cut or compress the pictures: big mock cards become one compact example, card grids become divider lists, several stacked demos become tabs showing one at a time, three price cards become a switcher. A visual stays on the phone only if the words can't carry that point alone.

**The phone must be habitable** (founder, 2026-09-26: *"make it more simple so that I can also be habitable with my phone, because users will be mostly using their phone"*). In the app, one screen = one decision: the next person who needs you, their message, your reply, and a big Send. No progress bars, filter chips, section labels, colour dots or stats on the phone. If the owner wouldn't open it between jobs with one thumb, it's too much.

---

## 5. Clarity over cleverness, always

A clever interaction that needs explaining is a bug. Novelty is not a value; recognition
is. Conventional patterns, executed with unusual precision, beat invented patterns.

**Design consequence:** familiar structures — list, detail, form, table — refined to a
high finish rather than replaced with something original for its own sake. Originality is
spent on the *problem* (how a lead's urgency is communicated), not on the *chrome* (how a
dropdown opens).

**Test:** did this need a tooltip to be understood? Then redesign it, don't add the tooltip.

---

## 6. Show the reasoning, not just the verdict

FollowUp makes judgments — this lead is hot, this one needs you, this one can wait. A
judgment without its reasoning is either blindly obeyed or entirely ignored. Both are
failures.

**Design consequence:** a score is always accompanied by why. A recommendation always
carries its evidence. A confidence level is stated honestly, including when it's low.
"Not reviewed yet" is a real, distinct state from "nothing needed" — the product must
never imply it has looked at something it hasn't.

**Test:** can the user disagree with FollowUp on an informed basis? They must be able to.

---

## 7. Never design the spam tool

There is a version of this product that is a bulk-blast machine, and it must never be
built, visually or functionally. FollowUp follows up *where permission exists*, in
conversation, at human scale.

**Design consequence:** no "blast" affordances, no bulk-message-everyone as a primary
action, no volume metrics celebrated as success (messages sent is not a success metric;
replies and deals are). Compliance and permission state are visible, not buried.

**Test:** does this screen make sending more messages feel like winning? Then it's wrong.

---

## 8. Precision is the aesthetic

FollowUp doesn't look premium because of gradients, glass, or animation. It looks premium
because of alignment, consistent spacing, restrained type, deliberate color, and things
lining up. The discipline referenced in Apple/Linear/Stripe/Notion is *restraint*, not
style — and restraint is what gets copied here, never their interfaces.

**Design consequence:** a limited palette, a small and deliberate set of typefaces, a strict
spacing scale, real alignment, and the removal of anything that doesn't carry information.
Polish is achieved by subtraction far more often than by addition.

**CORRECTED (2026-09-22).** This read "one typeface" until today, and had been false since
the landing-page rebuild. What actually ships is three faces, each with one job: **Public
Sans** for everything structural (`--font-display`, `--font-body` in `globals.css` both
resolve to it), **IBM Plex Mono** for small uppercase labels and figures, and **Instrument
Serif** for the landing page's emphasis italic — the *"because you forgot to follow up"* in
the approved hero ([[approved#^A-013|A-013]]). Flagged as gap 8 of the 2026-09-13
landing-page research and left standing until now. The principle was never really about the
count: three faces doing three jobs is restraint; two sans-serifs competing for the same job
is not. **That** is the test, and it is what the wording above now says.

**Test:** what can be removed from this screen without losing meaning? Remove it.

---

## Which of these now carry external evidence

Added 2026-09-12 after the first research pass. Principles 3, 4, 6 and 7 are no longer only
convictions — see `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md` (medium confidence; the underlying sourcing is
search-snippet-based, good enough to steer design, not to quote on a screen).

| Principle | Evidence |
|---|---|
| **3 — AI is invisible capability** | 65.5% of owners fear AI makes their business feel less authentic; 79% of customers prefer a human. The fear is specific and about *their customer's* experience — every sparkle icon feeds it |
| **4 — The user is busy and not a software person** | Competitors are repeatedly marked down by this exact ICP for setup burden and learning curve; "up a ladder" is the literal usage context |
| **6 — Show the reasoning, not just the verdict** | 77% want human approval before an agent acts; approval is meaningless without the reasoning to approve *on* |
| **7 — Never design the spam tool** | TCPA liability ($500/violation) sits with the business, not FollowUp — visible permission state is a real user need, not a posture |

## How to use these

When two principles conflict — and they will — the order above is roughly the priority
order. Trust beats calm; calm beats clarity-of-density; nothing beats trust.

When a design decision is hard, name which principle it serves. If it serves none, it's
probably decoration.


## 9 — Every word must be understood by someone who has never used software like this

Added 2026-09-18, founder's words on the landing page: "the information is very complex. I want
to make it very simple so that every single user can understand. Even if someone wants to use it
without any tough things, they should understand."

**In practice:** one idea per sentence. The customer's word, not ours ("customer" over "lead"
where a customer would read it, "going quiet" over "scored at risk", "written down" over "on
the record"). No product-internal names on a public screen (sequence, draft, autonomy, window,
CRM, integration, real-time). Fewer things on the screen beats a clearer explanation of many.

**Test:** read the section aloud to someone who runs a shop and has never used a CRM. If they
ask "what does that mean?", the line is wrong, not the reader.
