# Design review

**Run this before calling any design complete. Honestly.**

A review where everything passes on the first attempt didn't happen. The purpose is to
find what's wrong while it's still cheap to fix — if you find nothing, you weren't
looking.

Report results as: ✅ pass · ⚠️ weak, and here's how · ❌ fails, and here's what's needed.
**Never mark something pass because it's probably fine.** Check it or mark it unchecked.

---

## 1. User clarity
- [ ] A user knows what this screen is for within 5 seconds
- [ ] The primary action is obvious without instruction
- [ ] No element needs a tooltip to be understood
- [ ] Language is the user's, not the system's — no "cadence", "enrollment", "orchestration"
- [ ] A busy owner with 90 seconds gets what they came for

## 2. Information hierarchy
- [ ] The most important thing is visually the most important thing
- [ ] Scan order matches priority order
- [ ] Related things are grouped by proximity, not by boxes
- [ ] Nothing competes with the primary action
- [ ] Removing any element would lose information (if not, remove it)

## 3. Navigation
- [ ] The user knows where they are
- [ ] The way back is obvious and preserves state (filters, scroll)
- [ ] The way forward is obvious
- [ ] No dead ends
- [ ] Deep-linkable — the URL reflects what's on screen

## 4. Accessibility
- [ ] Text contrast ≥ 4.5:1; large text and UI elements ≥ 3:1 — **measured, not assumed**
- [ ] Nothing conveyed by color alone
- [ ] Every interactive element is keyboard reachable, in a logical order
- [ ] Focus is always visible
- [ ] Semantic HTML — real buttons, real headings in order, real tables, real labels
- [ ] Images and icon-buttons have text alternatives
- [ ] Dynamic changes are announced (`aria-live`) where they matter
- [ ] Works at 200% zoom
- [ ] `prefers-reduced-motion` honored

## 5. Typography
- [ ] Every size comes from the scale — no arbitrary values
- [ ] Nothing below 12px; nothing a user must read below 14px
- [ ] Line height appropriate to size; measure 60–75 chars for reading text
- [ ] Two weights, maybe three — hierarchy from size and weight, not color
- [ ] Sentence case throughout
- [ ] Tabular figures on aligned numbers

## 6. Spacing
- [ ] Every value from the 4px scale
- [ ] Consistent padding within a component type
- [ ] Space used for grouping before borders or boxes
- [ ] No card-in-card
- [ ] Touch targets ≥ 44×44px

## 7. Consistency
- [ ] Uses existing components; no near-duplicate of something that exists
- [ ] Uses existing tokens; no hardcoded value that has a token
- [ ] Matches established patterns (settings sections, optimistic updates, empty states)
- [ ] Any deviation is deliberate and documented
- [ ] Doesn't contradict `decisions/approved.md`
- [ ] **Doesn't re-introduce anything in `decisions/rejected.md`**

## 8. Responsive behavior
- [ ] Works at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll at any width
- [ ] Content reflows, not just shrinks
- [ ] Mobile layout designed from the mobile task, not compressed from desktop
- [ ] Nothing depends on hover

## 9–12. Empty, loading, error, success states
- [ ] All four empty types distinguished (first-run / no-results / all-clear / unavailable)
- [ ] Loading: nothing under 300ms, skeletons that match, no layout collapse
- [ ] Errors say what happened, what it means, what to do; input never lost
- [ ] Partial failure handled explicitly
- [ ] Success is quiet; no toast for something already visible
- [ ] See the full definition of done in `components/states.md`

## 13. Feedback
- [ ] Every action produces a visible response within 100ms
- [ ] Consequential outcomes persist; nothing important lives only in a toast
- [ ] Destructive actions have undo, or confirmation where undo is impossible
- [ ] The user always knows whether something is saved

## 14. Micro-interactions
- [ ] Hover, active, and focus states on everything interactive
- [ ] Optimistic updates where appropriate, with a revert path
- [ ] Nothing shifts position unexpectedly (no layout jump on load)

## 15. Motion
- [ ] Every animation explains a change — none is decorative
- [ ] Durations 120–300ms; transform and opacity only
- [ ] Reduced motion honored
- [ ] No AI-activity animation, no shimmer-as-thinking

## 16. Keyboard usability
- [ ] Every task completable without a mouse
- [ ] Tab order logical; focus trapped and returned in overlays
- [ ] Escape closes; Enter submits
- [ ] No keyboard trap

## 17. Mobile usability
- [ ] Primary actions in thumb reach
- [ ] Targets large enough for imprecise taps
- [ ] No hover-dependent functionality
- [ ] Keyboard doesn't obscure the field being typed into
- [ ] Correct input types and mobile keyboards

## 18. Performance
- [ ] No layout shift on load
- [ ] Perceived speed: something meaningful is on screen fast
- [ ] Long lists virtualized or paginated
- [ ] No unnecessary client-side JS; no server-only lib pulled into a client bundle

## 19. Trust
- [ ] The user can tell what the system did on their behalf, and why
- [ ] Automated actions are inspectable and stoppable
- [ ] Nothing is exaggerated or implied that isn't true
- [ ] Uncertainty is stated honestly — "not reviewed yet" ≠ "nothing needed"
- [ ] No dark patterns
- [ ] **Would the owner be comfortable if their customer saw this screen?**
- [ ] Nothing here would look at home in a spam tool

## 20. Cognitive load
- [ ] One main thing to think about
- [ ] No memorization required across screens
- [ ] Defaults correct for the common case
- [ ] Advanced options present but not prominent
- [ ] Fewer decisions than the previous version, if this replaces something

---

## Self-critique — answer all eleven, in writing

Not optional. Vague answers mean you skipped it.

1. **Is this actually easier to use**, or just newer-looking?
2. **Is anything unnecessary?** What can be removed right now?
3. **Does it feel trustworthy?** What's the least trustworthy element?
4. **Does it look like a real product**, or like a template?
5. **Is the hierarchy obvious**, or does it need explanation?
6. **Does anything feel artificial** — decoration pretending to be function, complexity
   pretending to be capability?
7. **Is the interface too complicated** for someone seeing it for the first time?
8. **Would a busy business owner understand it immediately?** Not eventually. Immediately.
9. **Does it solve the user's actual problem**, or a problem adjacent to it?
10. **What would make this 20% better?** Name something specific. There is always
    something.
11. **What would make this feel world-class without adding complexity?** Usually
    subtraction, alignment, or a single better word.

**Then say the uncomfortable thing.** What's the weakest part of this design? If you can't
name one, you haven't reviewed it — you've defended it.
