// Score is a status, not an action — draws from the urgency-pill colors
// (coral/slate/sage), not the accent violet reserved for buttons/links.
function scoreColor(score: number) {
  if (score >= 75) return { bg: "var(--coral-soft)", fg: "var(--coral)" };
  if (score >= 45) return { bg: "var(--slate-soft)", fg: "var(--slate)" };
  return { bg: "var(--sage-soft)", fg: "var(--sage)" };
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
      title={`Follow-up score: ${score}/100`}
    >
      {score}
    </div>
  );
}
