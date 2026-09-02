/**
 * Chart color constants matching the current theme (src/app/globals.css).
 * Recharts' fill/stroke/tick props don't read CSS custom properties, so
 * these have to be kept in sync by hand whenever the theme changes —
 * shared here so every chart does that in one place instead of each
 * component carrying its own copy.
 */
export const CHART_AXIS_COLOR = "#a1a1aa"; // --ink-soft
export const CHART_GRID_COLOR = "#333338"; // --line

export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "#242429", // --card
  border: "1px solid #333338", // --line
  borderRadius: 8,
  fontSize: 13,
};

export const CHART_PRIMARY = "#a78bfa"; // --rust
export const CHART_INK = "#f4f4f5"; // --ink
export const CHART_SECONDARY = "#38bdf8"; // --slate
export const CHART_SUCCESS = "#4ade80"; // --sage
export const CHART_MONEY = "#fbbf24"; // --gold
