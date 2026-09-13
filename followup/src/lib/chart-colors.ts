/**
 * Chart color constants matching the current theme (src/app/globals.css).
 * Recharts' fill/stroke/tick props don't read CSS custom properties, so
 * these have to be kept in sync by hand whenever the theme changes —
 * shared here so every chart does that in one place instead of each
 * component carrying its own copy. Updated 2026-09-13 for the navy/blue
 * "Award Direction" reskin (D-010/A-002) — the previous values here were
 * already stale (a leftover blue from an even earlier accent period, never
 * updated when the accent moved to amber), so these now match the real,
 * current tokens rather than perpetuating that drift.
 */
export const CHART_AXIS_COLOR = "#46566b"; // --ink-soft
export const CHART_GRID_COLOR = "#e2e4e7"; // --line, as a solid approximation (Recharts can't use the rgba() token directly)

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#ffffff", // --card
  border: "1px solid #e2e4e7", // --line
  borderRadius: 8,
  fontSize: 13,
};

export const CHART_PRIMARY = "#2a5cdb"; // --rust
export const CHART_INK = "#0b1f33"; // --ink
export const CHART_SECONDARY = "#56677e"; // --slate
export const CHART_SUCCESS = "#0d6e3c"; // --sage
export const CHART_MONEY = "#a35904"; // --gold
