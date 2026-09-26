import { formatSpan } from "@/lib/activation";

/**
 * Today's numbers in one line (design brain A-045): "This week: 11
 * customers answered · 2 came back · 1 booked · 18 of 21 sent without
 * changing a word". It replaces the three "This week" tiles (A-042) and the
 * separate "sent as written" sentence (A-043).
 *
 * A part is left out when it is zero, and the whole line is null when
 * every part is, so the screen never shows a row of zeros.
 */
export function weekLine(w: {
  answered: number;
  cameBack: number;
  booked: number;
  asWritten: number;
  sent: number;
  // A-050: the median time customers heard back, from our own records.
  heardBackMs?: number | null;
}): string | null {
  const parts: string[] = [];
  if (w.heardBackMs != null) parts.push(`customers heard back in ${formatSpan(w.heardBackMs)}`);
  if (w.answered > 0) parts.push(`${w.answered} ${w.answered === 1 ? "customer" : "customers"} answered`);
  if (w.cameBack > 0) parts.push(`${w.cameBack} came back`);
  if (w.booked > 0) parts.push(`${w.booked} booked`);
  if (w.sent > 0) parts.push(`${w.asWritten} of ${w.sent} sent without changing a word`);
  return parts.length ? `This week: ${parts.join(" · ")}` : null;
}
