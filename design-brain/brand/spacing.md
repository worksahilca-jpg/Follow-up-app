# Spacing & layout

**Principle: consistent spacing is the single cheapest source of perceived quality.**
Users don't consciously notice a 4px scale — they notice its absence as "cheap."

---

## The scale

FollowUp uses a **4px base unit**. Tailwind's default scale is already 4px-based, so the
shipping app is accidentally compliant; this makes it deliberate.

| Step | px | Tailwind | Typical use |
|---|---|---|---|
| 0.5 | 2 | `0.5` | Hairline nudges, icon optical alignment |
| 1 | 4 | `1` | Tight inline gaps (icon ↔ label) |
| 2 | 8 | `2` | Inside small controls, pill padding |
| 3 | 12 | `3` | Compact control padding, list row gaps |
| 4 | 16 | `4` | Default gap between related elements |
| 5 | 20 | `5` | Card padding (current app default: `p-5`) |
| 6 | 24 | `6` | Gap between cards, section inner padding |
| 8 | 32 | `8` | Between sub-sections |
| 12 | 48 | `12` | Between major page sections |
| 16 | 64 | `16` | Page top/bottom breathing room |
| 20+ | 80+ | `20`+ | Marketing/landing rhythm only |

**Rule: use the scale. No arbitrary values.** `p-[13px]` is a bug. If the scale doesn't
fit, the layout is wrong, not the scale.

---

## Rules

1. **Proximity communicates relationship.** Elements that belong together are closer to
   each other than to anything else. Most "cluttered" screens are actually
   *equal-spacing* screens — everything 16px from everything.
2. **Vertical rhythm beats horizontal cleverness.** Get the vertical stack right first.
3. **Space is a valid solution to hierarchy.** Before adding a border, a card, or a color
   to separate two things — try more space. It usually wins.
4. **Padding is symmetric unless there's a reason.** Optical corrections are allowed and
   should be commented.
5. **Don't nest cards.** A card inside a card inside a card is the visual symptom of an
   unresolved information hierarchy. Use space and a subheading.
6. **Touch targets: minimum 44×44px** on any surface reachable by touch, including the
   desktop app (touchscreen laptops, and it's better for mice too). Padding counts toward
   the target; the visible box doesn't have to be 44px.

---

## Grid & layout

**Current state (provisional):** the app uses a fixed left sidebar plus a fluid content
area, with Tailwind grid utilities per page. There is no formally documented grid.

**Agreed shape:**
- **App shell:** persistent left navigation, content area to the right, page header
  inside the content area. See `components/navigation.md`.
- **Content max-width:** `[TO DECIDE]`. Recommended ~1200–1280px for dashboard/list
  screens, with reading-heavy surfaces (settings, a single lead's conversation)
  constrained tighter (~720–800px) so lines stay readable. Full-bleed tables may exceed.
- **Columns:** `[TO DECIDE]` — a 12-column grid is the conventional answer, but most of
  this product is single-column stacks and 2–4 up card rows, which don't need one. Don't
  adopt a 12-column grid ceremonially.
- **Gutters:** 24px desktop, 16px mobile. `[TO DECIDE]` — confirm against real screens.

## Breakpoints

Use Tailwind defaults unless there's a reason to differ:

| Name | Min width | Target |
|---|---|---|
| (base) | 0 | Phone — **the primary design target for the owner persona** |
| `sm` | 640px | Large phone / small tablet |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop — sidebar appears here |
| `xl` | 1280px | Desktop |
| `2xl` | 1536px | Large desktop — mostly just more margin |

**SETTLED (2026-09-12): mobile is the primary platform for the core loop**, not the
responsive afterthought. See-what-needs-me → read the context → approve or reply must be
completable one-handed, on a phone, in under two minutes. Research puts the ICP "on another
call or up a ladder", and records a 391% conversion lift from replying within one minute —
so every tap between a notification and a sent reply is measurable lost revenue. See `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md`.

Desktop-first still applies to work done sitting down: settings, workflows, analytics, bulk
import. **Say which a screen is before laying it out.**

---

## Open decisions

- `[TO DECIDE]` Content max-widths per surface type.
- `[TO DECIDE]` Whether card padding standardizes on 20px (`p-5`, as shipped) or 24px
  (`p-6`, more common at this scale). Pick one and apply it everywhere.
- `[TO DECIDE]` Page header pattern — height, whether it's sticky, what it contains.
- `[TO DECIDE]` Density modes (comfortable/compact) for the lead table. Probably not
  worth it before customers ask; noted so it isn't re-litigated from scratch.
