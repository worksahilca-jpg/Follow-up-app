---
name: followup-design
description: FollowUp's design system and UX rules in one page — tokens, type, spacing, components, tone, the Laws of UX as they apply here, accessibility, and the draw-first workflow. Use before any UI, copy or visual change in followup/ (screens, components, emails, landing). It is the quick reference; design-brain/ stays the authority.
---

# FollowUp design

FollowUp makes sure a small business never loses a customer because nobody followed up.
The person using it is a busy owner (a realtor, a contractor), mostly on a phone, between
jobs, who is not a software person. Every screen is judged by one question: **could they
act on it in five seconds with one thumb, and would they trust it with their customers?**

**This file is a summary.** If it disagrees with `design-brain/`, the design brain wins, and
the live values in `followup/src/app/globals.css` win over both. Before proposing anything,
read `design-brain/decisions/approved.md` (follow it) and `design-brain/decisions/rejected.md`
(never re-propose what's there). Root `CLAUDE.md` has the full loop.

## Feel

Trustworthy, calm, plain, precise. Never: scammy styles, gradients for decoration, neon,
glassmorphism, rounded-card soup, sparkle icons, "AI-powered" badges, fake urgency, bulk
"blast" affordances, startup-template looks. AI is an invisible capability, never a
personality: every automated action says what happened, why, and what the owner can do.

## Tokens (light only; the app ground stays white, A-090)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#fdfcfc` | Page |
| `--card` / `--card-2` | `#ffffff` / `#f5f3f1` | Boxes / quiet fills |
| `--ink` | `#0a0a0a` | Text, and the accent (the system is monochrome: black is the action colour) |
| `--ink-soft` / `--ink-faint` | `#57534e` / `#736e68` | Secondary text / meta |
| `--line` | `#e7e5e2` | Borders, dividers |
| `--coral` (+ `-soft`) | `#b32a44` | Errors, something broken |
| `--sage` (+ `-soft`) | `#0d6e3c` | Done, fine |
| `--state-needs` | `#c96a1b` | The "your turn" **dot only** (3.7:1, never text) |
| `--radius-box` | `16px` | Boxes; buttons and chips are full pills |

Status colours are semantic, never decoration. Soft tint as background, strong shade as
text. No new colour without the founder's yes (`[TO DECIDE]` values are proposals).

## Type

- **Public Sans** for everything in the app (headings heavier and tighter). **IBM Plex Mono**
  only for small uppercase labels ("WRITTEN BY FOLLOWUP · WAITS FOR YOUR OK").
  **Instrument Serif italic** only for one word in a marketing headline, never in the app.
- Ladder: page title `text-3xl` (one per screen, from `PageHeader`), section `text-xl`,
  box title `text-lg` or `text-sm font-medium` inside Settings boxes.
- Body 15–16px; nothing a decision depends on below 14px; 12–13px only for meta. Customer
  messages and replies are the biggest text on a card.

## Spacing and layout

- Tailwind 4px scale; box padding `p-5`; 16px between related things, 24px between boxes,
  48px between sections. Lay out with `gap`, not stacked margins.
- **Mobile-first.** Base styles are the phone (390×844 is the test size); the sidebar appears
  at `lg` (1024px). On the phone: bottom nav with three places (Today, Customers, Settings),
  one decision per screen, keep every word but cut pictures (brand principle 4).

## Components (reuse before inventing)

- **Box**: `box p-5`, white, 1px `--line`, 16px radius, no shadow. Settings sections are boxes
  with a title line, one sentence of why, then the content.
- **Buttons**: one solid black pill per screen on the phone (Send). Secondary is an outlined
  pill (Edit, Add something). Everything else is a quiet text link (Later · Don't send ·
  Already spoke). Never two black buttons side by side.
- **Reply card** (Today): customer's words → the draft under a small mono label → at most one
  dot line saying why it waits → Send / Edit → quiet links. Edit happens in place.
- **Rows**: their words, the wait, a chevron; the whole row opens. Lists show about eight,
  then "Show N more". Swipe left on a phone row = Later (never Send).
- **Notes on a card**: an orange-dot line = the owner must act; a plain line = information.
  One sentence, the customer's first name, no jargon.
- **Lists in Settings**: label (small, soft), value (the owner's words), where it came from
  ("Learned from your reply to Owen, Oct 3"), one Edit or Undo link per row.

## Words

Plain, short, one idea per sentence. "Customer", not "lead". Say what happened and what to
do ("Add the price, then send. FollowUp never guesses one."). Errors say the fix. No
exclamation marks, no "Oops", no em-dash-heavy robot sentences, no "AI".

## Laws of UX, as FollowUp applies them

- **Hick's law** (fewer choices, faster decisions): one decision per phone screen; one black
  button; secondary actions as three quiet links, not more buttons. Settings switches say one
  line each (A-094).
- **Fitts's law** (big, close targets are faster): Send is full-width-ish and in thumb reach;
  every target at least 44×44px; whole rows are tappable; swipe for the common "not now".
- **Jakob's law** (people expect what they know): list → detail, Mail-style swipe, pills and
  links that look like the apps they already use. No invented gestures or keyboard-first
  layouts (R-002).
- **Miller's law** (people hold a handful of things): about eight rows before "Show N more";
  one reason line per card, not a stack of badges; three places in the nav.
- Also used: **Von Restorff** (the one black button stands out), **Tesler** (FollowUp absorbs
  the complexity: it drafts, checks and waits so the owner only decides), **Doherty**
  (keep taps fast: the 2026-10-05 phone check measured Today at 0.2–0.4s, Customers 0.5s).

## Accessibility (WCAG 2.2 AA, every time)

- Text contrast at least 4.5:1 (3:1 for large text and UI edges). The orange dot is never the
  only signal: the sentence beside it carries the meaning.
- Every control has a visible label or `aria-label`; inputs have `<label for>`; focus is
  visible; nothing is hover-only; respect `prefers-reduced-motion` (motion only explains a
  change of state, A-048).
- Touch targets 44×44px minimum; no text below 12px; the page never scrolls sideways.

## Workflow (how a change gets made)

1. Read `approved.md` and `rejected.md`; find what already covers it.
2. **Draw first** on the real app: run it locally, inject the proposed change into the live
   page with Playwright, screenshot phone (390×844) and desktop, and show before/after.
   Behaviour or UI changes need the founder's yes before code.
3. Build with existing tokens and components. Verify in a real browser at both sizes: open
   it, click through the flow, screenshot, fix what's wrong.
4. Review against `design-brain/workflows/design-review.md`; say honestly what is weak.
5. Record it: `approved.md` (what specifically), `design-decisions.md` (dated), and any
   rejection with its principle in `rejected.md`.
