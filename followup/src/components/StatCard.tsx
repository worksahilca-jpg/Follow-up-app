import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  accent,
  accentSoft,
  icon: Icon,
}: {
  label: string;
  value: string;
  accent?: string;
  accentSoft?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{label}</p>
        {Icon && (
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: accentSoft ?? "var(--slate-soft)", color: accent ?? "var(--slate)" }}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <p className="font-display text-3xl mt-2" style={{ color: accent ?? "var(--ink)" }}>
        {value}
      </p>
    </div>
  );
}
