import type { LucideIcon } from "lucide-react";

export default function StatCard({
  label,
  value,
  accent,
  accentSoft,
  icon: Icon,
}: {
  label: string;
  // A plain string for anything already formatted (currency, in
  // particular — CountUp has no formatter of its own); a CountUp element
  // for a bare integer that should tick up on load instead of sitting
  // there static.
  value: string | React.ReactNode;
  accent?: string;
  accentSoft?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
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
