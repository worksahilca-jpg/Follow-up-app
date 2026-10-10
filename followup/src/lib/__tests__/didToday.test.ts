/**
 * "What FollowUp did today" under an all-caught-up Today (A-220): only
 * today's record, one line each, by name, three at most.
 */
import { describe, it, expect } from "vitest";
import { didToday, DID_TODAY_SHOWN } from "@/lib/didToday";
import type { ActivityItem } from "@/lib/activity";

const since = new Date("2026-10-10T04:00:00Z");
const item = (over: Partial<ActivityItem>): ActivityItem => ({
  id: "x",
  type: "automated_send",
  leadId: "l1",
  leadName: "Mia Gill",
  message: "",
  detail: null,
  occurredAt: "2026-10-10T15:00:00Z",
  ...over,
});

describe("didToday", () => {
  it("says each kind in plain words, with the customer's name", () => {
    const rows = didToday(
      [
        item({ id: "a", type: "automated_send", detail: "Hi Mia,\n\nwhen are you hoping to move?" }),
        item({ id: "b", type: "held", leadName: "Owen Shah", detail: "Because they asked about a price." }),
        item({ id: "c", type: "sequence_paused", leadName: "Lucas Brar" }),
      ],
      since
    );
    expect(rows).toEqual([
      { id: "a", kind: "sent", title: "Wrote to Mia Gill", sub: "“Hi Mia, when are you hoping to move?”" },
      { id: "b", kind: "held", title: "Held a reply for Owen Shah", sub: "Because they asked about a price." },
      { id: "c", kind: "stopped", title: "Stopped checking in with Lucas Brar", sub: "Lucas wrote back." },
    ]);
  });

  it("leaves out yesterday, notices about the owner, and anyone without a name", () => {
    const rows = didToday(
      [
        item({ id: "old", occurredAt: "2026-10-10T03:59:00Z" }),
        item({ id: "notice", type: "rapid_engagement" }),
        item({ id: "gone", leadName: null }),
      ],
      since
    );
    expect(rows).toEqual([]);
  });

  it("shows three at most and shortens a long message", () => {
    const long = "word ".repeat(40);
    const rows = didToday(Array.from({ length: 6 }, (_, i) => item({ id: String(i), detail: long })), since);
    expect(rows).toHaveLength(DID_TODAY_SHOWN);
    expect(rows[0]!.sub!.endsWith("…”")).toBe(true);
    expect(rows[0]!.sub!.length).toBeLessThan(80);
  });
});
