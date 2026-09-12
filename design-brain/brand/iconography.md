# Iconography

**Principle: an icon is a label's shorthand, not its replacement.** Users recognize maybe
a dozen icons reliably (search, close, settings, back, plus). Everything else needs words.

---

## Current state

**Library: `lucide-react`**, already a dependency and used throughout. This is a good
choice — consistent stroke geometry, large coverage, tree-shakeable, well maintained.

**Decision: Lucide is the icon system. Do not add a second icon library.** Mixing icon
sets is one of the fastest ways to make a product look assembled rather than designed.
If Lucide lacks an icon, either compose it from Lucide primitives, draw one matching
Lucide's grid and stroke, or — most often the right answer — use a word.

Brand/channel logos (Gmail, Instagram, WhatsApp, Twilio) are the exception: they are
marks, not icons, and must use official artwork within each platform's brand guidelines.
Keep them in their own component/folder, never restyled to match Lucide's stroke.

---

## Rules

1. **Size from a fixed set**: 14px (inline with small text), 16px (default UI), 20px
   (nav, prominent buttons), 24px (page-level, empty states, rare). Nothing in between.
2. **Stroke width stays at Lucide's default** (2px at 24px, scaling down). Never mix
   stroke weights on one screen.
3. **Icons inherit text color** by default. An icon is not an opportunity for color. The
   exceptions are the same as everywhere else: interactive (accent) and status (status
   color, always with a label).
4. **Icon-only buttons need an accessible name** — `aria-label`, and a tooltip on hover
   for anything not universally recognized. An unlabeled icon-only toolbar is a
   memorization test.
5. **One meaning per icon, product-wide.** If a bell means notifications, a bell never
   also means reminders. Keep the mapping below current.
6. **Optical alignment beats mathematical alignment.** Some icons need a 1px nudge to look
   centered. That's not sloppiness — it's correct.
7. **No icon for its own sake.** A section header does not need an icon. A button with a
   clear label does not need an icon. Ask what the icon adds; if the answer is "visual
   interest," remove it.
8. **Never animate an icon to convey AI activity.** No sparkles, no pulse, no shimmer.
   (Principle 3.)

---

## Meaning map

Keep this filled in as the app's icon vocabulary settles. One row per meaning, so the
same concept never gets two icons.

| Meaning | Icon | Notes |
|---|---|---|
| Notifications | `Bell` | `NotificationBell` component |
| Needs attention | `[TO DECIDE]` | Must pair with a text label — never color/icon alone |
| Lead / person | `[TO DECIDE]` | |
| Conversation / message | `[TO DECIDE]` | |
| Follow-up scheduled | `[TO DECIDE]` | |
| Automation active | `[TO DECIDE]` | Must read as "running", not as "robot" |
| Paused / stopped | `[TO DECIDE]` | |
| Sent successfully | `[TO DECIDE]` | |
| Failed to send | `[TO DECIDE]` | With label, always |
| Settings | `Settings` | |
| Search | `Search` | |

`[TO DECIDE]` — populate this table from an audit of the icons the app already uses
(`grep -rho "from \"lucide-react\"" -A2 followup/src` is a starting point) and resolve any
duplicate meanings found. That audit hasn't been run; don't pretend it has.

## Open decisions

- `[TO DECIDE]` The complete meaning map above.
- `[TO DECIDE]` Whether FollowUp needs a logo/mark refinement pass. Out of scope for the
  product UI, relevant to the landing page.
- `[TO DECIDE]` Favicon / app icon / mobile app icon consistency (there's a Capacitor
  mobile wrapper in `mobile/`).
