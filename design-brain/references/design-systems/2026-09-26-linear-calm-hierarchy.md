# Linear — white space, typography, hierarchy, restraint, progressive disclosure

**Source:** Linear's own design writing: "A calmer interface for a product in motion" (2026-03-12), "How we redesigned
the Linear UI (part II)" (2024), the UI refresh changelog, and the Display options docs. Also third-party DESIGN.md
write-ups of linear.app. Studied from search summaries only: linear.app is blocked from this session.
**Category:** design-systems
**Added:** 2026-09-26
**Added by:** Claude, at the founder's request: *"Did we take a reference from Linear about the visual directions? We
should study white space, typography, hierarchy, restraint, and progressive disclosure."*
**Status:** REVIEWED. It awaits the founder's judgment on the three proposals at the end.
**Grades:** B = search summary of Linear's own writing or docs; C = third-party write-up.

## What Linear does

| Topic | What Linear does | Grade |
|---|---|---|
| **Hierarchy** | "Not every element of the interface should carry equal visual weight." What the task needs stays in focus; what helps you find your way recedes. The sidebar was made "a few notches dimmer" so the content area leads. | B |
| **Consistency** | Headers, navigation and view controls are the same across every view (projects, issues, reviews, documents). Icons were redrawn to one size. | B |
| **Typography** | Regular weight carries most information; stronger weight is used selectively. One family (Inter), three weights: reading, emphasis, strong. Light weight appears only where something is meant to recede. Display sizes are tightly tracked, relaxing toward normal below about 24px. | B / C |
| **Restraint (colour)** | The palette moved from cool blue-grey to a warmer, less saturated grey. Themes are generated from three values (base, accent, contrast) instead of 98 variables, in a perceptually even colour space. | B |
| **White space** | Dense type set inside generous space. The contrast between tight text and open margins is what reads as calm. | C |
| **Progressive disclosure** | Lists show a few properties; "Display options" let people choose which others appear. Full detail lives in the issue's properties panel. Power features sit behind the command menu and keyboard. | B |

## What FollowUp takes

1. **Navigation recedes, content leads.** The same move as Linear's dimmer sidebar: FollowUp's desktop sidebar should
   be quieter than the list and the person.
2. **Three weights, one job each.** In Public Sans: 400 to read, 500 to emphasise (names, row titles), 600 only for
   the one thing that must win (Needs you, Send). 300 stays for big headlines only (A-022's thin headline).
3. **One header shape everywhere.** Every desktop screen gets the same header: title, one line of context, and the
   one action, always in the same place.
4. **Disclosure in layers.** This already matches FollowUp:
   - Today shows one person and then names;
   - the person page shows "Why it's here" and the reply first, with details under it;
   - Settings keeps its plan card up front and everything else under "More settings".

## What FollowUp doesn't take

- **The dark canvas, the indigo accent and the glass floating controls.** FollowUp is warm and light, and CLAUDE.md
  rules out excessive glassmorphism.
- **The command menu and keyboard-first design** (R-002). An owner between jobs on a phone isn't a keyboard user.
- **Display options.** Letting people choose which columns show is a power-user feature. FollowUp chooses for them.
- **Density for its own sake.** Linear's users live in it all day, and FollowUp's glance at it (Attio note, same
  lesson).

## Sources

- Linear, "A calmer interface for a product in motion": https://linear.app/now/behind-the-latest-design-refresh
- Linear changelog, UI refresh (2026-03-12): https://linear.app/changelog/2026-03-12-ui-refresh
- Linear, "How we redesigned the Linear UI (part II)": https://linear.app/now/how-we-redesigned-the-linear-ui
- Linear docs, Display options: https://linear.app/docs/display-options
- VoltAgent, linear.app DESIGN.md (C): https://github.com/voltagent/awesome-design-md/blob/main/design-md/linear.app/DESIGN.md
