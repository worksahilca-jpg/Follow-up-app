/**
 * Today that shows FollowUp working (A-336): the words and the window, from records only.
 */
import { describe, expect, it } from "vitest";
import { checkInsWords, didRows, sendTitle, sinceLabel, sinceWindow, waitingWords, watchingWords, whenShort, workSentence } from "@/lib/todayWork";

const TZ = "America/Toronto";
// Wednesday Oct 28, 2026, 2:00 PM Toronto.
const now = new Date("2026-10-28T18:00:00.000Z");
// Midnight Toronto, Oct 28 (EDT, UTC-4).
const dayStart = new Date("2026-10-28T04:00:00.000Z");

describe("the window (since you last looked)", () => {
  it("starts at the owner's last visit before today", () => {
    const prev = new Date("2026-10-28T01:40:00.000Z"); // 9:40 PM Oct 27 Toronto
    const w = sinceWindow(prev, dayStart, now);
    expect(w).toEqual({ since: prev, sinceLook: true });
    expect(sinceLabel(w.since, w.sinceLook, now, TZ)).toBe("since 9:40 PM");
  });
  it("starts at midnight on a first visit, and says today", () => {
    const w = sinceWindow(null, dayStart, now);
    expect(w).toEqual({ since: dayStart, sinceLook: false });
    expect(sinceLabel(w.since, w.sinceLook, now, TZ)).toBe("today");
  });
  it("names the weekday within a week, and caps at a week", () => {
    const sat = new Date("2026-10-24T22:00:00.000Z");
    expect(sinceLabel(sinceWindow(sat, dayStart, now).since, true, now, TZ)).toBe("since Saturday");
    const old = new Date("2026-10-01T12:00:00.000Z");
    const w = sinceWindow(old, dayStart, now);
    expect(w.since.getTime()).toBe(now.getTime() - 7 * 86_400_000);
    expect(sinceLabel(w.since, w.sinceLook, now, TZ)).toBe("this week");
  });
});

describe("what a send was", () => {
  it("says answered, checked in, or sent your reply", () => {
    expect(sendTitle({ automated: true, trigger: "instant_ack", leadName: "Zoe Khan" })).toBe("Answered Zoe");
    expect(sendTitle({ automated: true, trigger: "unanswered", leadName: "Zoe Khan" })).toBe("Answered Zoe");
    expect(sendTitle({ automated: true, trigger: "silence", leadName: "Mia Gill" })).toBe("Checked in with Mia");
    expect(sendTitle({ automated: true, trigger: "sequence", leadName: "Mia Gill" })).toBe("Checked in with Mia");
    expect(sendTitle({ automated: true, trigger: null, leadName: "Ethan Wu" })).toBe("Wrote to Ethan");
    expect(sendTitle({ automated: false, trigger: "manual", leadName: "Raj Mehta" })).toBe("Sent your reply to Raj");
  });
});

describe("the rows", () => {
  const since = new Date("2026-10-28T01:40:00.000Z");
  const sayWhen = () => "Saturday at 11 am";
  it("lists sends, bookings and new customers, newest first, with the words sent", () => {
    const rows = didRows(
      {
        sent: [
          { id: "s1", leadId: "l1", leadName: "Zoe Khan", message: "Thanks for reaching out.  Which days suit you for a showing?", sentAt: new Date("2026-10-28T12:12:00.000Z"), automated: true, trigger: "instant_ack" },
          { id: "s0", leadId: "l9", leadName: "Old One", message: "Before the window", sentAt: new Date("2026-10-27T12:00:00.000Z"), automated: true, trigger: "instant_ack" },
        ],
        booked: [{ id: "b1", leadId: "l2", leadName: "Raj Mehta", scheduledAt: new Date("2026-10-31T15:00:00.000Z"), createdAt: new Date("2026-10-28T12:30:00.000Z") }],
        caught: [{ id: "l3", name: "Ethan Wu", source: "Instagram", createdAt: new Date("2026-10-28T13:20:00.000Z") }],
      },
      since,
      now,
      TZ,
      sayWhen
    );
    expect(rows.map((r) => r.title)).toEqual(["New customer from Instagram: Ethan Wu", "Booked a call with Raj, Saturday at 11 am", "Answered Zoe"]);
    expect(rows[2].sub).toBe("“Thanks for reaching out. Which days suit you for a showing?”");
    expect(rows[2].when).toBe("8:12 AM");
  });
  it("says when in the owner's day: a time today, yesterday, the weekday", () => {
    expect(whenShort(new Date("2026-10-28T12:12:00.000Z"), now, TZ)).toBe("8:12 AM");
    expect(whenShort(new Date("2026-10-28T01:40:00.000Z"), now, TZ)).toBe("Yesterday");
    expect(whenShort(new Date("2026-10-24T22:00:00.000Z"), now, TZ)).toBe("Saturday");
  });
});

describe("the sentence", () => {
  it("is FollowUp's report, leaving out zeros", () => {
    expect(workSentence({ sinceLook: true, answered: 4, caught: 0, booked: 1, forOk: 16 })).toBe(
      "Since you last looked, FollowUp answered 4 people, booked 1 call and wrote 16 replies for your OK."
    );
    expect(workSentence({ sinceLook: false, answered: 1, caught: 2, booked: 0, forOk: 0 })).toBe("Today, FollowUp answered 1 person and caught 2 new customers.");
  });
  it("says what waits when nothing was done, and nothing when there is nothing", () => {
    expect(workSentence({ sinceLook: true, answered: 0, caught: 0, booked: 0, forOk: 1 })).toBe("FollowUp has 1 reply waiting for your OK.");
    expect(workSentence({ sinceLook: true, answered: 0, caught: 0, booked: 0, forOk: 0 })).toBeNull();
  });
});

describe("on it", () => {
  it("names who it waits on, how long, and what it does next", () => {
    const w = waitingWords(
      [
        { leadId: "a", name: "Ethan Wu", sentAt: new Date("2026-10-28T16:00:00.000Z") },
        { leadId: "b", name: "Ava Singh", sentAt: new Date("2026-10-27T15:00:00.000Z") },
        { leadId: "c", name: "Mason Roy", sentAt: new Date("2026-10-25T15:00:00.000Z") },
        { leadId: "d", name: "Lena D", sentAt: new Date("2026-10-24T15:00:00.000Z") },
      ],
      now,
      TZ,
      { name: "Ethan Wu", when: "tomorrow" }
    );
    expect(w).toEqual({ title: "Waiting on 4 replies", sub: "Ethan (2 h), Ava (yesterday), Mason (3 days) and 1 more. If Ethan stays quiet, FollowUp checks in tomorrow." });
    expect(waitingWords([], now, TZ, null)).toBeNull();
  });
  it("lists the check-ins coming up by day", () => {
    const c = checkInsWords([
      { day: "Tomorrow", items: [{ leadId: "p", name: "Priya K" }] },
      { day: "Thursday", items: [{ leadId: "o", name: "Omar H" }, { leadId: "p", name: "Priya K" }] },
    ]);
    expect(c).toEqual({ title: "2 check-ins coming up", sub: "Priya tomorrow · Omar Thursday", total: 2 });
    expect(checkInsWords([])).toBeNull();
  });
  it("names what it watches", () => {
    expect(watchingWords(["Gmail", "", "Instagram"])).toBe("Watching Gmail and Instagram");
    expect(watchingWords(["", ""])).toBeNull();
  });
});
