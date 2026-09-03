/**
 * Chart color constants matching the current theme (src/app/globals.css).
 * Recharts' fill/stroke/tick props don't read CSS custom properties, so
 * these have to be kept in sync by hand whenever the theme changes —
 * shared here so every chart does that in one place instead of each
 * component carrying its own copy.
 */
export const CHART_AXIS_COLOR = "#71717a"; // --ink-soft
export const CHART_GRID_COLOR = "#e4e4e7"; // --line

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#ffffff", // --card
  border: "1px solid #e4e4e7", // --line
  borderRadius: 8,
  fontSize: 13,
};

export const CHART_PRIMARY = "#7c3aed"; // --rust
export const CHART_INK = "#18181b"; // --ink
export const CHART_SECONDARY = "#64748b"; // --slate
export const CHART_SUCCESS = "#16a34a"; // --sage
export const CHART_MONEY = "#d97706"; // --gold
