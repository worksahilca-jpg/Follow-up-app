/**
 * Glanceable urgency color — the "you shouldn't have to read anything to
 * know what needs attention" idea (monday.com's board coloring is the
 * reference point). Same 7-day cutoff getColdLeads() already uses for
 * "going cold", just exposed as a color instead of a filter, and with a
 * middle "getting stale" step so it's not just fresh/cold binary.
 */
export function urgencyColor(daysSinceContact: number): string {
  if (daysSinceContact < 3) return "var(--sage)";
  if (daysSinceContact < 7) return "var(--gold)";
  return "var(--rust)";
}
