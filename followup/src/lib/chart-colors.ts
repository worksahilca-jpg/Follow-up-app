/**
 * Chart color constants matching the current theme (src/app/globals.css).
 * Recharts' fill/stroke/tick props don't read CSS custom properties, so
 * these have to be kept in sync by hand whenever the theme changes —
 * shared here so every chart does that in one place instead of each
 * component carrying its own copy.
 */
export const CHART_AXIS_COLOR = "#4b515c"; // --ink-soft
export const CHART_GRID_COLOR = "#e6e9ee"; // --line

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#ffffff", // --card
  border: "1px solid #e6e9ee", // --line
  borderRadius: 8,
  fontSize: 13,
};

export const CHART_PRIMARY = "#3b82c4"; // --rust
export const CHART_INK = "#14181f"; // --ink
export const CHART_SECONDARY = "#64748b"; // --slate
export const CHART_SUCCESS = "#16a34a"; // --sage
export const CHART_MONEY = "#d97706"; // --gold
