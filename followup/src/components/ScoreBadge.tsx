import { scoreLevel } from "@/lib/scoreThresholds";

// Score is a status, not an action — draws from the urgency-pill colors
// (coral/slate/sage), not the accent (blue) reserved for buttons/links.
//
// Keyed off the shared scoreLevel() rather than its own cut-points: this
// file used 75/45 while scoring.ts's priority used 70/40, and both render
// on the same card, so a lead at 72 showed "high priority" beside a badge
// coloured medium. See @/lib/scoreThresholds for why 70/40 won.
function scoreColor(score: number) {
  const level = scoreLevel(score);
  if (level === "high") return { bg: "var(--coral-soft)", fg: "var(--coral)" };
  if (level === "medium") return { bg: "var(--slate-soft)", fg: "var(--slate)" };
  return { bg: "var(--sage-soft)", fg: "var(--sage)" };
}

// research/product/2026-09-10-ux-simplification.md §4's terminology table:
// "Follow-up score" → "Worth chasing: high/medium/low". The number stays
// visible (genuinely useful for comparing two leads at a glance, unlike the
// rescue score's tie-break-only ordering); the tooltip leads with what it
// means to the owner, not the mechanism.
//
// It used to say "how likely this person is to buy". That is not what the
// number is: scoreLead asks the model "how urgently should they follow up
// with this lead TODAY" (openai.ts). Those come apart — a certain-to-buy
// customer who wrote an hour ago is not urgent, and a wavering one who has
// waited three days is. The label now names the quantity being measured.
function tooltip(score: number): string {
  return `Worth chasing: ${scoreLevel(score)} — how urgently this one needs a reply today, based on what they've actually written to you.`;
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
      title={tooltip(score)}
    >
      {score}
    </div>
  );
}
