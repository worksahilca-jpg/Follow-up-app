"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Chart colours that follow the app's tokens in both device themes.
 *
 * Recharts writes `fill`/`stroke` straight onto SVG presentation attributes,
 * which do not resolve `var(--x)`, so the values have to be real colour
 * strings. Rather than keep a hand-maintained copy of globals.css here (the
 * previous approach, which went stale twice), this reads the live tokens off
 * the document and re-reads them whenever the device's colour scheme flips,
 * so a chart on the charcoal ground is drawn with the charcoal theme's ink
 * and lines, and the same chart on white with the light theme's.
 *
 * On the server, and during the client's hydration pass, the light set is
 * used so markup matches; the client then re-renders with the real scheme.
 */
export type ChartColors = {
  /** Axis tick text. --ink-soft */
  axis: string;
  /** Grid lines. --line, as an opaque approximation */
  grid: string;
  /** The main series. --ink */
  primary: string;
  /** A second series beside the first. --ink-soft */
  secondary: string;
  /** Money, kept as the one meaning-carrying hue. --gold */
  money: string;
  /** Alias of primary, kept for older call sites. */
  ink: string;
  tooltip: { backgroundColor: string; border: string; borderRadius: number; fontSize: number; color: string };
};

const LIGHT: ChartColors = {
  axis: "#52525b",
  grid: "#e4e4e7",
  primary: "#0a0a0a",
  secondary: "#71717a",
  money: "#a35904",
  ink: "#0a0a0a",
  tooltip: { backgroundColor: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: 13, color: "#0a0a0a" },
};

const DARK: ChartColors = {
  axis: "#9ca3af",
  grid: "#3a3a3d",
  primary: "#ffffff",
  secondary: "#9ca3af",
  money: "#e0a53a",
  ink: "#ffffff",
  tooltip: { backgroundColor: "#27272a", border: "1px solid #3a3a3d", borderRadius: 8, fontSize: 13, color: "#ffffff" },
};

type Scheme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getSnapshot = (): Scheme => (window.matchMedia(QUERY).matches ? "dark" : "light");
const getServerSnapshot = (): Scheme => "light";

function read(scheme: Scheme): ChartColors {
  const base = scheme === "dark" ? DARK : LIGHT;
  if (typeof window === "undefined") return base;
  // Prefer the live token values so a future token change reaches charts
  // without touching this file; fall back to the set above per role.
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const ink = v("--ink", base.ink);
  const soft = v("--ink-soft", base.axis);
  const card = v("--card", base.tooltip.backgroundColor);
  return {
    axis: soft,
    grid: base.grid,
    primary: ink,
    secondary: soft,
    money: v("--gold", base.money),
    ink,
    tooltip: { ...base.tooltip, backgroundColor: card, color: ink },
  };
}

export function useChartColors(): ChartColors {
  const scheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => read(scheme), [scheme]);
}
