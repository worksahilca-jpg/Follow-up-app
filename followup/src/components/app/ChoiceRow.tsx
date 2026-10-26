"use client";

/**
 * One of "Who sends your replies?" (A-253): a radio the whole row presses. Also the two answers to "When a customer
 * says 'not now'" (A-329), in Settings and on Today. Goes inside a radiogroup box.
 */
export default function ChoiceRow({
  checked,
  title,
  sub,
  first = false,
  disabled,
  onSelect,
}: {
  checked: boolean;
  title: string;
  sub?: string;
  first?: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={"flex min-h-[60px] w-full items-start gap-3.5 px-4 py-4 text-left hover:bg-card-2 disabled:cursor-not-allowed disabled:hover:bg-transparent" + (first ? "" : " border-t border-line-2")}
    >
      <span
        aria-hidden
        className="mt-px h-[22px] w-[22px] shrink-0 rounded-full"
        style={checked ? { border: "7px solid var(--ink)" } : { border: "1.5px solid var(--ink-faint)" }}
      />
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold">{title}</span>
        {sub && <span className="mt-0.5 block text-[14px] text-ink-soft">{sub}</span>}
      </span>
    </button>
  );
}
