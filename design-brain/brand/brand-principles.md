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

**Design consequence:** a limited palette, one typeface, a strict spacing scale, real
alignment, and the removal of anything that doesn't carry information. Polish is achieved
by subtraction far more often than by addition.

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
