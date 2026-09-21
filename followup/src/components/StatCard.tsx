import type { LucideIcon } from "lucide-react";

/**
 * A single figure with its label.
 *
 * Rebuilt to the founder's A/B calibration (approved.md A-006). Three things
 * changed and each has a reason beyond taste:
 *
 * 1. **The value is always --ink.** It used to render in the card's accent, so
 *    "At risk right now" was a large coral number at the top of the highest-
 *    traffic screen. That is manufactured urgency: a count is information, not
 *    a severity signal, and A-005 already settled the same argument for money.
 *    The colour moves to a 3px rail on the card's edge, where it marks the card
 *    without shouting the number.
 * 2. **The tinted icon square is gone.** A 32px pastel rounded square holding a
 *    lucide glyph is the single most recognisable "generic SaaS dashboard"
 *    component there is (S-15), and it carried no information the label didn't.
 *    The `icon` prop is still accepted so call sites don't all have to change
 *    in one commit, but nothing renders it.
 * 3. **No border, a real shadow, tighter padding** — the same surface as
 *    ItemBox, so a stat row and a list below it read as one system.
 *
 * The two-line label reserve stays: without it, a card whose label wraps pushes
 * its value down and throws the whole row's baselines out.
 */
export default function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  // A plain string for anything already formatted (currency, in particular —
  // CountUp has no formatter of its own); a CountUp element for a bare integer
  // that should tick up on load instead of sitting there static.
  value: string | React.ReactNode;
  /** Status tone for the edge rail. Omitted means no rail. */
  accent?: string;
  /** Accepted and ignored — see note 2 above. */
  accentSoft?: string;
  /** Accepted and ignored — see note 2 above. */
  icon?: LucideIcon;
}) {
  return (
    <div
      className="relative overflow-hidden box p-4 transition-shadow hover:[box-shadow:var(--shadow-box-hover)]"
    >
      {accent && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} />
      )}
      <p className="text-sm text-ink-soft leading-tight min-h-[2.25rem]">{label}</p>
      <p className="font-display text-3xl mt-2 tabular-nums">{value}</p>
    </div>
  );
}
