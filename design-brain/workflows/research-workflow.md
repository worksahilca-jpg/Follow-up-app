# Research workflow

**When the founder asks for a new design, this runs first.** Not as ceremony — as the
difference between a design that solves a problem and a design that looks like a solution.

**The governing rule: research answers a question.** If you can't state the question in
one sentence, you're collecting screenshots, not researching. Stop.

---

## Trigger

Run this when: a new screen is requested, an existing screen isn't working, a design
decision has no obvious answer, or you're about to make an assumption about user behavior
that you can't support.

**Don't run it** when: the answer is already in the design brain, the change is small and
covered by existing patterns, or the question is a taste question the founder should just
be asked.

---

## The ten steps

### 1. Understand the user problem
Before anything visual. Write, in one or two sentences:
- **Who** is on this screen (owner? team member? which one?)
- **What** they're trying to accomplish — their goal, not the feature name
- **When and where** — desk or phone, focused or interrupted, daily or monthly
- **What happens if it goes badly** — the cost of the design failing

If you can't write this, you don't have enough to design. **Ask the founder.**

### 2. Read the FollowUp design brain
- `brand/brand-principles.md` — always
- `decisions/rejected.md` — **always, before forming any opinion**
- `decisions/approved.md` — what's already locked
- The relevant `brand/` and `components/` files
- `followup/PRODUCT_DIRECTION.md` for what the product is actually for

### 3. Review stored references
`references/<category>/` for the relevant category. Only **APPROVED** references carry
authority. Note which principles apply and which don't, and why.

### 4. Research current UX patterns — only when needed
When an established answer exists and you don't know it. Prefer durable behavioral
findings over trend observation. Log in `research/research-log.md` with sources.

**Never fabricate.** No invented statistics, no citations to studies you haven't read, no
imagined user quotes. One fabricated finding makes the whole brain untrustworthy.

### 5. Analyze competitors — only when useful
Look for **what they get wrong**, not what to copy. See `research/competitors/README.md`.
Be explicit about evidence quality: a marketing page is not the product.

### 6. Identify common usability problems
For this screen type, what typically goes wrong? Dashboards show vanity metrics; lead
lists make users do the prioritizing; onboarding asks too much too early; message
composers hide the failure state. Name the specific traps for *this* screen so the design
can avoid them deliberately.

### 7. Identify opportunities to make FollowUp better
Where can this screen do something competitors structurally can't or won't? Usually where
FollowUp's real asset — knowing which leads are going cold and why — can do the user's
thinking for them.

### 8. Generate multiple original concepts
**Genuinely different**, not variations. See `design-workflow.md` for what "different"
means — at minimum, different information architecture and different interaction models,
not different colors.

### 9. Explain the reasoning
For each concept: what user problem it solves, what it optimizes for, what it sacrifices,
which principle it serves, who it's best for.

### 10. Recommend the strongest, and say why
**Take a position.** A menu of options with no recommendation pushes the work back onto
the founder. Name the strongest concept, explain why it wins, and name what it gives up.

---

## Output format

```markdown
## Design research: [screen]

**The problem:** [user, goal, context, cost of failure]
**What the design brain already says:** [constraints, approvals, rejections that apply]
**References consulted:** [with what was taken from each]
**Research conducted:** [question, method, findings, confidence — or "none needed, because…"]
**Usability traps for this screen type:** [specific, named]
**Our opportunity:** [what FollowUp can do here that others don't]

### Concepts
[3–5, genuinely different, each with what it optimizes and what it sacrifices]

### Recommendation
[Which, why, what it costs, what would change my mind]

### What I'm unsure about
[Honest. Where founder input would change the answer.]
```

---

## Anti-patterns

- **Research theater** — a long document that changes no decision.
- **Screenshot collecting** — inspiration browsing labeled as research.
- **Competitor mirroring** — "they all do X, so we should."
- **Fabricated confidence** — invented data, or "studies show" without a study.
- **Recommendation avoidance** — five options and no opinion.
- **Skipping step 1** — designing a screen before knowing whose problem it solves. The
  most common and most expensive failure.
