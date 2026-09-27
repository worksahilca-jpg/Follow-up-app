/**
 * Small pieces the canvas app boards repeat (design-decisions 2026-09-27):
 * the initials circle, the short "5d / 4h / 20m" age, and the small grey
 * group label.
 */
export function Initials({ name, size = 44 }: { name: string; size?: number }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden
      className="shrink-0 inline-flex items-center justify-center rounded-full border border-line font-semibold text-ink-soft"
      style={{ width: size, height: size, background: "var(--accent-soft)", fontSize: size >= 40 ? 14 : 11 }}
    >
      {letters || "?"}
    </span>
  );
}

export function shortAge(from: Date | string, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - new Date(from).getTime());
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** "Waiting 5 h", "Waiting 20 min", "Waiting 3 days", as the Today board writes it. */
export function waitingFor(from: Date | string, now: Date = new Date()): string {
  const min = Math.max(1, Math.floor((now.getTime() - new Date(from).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h`;
  return `${Math.floor(h / 24)} days`;
}

/** The small grey label above a group ("Needs you", "Earlier"). */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-ink-faint">{children}</div>;
}

/** The mono eyebrow the desktop boards use ("NEEDS YOU · 4"). */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-ink-faint">{children}</span>;
}
