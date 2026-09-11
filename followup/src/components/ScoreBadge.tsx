// Score is a status, not an action — draws from the urgency-pill colors
// (coral/slate/sage), not the accent (blue) reserved for buttons/links.
function scoreColor(score: number) {
  if (score >= 75) return { bg: "var(--coral-soft)", fg: "var(--coral)" };
  if (score >= 45) return { bg: "var(--slate-soft)", fg: "var(--slate)" };
  return { bg: "var(--sage-soft)", fg: "var(--sage)" };
}

// research/product/2026-09-10-ux-simplification.md §4's terminology table:
// "Follow-up score" → "Worth chasing: high/medium/low" — the number stays
// visible (it's genuinely useful for comparing two leads at a glance,
// unlike the rescue score's tie-break-only ordering), but the tooltip
// leads with what the number means to the owner, not the mechanism.
function scoreLevel(score: number): "high" | "medium" | "low" {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export default function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const { bg, fg } = scoreColor(score);
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-base",
  };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold tabular-nums shrink-0`}
      style={{ backgroundColor: bg, color: fg }}
      title={`Worth chasing: ${scoreLevel(score)} — how likely this person is to buy, based on what they've actually written to you.`}
    >
      {score}
    </div>
  );
}
