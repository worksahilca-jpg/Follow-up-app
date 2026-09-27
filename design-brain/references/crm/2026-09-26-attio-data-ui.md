# Attio — how CRM data can look light

**Source:** attio.com app (tables, record pages, email). Studied from written descriptions only. attio.com,
Mobbin (paid plan) and every screenshot/analysis site were blocked from this session, so nothing here
comes from looking at a screen directly. See "Evidence" below.
**Category:** crm
**Added:** 2026-09-26
**Added by:** Claude, at the founder's request: *"i want ui reference from Attio … how clean CRM data can
look and also observe typography, but we have the good one. Spacing, tables, contacts, inbox, line
interface, restraint colors, and how they make complicated data feel light."*
**Status:** INBOX. The founder hasn't reacted yet. Ask him for 3–4 real screenshots (table, record page, email) to check this against.
**Files:** link only

---

## What is interesting

- **Lines, not boxes.** Hairline 1px borders separate rows, columns and panels. Hierarchy comes from
  subtle borders rather than heavy shadows. Cards and inputs use a thin inner border for a "precise"
  edge. The table reads as a sheet of ruled paper, not a stack of cards.
- **Colour only where it means something.** The chrome (sidebar, headers, toolbars) is neutral grey on white.
  Colour appears in small status pills (soft tint, darker text), avatars, and one action colour.
  Everything else is ink and grey.
- **Two sizes, two weights, two inks.** Dense tables stay legible because the type does the hierarchy.
  Values are in dark ink, labels and meta in grey, and metadata/tags are set as small caps-style labels so
  they can be scanned. Interface type is Inter; we keep Public Sans and Plex Mono (the founder: "we have
  the good one").
- **Views over one data set.** The same records appear as table, list, kanban or timeline.
- **Record pages.** A sidebar lists attributes as label → value rows. The main panel has tabs
  (Overview, Activity, Notes, Emails) and an activity timeline of every interaction, filterable by type.
  Up to six key attributes can be pinned as "highlights" at the top.
- **Reviewers' words.** "Minimal interface, thoughtful typography"; "so simple" it was confusing at first,
  then refreshing.

## UX principle

Complicated data feels light when **each element does exactly one job**. A row is one person. A pill
is one state. A grey label names a value but never competes with it. You scan the grey, and only
the ink demands reading.

## Visual principle

- One line weight for structure, a lighter one inside tables.
- Tint the background of a *selected* thing, never of every thing.
- Colour is reserved for state. Numbers and times are tabular and right-aligned, and empty cells stay empty.
- Outer spacing is generous, even when rows are dense.

## Interaction principle

Selecting a row opens the record beside the table instead of navigating away, so the list and the person
are on screen together. Most edits happen in place, in the cell. (Unverified here: specific hover and
empty states.)

## Whose user is this?

Attio's user is a sales or ops person **at a desk, all day, on a laptop**, often keyboard-first. FollowUp's
user is an owner **between jobs, often on a phone**, who isn't a software person (brand principle 4).
So: take the restraint, the lines and the colour logic. **Don't** take density for its own sake, keyboard
shortcuts as a feature, custom attributes, or the table as the phone layout. On a phone, a table becomes a
list (brand principle 4, phone rule).

## What FollowUp could learn

1. **App: the people list** can be a ruled table on desktop. Name, channel, last message, how long
   they've waited, and one state pill. Pill colour lives only in a small dot.
2. **App: a person's page** can be attributes as label → value rows, including **"Why it's here"**
   (brand principle 3: what happened and why), then the conversation as a quiet timeline, then the held reply.
3. **Landing page:** the product fragments (the Today list, "One list", the held card) can pick up the
   same ruled-line treatment, so the page shows a product that looks as calm as it claims.

## Evidence (graded: B = search summary of a named source, C = unattributed or vendor claim)

- B: Attio Help Center: record pages, highlight widgets, tabs, sidebar attributes; activity timeline
  with filters. https://attio.com/help/reference/managing-your-data/records/configure-record-pages ·
  https://attio.com/changelog/2026/new-activity-timeline
- C: third-party design-token write-ups (DesignMD, explainx): Inter, subtle 1px borders, small caps
  labels, soft pastel status pills. They disagree on the brand colour (black vs teal vs blue), so no
  colour values are taken from them. https://www.designmd.co/d/attio-com ·
  https://explainx.ai/designs/whyashthakker-design-md-templates-skills/attio/design-md
- C: reviews (Stacksync, Hack'celeration, G2): "minimal", "clean", "so simple". https://www.stacksync.com/blog/attio-crm-2025-review-features-pros-cons-pricing ·
  https://hackceleration.com/labs/review/attio
- Not reached (blocked): saasui.design, design.withfudge.com, opensourceceo.com, Mobbin.
