# Reference workflow

How a thing you liked becomes design intelligence the product can use.

**The rule: nothing is stored without analysis.** A folder of screenshots is a mood board.
A folder of analyzed references is a design brain.

---

## For the founder: how to add a reference

Send it however is easiest — paste a URL, drop a screenshot, name an app, share a video
with a timestamp, link a Figma file. **You don't have to write anything.**

Adding a single line about *why* it caught your eye makes the analysis far more accurate,
because "I like this" and "I like how calm this feels" and "I like how they explain what
the system did" lead to very different lessons. But it's optional — Claude will analyze it
and ask if the reason is unclear.

You can also say "I like this" about something **inside FollowUp**. That's a decision, not
a reference, and it goes to `decisions/approved.md`.

---

## For Claude: processing a reference

### 1. Capture it before analyzing it
Save the artifact into the right category folder. Screenshots and videos live next to
their note file with a matching name. For a URL, **describe what it showed in enough
detail to survive the link dying** — pages get redesigned, and a reference that is only a
dead link is worse than no reference.

### 2. Create the note
Copy `references/_reference-template.md`. Name it
`YYYY-MM-DD-source-short-description.md`. Status: `INBOX`.

### 3. Analyze it properly
Fill in every field. The three that carry the value:

- **UX principle** — must generalize beyond this screen. Not "their list is clean" but
  "every row has exactly one primary action; everything else is revealed on demand, which
  is what keeps a dense list scannable."
- **Whose user is this?** — the field most often skipped and most often decisive. A
  pattern built for an engineer living in a tool all day can be actively hostile to an
  owner checking a phone between jobs. **Name the mismatch when there is one.**
- **What FollowUp should NOT copy** — never blank. There is always something: a
  brand-specific flourish, a density that doesn't suit our user, a convention that depends
  on their scale, an aesthetic that conflicts with our principles.

### 4. Ask if you can't tell
If you can't work out why the founder liked it, **ask one specific question** rather than
guessing. A wrong inference recorded as a principle misleads every future session.
"Was it the calmness of the layout, or the way they explain the status?" takes ten seconds
to answer and makes the reference ten times more useful.

### 5. Move to REVIEWED
Analysis done, awaiting the founder's judgment.

### 6. The founder decides
- **APPROVED** — this direction is right for FollowUp. Claude may draw on its principles
  freely. If it implies a general rule, also add it to `decisions/approved.md`.
- **REJECTED** — deliberately declined. Record why in the note, and if it implies a
  general rule, add it to `decisions/rejected.md` so it can't come back.
- **ARCHIVED** — was relevant, no longer is. Kept for history.

Update the status history at the bottom of the note. **Never delete a reference** — a
rejected reference is a record of a considered decision, which is exactly as valuable as
an approved one.

---

## Using references in design work

1. **Check `references/<category>/` before designing** in that category.
2. **Only APPROVED references carry authority.** A REVIEWED one is input to a
   conversation, not justification for a decision.
3. **Cite the principle, not the product**, when recording a decision:
   *"one primary action per row, per `references/crm/2026-09-14-….md`"* — not "like Linear".
4. **Extract, never reproduce.** If someone could look at the result and name the
   reference, start over.
5. **Question the transfer every time.** Does this reference's user look like ours? Under
   the same pressure? On the same device? With the same expertise? Most failed pattern
   borrowing is a context mismatch, not a bad pattern.

---

## Claude adding its own references

Allowed, during purposeful research, with two conditions:

- **It's tied to a question**, logged in `research/research-log.md`. Not collection.
- **Only what was actually observed.** Never describe a product's interface from memory —
  training data goes stale, products redesign, and a confidently described screen that
  doesn't exist poisons every decision downstream. If you can't see it now, say so and
  record it as unverified.

---

## Anti-patterns

- **The mood board** — many screenshots, no analysis, no lessons.
- **The plagiarism folder** — references used as templates.
- **The dead link** — a URL with no description, pointing at a page that changed.
- **The blank guardrail** — "what not to copy" left empty.
- **The context blind spot** — borrowing an enterprise-power-user pattern for an
  interrupted owner on a phone.
- **The imagined reference** — describing a screen from memory as though it were observed.
