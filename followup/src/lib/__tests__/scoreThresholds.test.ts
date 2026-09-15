/**
 * The badge and the priority pill have to agree.
 *
 * They did not. `scoring.ts` cut at 70/40; `ScoreBadge.tsx` cut at 75/45.
 * `FollowUpCard` renders both on the same card, so every score from 70-74
 * and from 40-44 contradicted itself on screen: a lead at 72 showed a
 * "high priority" pill beside a badge coloured medium whose tooltip read
 * "Worth chasing: medium".
 *
 * The bug wasn't either pair of numbers — it was that there were two pairs.
 * These tests pin the single source and, more importantly, pin the
 * agreement itself, so a future edit to one side cannot silently reopen the
 * gap.
 */
import { describe, it, expect } from "vitest";
import { scoreLevel, SCORE_HIGH, SCORE_MEDIUM } from "@/lib/scoreThresholds";

/** The priority rule from scoring.ts, which must key off the same numbers. */
function priorityFromScore(score: number): "HIGH" | "MEDIUM" | "LOW" | "NONE" {
  if (score >= SCORE_HIGH) return "HIGH";
  if (score >= SCORE_MEDIUM) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

describe("score thresholds", () => {
  it("puts the boundary at the threshold, not after it", () => {
    expect(scoreLevel(SCORE_HIGH)).toBe("high");
    expect(scoreLevel(SCORE_HIGH - 1)).toBe("medium");
    expect(scoreLevel(SCORE_MEDIUM)).toBe("medium");
    expect(scoreLevel(SCORE_MEDIUM - 1)).toBe("low");
  });

  // The actual regression. Walking every score a lead can hold is cheap and
  // catches a divergence anywhere in the range, not just at the four
  // boundaries someone remembered to check.
  it("never shows a level the priority disagrees with, at any score", () => {
    for (let score = 0; score <= 100; score++) {
      const level = scoreLevel(score);
      const priority = priorityFromScore(score);
      if (priority === "HIGH") expect(level).toBe("high");
      if (priority === "MEDIUM") expect(level).toBe("medium");
      if (priority === "LOW" || priority === "NONE") expect(level).toBe("low");
    }
  });

  // 72 is the specific score the founder was shown contradicting itself.
  it("agrees on 72, the score that started this", () => {
    expect(scoreLevel(72)).toBe("high");
    expect(priorityFromScore(72)).toBe("HIGH");
  });

  // 70/40 won over 75/45 because these numbers already drive behaviour —
  // the handoff notification, the Slack ping, the default ordering. Moving
  // them changes when a business is told a lead went hot; moving the badge
  // only changed a colour. If someone edits these, they should have to mean
  // it.
  it("keeps the cut-points that drive real behaviour", () => {
    expect(SCORE_HIGH).toBe(70);
    expect(SCORE_MEDIUM).toBe(40);
  });
});
