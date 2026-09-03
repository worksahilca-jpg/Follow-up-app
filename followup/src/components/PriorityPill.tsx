import { Priority } from "@/lib/types";

// The accent violet is reserved for buttons/links/focus states — priority
// is a status, so it draws from the same low-saturation red/amber/gray
// family as the rest of the urgency system, never the brand accent.
const config: Record<Priority, { label: string; bg: string; fg: string }> = {
  high: { label: "High priority", bg: "var(--coral-soft)", fg: "var(--coral)" },
  medium: { label: "Medium priority", bg: "var(--slate-soft)", fg: "var(--slate)" },
  low: { label: "Low priority", bg: "var(--sage-soft)", fg: "var(--sage)" },
  none: { label: "No action needed", bg: "var(--line)", fg: "var(--ink-soft)" },
};

export default function PriorityPill({ priority }: { priority: Priority }) {
  const c = config[priority];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}
