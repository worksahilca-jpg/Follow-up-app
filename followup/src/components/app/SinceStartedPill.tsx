import type { SinceStarted } from "@/lib/sinceStarted";

/**
 * The owner's own numbers at the top of Today (A-307): "Since you started · 2 answered · 1 booked · 1 won" in one thin
 * white pill. Top right on a computer, under the greeting on a phone, where the three share the width.
 */
export default function SinceStartedPill({ counts }: { counts: SinceStarted }) {
  const items: [number, string][] = [
    [counts.answered, "answered"],
    [counts.booked, "booked"],
    [counts.won, "won"],
  ];
  return (
    <div className="mt-3 flex flex-col gap-1.5 lg:mt-0 lg:items-end">
      <span id="since-started" className="text-[12px] text-ink-faint">
        Since you started
      </span>
      <ul
        aria-labelledby="since-started"
        className="flex items-center rounded-full border border-line bg-card px-1 py-1.5 lg:inline-flex"
      >
        {items.map(([n, label], i) => (
          <li
            key={label}
            className={
              "flex flex-1 items-baseline justify-center gap-1.5 px-3.5 py-0.5 lg:flex-none" +
              (i > 0 ? " border-l border-line" : "")
            }
          >
            <span className="text-[17px] font-semibold tabular-nums text-ink">{n}</span>
            <span className="text-[13.5px] text-ink-soft">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
