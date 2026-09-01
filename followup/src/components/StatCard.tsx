export default function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-card px-5 py-4">
      <p className="text-sm text-ink-soft">{label}</p>
      <p
        className="font-display text-3xl mt-1"
        style={{ color: accent ?? "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  );
}
