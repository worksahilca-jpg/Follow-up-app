# FollowUp — Vault Index

A map of content for everything that governs how FollowUp looks, behaves, and gets built.
Open this repo as an Obsidian vault and start here — everything below links out to the
real file, and Obsidian's graph/backlinks panel will show how they connect from there.

## The two documents that outrank everything else

- `[[PRODUCT_DIRECTION]]` (`followup/PRODUCT_DIRECTION.md`) — wins on **what to build**.
- `[[../CLAUDE.md|CLAUDE.md]]` (repo root) — wins on **how it should look, feel, and behave**.
  Points here, into `design-brain/`, for the actual system.

## Start here every session

1. `[[README|design-brain/README.md]]` — what lives where, and when to read it.
2. `[[brand-principles]]` — the standing rules (trustworthy, calm, never a spam tool).
3. `[[rejected]]` — **read before proposing anything.** The highest-value file in the vault.
4. `[[approved]]` — what's locked in, and why.

## Decisions — the living memory

- `[[approved]]` — what the founder said yes to (A-001, A-002, …)
- `[[rejected]]` — what the founder said no to, plus the 16 standing rejections (S-01–S-16)
- `[[design-decisions]]` — the full reasoning log, every decision whether or not the founder
  was in the room (D-001–D-013 so far)

These three cross-link each other inline (e.g. `[[design-decisions#^D-010|D-010]]` cites
`[[approved#^A-002|A-002]]`) — follow a link, or open Obsidian's **Graph view** to see the
whole decision history as one connected structure instead of three separate logs.

## The design system (`brand/`)

`[[brand-principles]]` · `[[visual-direction]]` · `[[color-system]]` · `[[typography]]` ·
`[[spacing]]` · `[[surfaces]]` · `[[iconography]]` · `[[motion]]`

## Components (`components/`)

`[[buttons]]` · `[[cards]]` · `[[forms]]` · `[[modals]]` · `[[navigation]]` ·
`[[notifications]]` · `[[states]]` · `[[tables]]` · `[[badges]]`

## Workflows — the processes that produce new screens

`[[design-workflow]]` · `[[design-review]]` · `[[design-to-code]]` ·
`[[reference-workflow]]` · `[[research-workflow]]`

## Research

- `[[research-log]]` — dated log of every research pass
- `research/ux-patterns/` — findings like `2026-09-12-trust-and-approval-for-automated-follow-up.md`
- `research/competitors/`, `research/interaction-patterns/` — currently stubs, filled as real
  input arrives (empty is honest — see `[[README|design-brain/README.md]]`'s "Status of this brain")

## References

`[[reference-index]]` catalogs everything in `references/<category>/` — study these for
principles, never copy them directly (see the standing rejection `[[rejected#^S-16|S-16]]`).

## The app itself

- `followup/AGENTS.md` — stack, build commands, file layout (Next.js specifics)
- `followup/src/app/globals.css` — the tokens this whole system currently ships as

---

*This index is a map, not a duplicate of the content — each link goes to the real,
authoritative file. If the vault's structure changes, update this file's links, not the
other way around.*
