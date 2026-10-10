import type { ActivityItem } from "@/lib/activity";

/**
 * "What FollowUp did today" under an all-caught-up Today (A-220): the
 * newest few things from the activity record (src/lib/activity.ts), said
 * as one line each with the customer's name. Only what the record holds,
 * so it can never claim work that didn't happen; nothing when nothing did.
 */
export type DidToday = {
  id: string;
  kind: "sent" | "held" | "stopped" | "finished";
  title: string;
  sub: string | null;
};

/** How many rows Today shows; the rest are one tap away on the activity page. */
export const DID_TODAY_SHOWN = 3;

const EXCERPT = 70;

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return `“${flat.length > EXCERPT ? `${flat.slice(0, EXCERPT).trimEnd()}…` : flat}”`;
}

/**
 * `items` newest first, as getActivityFeed returns them; `since` is the
 * start of the owner's own day. "Needs you now" notices are left out:
 * they are about the owner, not something FollowUp did.
 */
export function didToday(items: ActivityItem[], since: Date): DidToday[] {
  const rows: DidToday[] = [];
  for (const item of items) {
    if (Date.parse(item.occurredAt) < since.getTime()) continue;
    const name = item.leadName;
    if (!name) continue;
    const first = name.split(" ")[0] || name;
    if (item.type === "automated_send") {
      rows.push({ id: item.id, kind: "sent", title: `Wrote to ${name}`, sub: item.detail ? excerpt(item.detail) : null });
    } else if (item.type === "held") {
      rows.push({ id: item.id, kind: "held", title: `Held a reply for ${name}`, sub: item.detail });
    } else if (item.type === "sequence_paused") {
      rows.push({ id: item.id, kind: "stopped", title: `Stopped checking in with ${name}`, sub: `${first} wrote back.` });
    } else if (item.type === "sequence_completed") {
      rows.push({ id: item.id, kind: "finished", title: `Finished the check-ins with ${name}`, sub: null });
    }
    if (rows.length === DID_TODAY_SHOWN) break;
  }
  return rows;
}
