"use client";

/**
 * Under a reply whose price the owner just filled in (A-096): ticked, the
 * figure is remembered for the next customer who asks the same thing
 * (src/lib/businessFacts.ts); unticked, this reply is not learned from.
 * Ticked by default, the founder's call (2026-10-06): the owner has just
 * typed the number and can change it in Settings any time.
 */
export function RememberPrice({
  id,
  price,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  price: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13.5px] leading-snug text-ink">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-[2px] h-4 w-4 shrink-0 disabled:opacity-60"
        style={{ accentColor: "var(--ink)" }}
      />
      <span>
        Use <span className="font-semibold">{price}</span> next time someone asks this
        <span className="mt-0.5 block text-ink-soft">Change it any time in Settings.</span>
      </span>
    </label>
  );
}
