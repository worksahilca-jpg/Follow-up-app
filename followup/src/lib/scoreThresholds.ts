/**
 * The score cut-points, in one place because they were in two and the two
 * disagreed.
 *
 * `scoring.ts`'s priorityFromScore cut at 70/40; `ScoreBadge.tsx` cut at
 * 75/45. Both render on the same card (FollowUpCard renders ScoreBadge and
 * PriorityPill side by side), so a lead scoring 72 showed a "high priority"
 * pill next to a badge coloured medium whose tooltip read "Worth chasing:
 * medium". Every score from 70-74 and 40-44 contradicted itself on screen.
 *
 * 70/40 wins, not 75/45, because those are the numbers that already drive
 * real behaviour — Lead.priority decides the handoff notification, the
 * Slack ping and the default ordering. Moving them would change when a
 * business gets told a lead went hot; moving the badge only changes a
 * colour. When two sources disagree, the one with consequences is the one
 * to keep.
 *
 * The numbers themselves are still undocumented and inherited — no
 * research backs 70 over 65. That is worth settling, but it is a separate
 * question from making the screen agree with itself.
 *
 * Deliberately has NO imports, like @/lib/pricing: ScoreBadge is a client
 * component, and anything reaching @/lib/db would pull Prisma into the
 * browser bundle (see the fix for issue #93).
 */

export const SCORE_HIGH = 70;
export const SCORE_MEDIUM = 40;

export type ScoreLevel = "high" | "medium" | "low";

export function scoreLevel(score: number): ScoreLevel {
  if (score >= SCORE_HIGH) return "high";
  if (score >= SCORE_MEDIUM) return "medium";
  return "low";
}
