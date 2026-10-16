/**
 * Activity's words (A-270): what FollowUp did, one plain sentence per row, the customer's name on the row already.
 */
import type { ActivityItem } from "@/lib/activity";
import { firstSentence } from "@/lib/openProblems";

const firstOf = (name: string | null) => (name ? name.trim().split(/\s+/)[0] : "");

/** "Nina", "Nina and Kofi", "Nina, Kofi and 3 more". */
export function namesLine(names: string[]): string {
  const firsts = names.map((n) => firstOf(n) || n);
  if (firsts.length <= 2) return firsts.join(" and ");
  if (firsts.length === 3) return `${firsts[0]}, ${firsts[1]} and ${firsts[2]}`;
  return `${firsts[0]}, ${firsts[1]} and ${firsts.length - 2} more`;
}

/** What happened, in one plain sentence (the name is on the row already). */
export function activityLine(item: Pick<ActivityItem, "type" | "message">): string {
  switch (item.type) {
    case "automated_send":
      return "FollowUp answered on its own:";
    case "sequence_paused":
      return "Wrote back, so FollowUp stopped the check-ins.";
    case "sequence_completed":
      return "FollowUp finished the check-ins. No reply yet.";
    case "rapid_engagement":
      return "Was writing back and forth with you.";
    default:
      return firstSentence(item.message);
  }
}
