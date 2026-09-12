# Design to code

The pipeline from an idea to production UI, and how the pieces connect.

```
Reference → UX concept → Figma → approved design → Claude Code →
production UI → browser review → refinement
```

**The current pipeline skips Figma.** That's stated plainly rather than pretended
otherwise — see below.

---

## The stages

### 1. Reference
Analyzed references inform the approach. `reference-workflow.md`.

### 2. UX concept
Structure before visuals; multiple genuinely different concepts; a recommendation.
`design-workflow.md` steps 1–7, `research-workflow.md`.

### 3. Figma — **not currently connected**
See the Figma section below. Today this stage is a static HTML mockup or a described
wireframe instead.

### 4. Approved design
The founder approves a direction. **Recorded in `decisions/approved.md` before
implementation begins** — approval that isn't written down is approval that will be
re-litigated.

### 5. Claude Code → production UI
Implementation. The technical rules live in `followup/.claude/agents/frontend-3d-agent.md`
and are not duplicated here. The design rules that apply:

- **Use existing tokens.** Never hardcode a value that has a token.
- **Use existing components** before creating new ones.
- **Every state from `components/states.md`** — not just the happy path.
- **Semantic HTML.** Real buttons, real headings, real labels. Accessibility is built in
  at this step or retrofitted expensively later.
- **Match the file's surrounding conventions** — naming, structure, comment density.

### 6. Browser review
**A design you haven't looked at is a guess.** Run the app and look at the real screen. If
it's behind auth and can't easily be reached, build a faithful static mockup and screenshot
that — and **label it a mockup, never present it as a live screenshot.**

Check: every state, real ugly data, 375px, keyboard, reduced motion.

### 7. Refinement
Fix what the review found, then **review again**. The last 10% is most of the perceived
quality — alignment, a better word, one fewer element.

### 8. Document
`decisions/design-decisions.md`, the component spec, any resolved `[TO DECIDE]`.

---

## Figma integration — the honest status

**Figma is not connected to this project, and nothing here should be built as if it were.**

There is a Figma MCP server available in some Claude Code sessions, which can read a
design file's structure, variables, and screenshots when a session is authenticated and a
file is shared. **That is a capability that may exist in a session, not a FollowUp
integration.** No FollowUp Figma file exists, no design tokens are synced, and no
component mapping has been set up.

**Do not:** build a fake integration, write code that assumes a Figma file exists, claim
designs were "synced from Figma", or invent a file URL.

### What to prepare now (and what this brain has already done)

The work that makes a future Figma connection cheap is work worth doing anyway:

| Preparation | Status |
|---|---|
| Named, documented design tokens | Partly — tokens exist in `globals.css` and are documented in `brand/`; many values still `[TO DECIDE]` |
| Documented component specs with variants and states | Started — `components/` |
| A naming convention shared between design and code | `[TO DECIDE]` — do this before a Figma library is built, not after |
| A decision record so Figma and code don't drift | Done — `decisions/` |

### When Figma does get connected

1. **Figma variables and code tokens must share names.** If Figma says `accent/default` and
   code says `--rust`, the pipeline leaks at every handoff. Reconcile the naming *first* —
   including the `--rust`-holds-an-amber problem in `brand/color-system.md`.
2. **The design brain stays the source of truth for *why*.** Figma holds the *what*.
   A Figma file doesn't record that an approach was rejected and why.
3. **Code Connect** (mapping Figma components to real components) is what makes
   design-to-code reliable rather than approximate. Worth setting up once a component
   library actually exists — **not before**, or you'll be mapping components you're about
   to redesign.
4. **Read a Figma design as intent, not as spec.** A design file's pixel values are a
   proposal; the token system is the law. If a Figma frame uses a 13px gap, the design
   brain's 4px scale wins, and the question goes back to the designer.

### Right now, without Figma

Static HTML mockups work well for this project: fast, honest about the real medium, and
directly reviewable in a browser. A mockup that's built from the real tokens is more
useful than a Figma frame that isn't, because it catches problems the design file hides.

---

## Other tooling — the same honesty rule

Several design-adjacent MCP servers may appear in a Claude Code session (Figma, Mobbin,
Canva, Adobe, and others). **A tool being available in a session is not an integration
this project has.** Use one when it genuinely helps a specific task, say what you used and
what it produced, and never imply a persistent connection that doesn't exist.

Specifically: **never present an image or screen produced by a generation tool as a
FollowUp design decision**, and never let a generated visual bypass the design workflow.

---

## The rule that matters most here

**Never claim a design is verified when it hasn't been looked at.** Not "this should
render correctly" — either you saw it, or you say you didn't. Every other rule in this
brain depends on this one being kept.
