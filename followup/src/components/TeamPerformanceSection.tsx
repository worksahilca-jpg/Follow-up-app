import type { TeamBreakdownRow } from "@/lib/analytics-data";
import { formatCurrency } from "@/lib/demo-data";

/**
 * One row per teammate: how much they're carrying and how much of it has
 * gone quiet. Only ever rendered for a business with more than one user —
 * see the guard in analytics/page.tsx — so there's no "team of one" case
 * to handle here.
 */
export default function TeamPerformanceSection({ members }: { members: TeamBreakdownRow[] }) {
  const sorted = [...members].sort((a, b) => b.activeRevenue - a.activeRevenue);

  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden">
      <div className="grid grid-cols-[1fr,auto,auto,auto] gap-4 px-5 py-3 border-b border-line text-xs font-medium text-ink-soft">
        <span>Teammate</span>
        <span className="text-right">Active leads</span>
        <span className="text-right">Overdue</span>
        <span className="text-right">Active revenue</span>
      </div>
      {sorted.map((m) => (
        <div key={m.userId} className="grid grid-cols-[1fr,auto,auto,auto] gap-4 px-5 py-3 border-b border-line last:border-0 items-center">
          <span className="text-sm font-medium truncate">{m.name}</span>
          <span className="text-sm text-right">{m.activeCount}</span>
          <span
            className="text-sm text-right font-medium"
            style={{ color: m.overdueCount > 0 ? "var(--coral)" : "var(--ink-soft)" }}
          >
            {m.overdueCount}
          </span>
          <span className="text-sm text-right font-medium" style={{ color: "var(--gold)" }}>
            {formatCurrency(m.activeRevenue)}
          </span>
        </div>
      ))}
    </div>
  );
}
