"use client";

/**
 * The app's one switch.
 *
 * The same 44×24 track and 20px knob was copy-pasted into six places — five
 * in Settings, one in ImproveFollowUpToggle — each with its own inline
 * `translateX(22px)`. Identical geometry, six chances to drift, and a
 * seventh needed every time a rule is added.
 *
 * ## What changed beyond deduplication
 *
 * Founder, 2026-09-21: *"can we fix all those switches to good 3D switches
 * with proper, smooth animation?"* The old one had `transition-colors` on
 * the track and `transition-transform` on the knob, both on the global
 * 150ms linear-ish default. Correct, and completely inert — the knob
 * arrived without ever feeling like it moved.
 *
 * Three things make it read as a physical control:
 *
 * 1. **Overshoot.** The knob travels on `cubic-bezier(.34,1.56,.64,1)`,
 *    which carries ~6% past its destination and settles back. That tiny
 *    bounce is the whole difference between "the value changed" and
 *    "something moved".
 * 2. **Squash.** While pressed, the knob stretches along its direction of
 *    travel and the track compresses a hair. Momentum, borrowed from how a
 *    real switch behaves under a thumb.
 * 3. **Depth, carefully.** The knob gets one soft drop shadow and the track
 *    one inset shadow, so the knob sits *above* a recess. That is as far as
 *    this goes: `design-brain/decisions/rejected.md` S-07 rules out 3D as
 *    ornament and `CLAUDE.md` bans "gratuitous 3D" outright, so there are no
 *    bevels, no gloss, no gradients. Depth here is affordance — it says
 *    "press me" — not decoration.
 *
 * `design-brain/brand/motion.md` names "a toggle moving" as exactly what
 * motion is for, and caps most UI transitions at 120–200ms. The travel is
 * 200ms; the overshoot does the expressive work rather than a longer
 * duration, and `prefers-reduced-motion` removes it entirely.
 *
 * ## Colour
 *
 * Unchanged, and deliberately so. The knob is always the inverse of its
 * track — `--ink` on the `--line` track when off, `--on-accent` on the
 * `--accent` track when on — which is what keeps a monochrome system
 * legible in both themes without a third colour.
 */
export default function Switch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** Required: a switch with no accessible name is a mystery button. */
  label: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      disabled={disabled}
      className="switch shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
      data-on={checked ? "true" : undefined}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}
