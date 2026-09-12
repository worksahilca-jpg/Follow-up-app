# References — Mobile

Mobile-specific patterns, responsive behavior, touch interaction, native feel.

## What to look for here

- **What the mobile version chose to drop**, and whether the user misses it.
- **Thumb reachability** — where primary actions sit on a real phone held one-handed.
- **Touch targets and spacing** that survive imprecise taps.
- **Density adaptation** — how a dense desktop table becomes a usable mobile list. This is
  rarely done well and is exactly our lead-list problem.
- **Navigation patterns** — tab bar vs. drawer vs. contextual back.
- **Notification and deep-link behavior** — tapping an alert should land on the exact
  thing, not the home screen.

## The FollowUp-specific question

The owner persona checks FollowUp *on a phone, between other work*. For the core loop —
see what needs me, read the context, approve or write a reply — **mobile is the primary
platform, not the responsive afterthought.** There's a Capacitor wrapper in `mobile/`, so
this is real, not hypothetical. Judge references on whether the 90-second phone check is
possible.

## Anti-patterns to notice and name

Desktop tables that horizontally scroll on a phone; primary actions at the top out of
thumb reach; modals that can't be dismissed; hover-dependent functionality; 12px text
"to fit"; drag-and-drop as the only way to do something.
