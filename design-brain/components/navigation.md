# Navigation

**Principle: the user must always know where they are, what else exists, and how to get
back.** Navigation is the product's information architecture made visible — if the nav is
confusing, the IA is confusing, and no visual treatment fixes that.

## Current state

Persistent left sidebar (`Sidebar.tsx`) with: **Dashboard, Leads, Pipeline, Workflows,
Analytics, Activity, Settings.** Active state uses the accent.

**Honest assessment — seven top-level destinations is at the upper limit, and at least two
pairs may overlap in the user's mind:**
- *Leads* vs. *Pipeline* — both are "my leads", differently arranged. A user deciding
  which to open is doing the product's work for it.
- *Dashboard* vs. *Activity* — both answer "what happened", at different resolutions.

`[TO DECIDE]` — this is a real IA question, not a styling one, and it deserves proper
design work before more screens are added to the sidebar. Recorded here so it isn't
repeatedly rediscovered. Do not restructure the nav unilaterally; propose it.

## Rules

1. **Five to seven top-level items maximum.** Beyond that, nesting or consolidation.
2. **Name destinations in the user's words, not the system's.** "Workflows" is a
   system word; an owner thinks "follow-up plans". `[TO DECIDE]`.
3. **The active state is unambiguous** — and doesn't rely on color alone (weight,
   background, or an indicator too).
4. **Nav order reflects frequency and importance**, not the order features were built.
5. **Settings goes last**, visually separated, often bottom-anchored.
6. **Never add a nav item because a feature shipped.** Ask whether it's a destination or a
   view inside an existing destination. This is how navigation rots.
7. **Notifications are not a destination.** They're an overlay from a persistent
   indicator (`NotificationBell.tsx`).

## Wayfinding

- **Every page has a visible title** matching its nav label. A page whose title differs
  from how you got there is disorienting.
- **Breadcrumbs only where there's real depth** — a lead detail page under Leads. Not
  ceremonially on top-level pages.
- **Back behavior must be reliable.** Browser back from a lead detail returns to the list
  *with filters and scroll position intact*. This is the single most common wayfinding
  failure in CRM-shaped products and it's worth engineering properly.

## Mobile

The desktop sidebar in a drawer is the default answer and usually the wrong one.

`[TO DECIDE]` — the real question is which destinations matter for the 90-second phone
check. Probably: what needs me, the lead I'm looking at, and a way to reply. That's a
bottom tab bar of 3–4 items, not a drawer containing seven. Design mobile navigation from
the mobile task, not by compressing desktop.

## Search

`[TO DECIDE]` — no global search currently. Once lead volume is real, finding a specific
person by name becomes the most common navigation action in the product, and browsing
stops working. Likely the highest-value navigation addition. Note: a command palette is a
power-user pattern and is **not** a substitute for visible navigation for this ICP.

## Open decisions

- `[TO DECIDE]` Leads/Pipeline and Dashboard/Activity consolidation.
- `[TO DECIDE]` Nav labels in user language.
- `[TO DECIDE]` Mobile navigation pattern.
- `[TO DECIDE]` Global search.
- `[TO DECIDE]` Whether the sidebar collapses on desktop.
