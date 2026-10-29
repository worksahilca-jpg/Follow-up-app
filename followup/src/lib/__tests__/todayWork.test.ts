/**
 * Today (A-336, A-337): the words and the window, from records only.
 */
import { describe, expect, it } from "vitest";
import { checkedLine, comingUpRows, didRows, ownerHeading, panelSentence, quoteWords, replyWindowLeft, sendTitle, sinceLabel, sinceWindow, sinceWords, whenShort, windowWords } from "@/lib/todayWork";

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

describe("the owner's heading (A-337)", () => {
  it("counts the replies waiting for an OK, numeral first", () => {
    expect(ownerHeading({ replies: 16, others: 2, handled: 0, holdAll: true })).toEqual({ title: "16 replies need your OK", sub: "FollowUp wrote them. Read each one, then press Send." });
    expect(ownerHeading({ replies: 1, others: 0, handled: 0, holdAll: true })).toEqual({ title: "1 reply needs your OK", sub: "FollowUp wrote it. Read it, then press Send." });
  });
  it("tells a teammate who can't send who does", () => {
    expect(ownerHeading({ replies: 3, others: 0, handled: 0, holdAll: true, sendLocked: true }).sub).toBe("FollowUp wrote them. An admin on your team sends them.");
  });
  it("counts the other decisions when no reply waits", () => {
    expect(ownerHeading({ replies: 0, others: 2, handled: 0, holdAll: false }).title).toBe("2 things need you");
    expect(ownerHeading({ replies: 0, others: 1, handled: 0, holdAll: false }).title).toBe("1 thing needs you");
  });
  it("says calmly what FollowUp keeps doing when nothing waits", () => {
    expect(ownerHeading({ replies: 0, others: 0, handled: 3, holdAll: true }).title).toBe("You're done for today");
    expect(ownerHeading({ replies: 0, others: 0, handled: 3, holdAll: true }).sub).toContain("You handled 3 people today.");
    expect(ownerHeading({ replies: 0, others: 0, handled: 0, holdAll: true }).sub).toBe("Every reply FollowUp writes shows up here first. Nothing goes out until you send it.");
  });
});

describe("waiting since (A-337)", () => {
  it("is a time today, yesterday, a short weekday, then a date: never a ticking ago", () => {
    expect(sinceWords(new Date("2026-10-28T13:14:00.000Z"), now, TZ)).toBe("9:14 AM");
    expect(sinceWords(new Date("2026-10-27T20:00:00.000Z"), now, TZ)).toBe("yesterday");
    expect(sinceWords(new Date("2026-10-26T15:00:00.000Z"), now, TZ)).toBe("Mon");
    expect(sinceWords(new Date("2026-09-25T15:00:00.000Z"), now, TZ)).toBe("Sep 25");
  });
  it("quotes their own words on one line", () => {
    expect(quoteWords("Can I see it\n this weekend?")).toBe("“Can I see it this weekend?”");
    expect(quoteWords(null)).toBeNull();
    expect(quoteWords("   ")).toBeNull();
  });
});

describe("FollowUp's sentence (A-337)", () => {
  it("says what it did on its own while the owner was away, zeros left out", () => {
    expect(panelSentence({ sinceLook: true, since: "since 9:40 PM", answered: 2, booked: 1, caught: 1, yourSends: 0, weekAnswered: 9 })).toBe(
      "While you were away, FollowUp answered 2 people, booked 1 call and caught 1 new customer."
    );
    expect(panelSentence({ sinceLook: false, since: "today", answered: 1, booked: 0, caught: 2, yourSends: 4, weekAnswered: 0 })).toBe("Today, FollowUp answered 1 person and caught 2 new customers.");
  });
  it("names the replies it sent for the owner when it did nothing on its own", () => {
    expect(panelSentence({ sinceLook: true, since: "since 9:40 PM", answered: 0, booked: 0, caught: 0, yourSends: 3, weekAnswered: 9 })).toBe("Since 9:40 PM, FollowUp sent 3 replies for you.");
  });
  it("says nothing new plainly, with the week when it adds something", () => {
    expect(panelSentence({ sinceLook: true, since: "since 9:40 PM", answered: 0, booked: 0, caught: 0, yourSends: 0, weekAnswered: 23 })).toBe(
      "Nothing new since 9:40 PM. This week, 23 customers got an answer."
    );
    expect(panelSentence({ sinceLook: false, since: "today", answered: 0, booked: 0, caught: 0, yourSends: 0, weekAnswered: 0 })).toBe("Nothing new today.");
    expect(panelSentence({ sinceLook: true, since: "this week", answered: 0, booked: 0, caught: 0, yourSends: 0, weekAnswered: 5 })).toBe("Nothing new this week.");
  });
});

describe("the checked line (A-337)", () => {
  it("says when it last checked, as a time, with no dot", () => {
    expect(checkedLine(["Gmail", "", "Instagram"], new Date("2026-10-28T17:41:00.000Z"), now, TZ)).toBe("Checked Gmail and Instagram at 1:41 PM.");
  });
  it("says an old Gmail check as Gmail's alone", () => {
    expect(checkedLine(["Gmail", "Instagram"], new Date("2026-10-03T15:00:00.000Z"), now, TZ)).toBe("Gmail last checked on Oct 3. Watching Instagram.");
    expect(checkedLine(["Gmail"], new Date("2026-10-28T13:00:00.000Z"), now, TZ)).toBe("Gmail last checked at 9:00 AM.");
  });
  it("claims no time it doesn't have", () => {
    expect(checkedLine(["Outlook", "Instagram"], null, now, TZ)).toBe("Watching Outlook and Instagram.");
    expect(checkedLine(["", ""], null, now, TZ)).toBeNull();
  });
});

describe("coming up (A-337)", () => {
  it("lists FollowUp's next steps and the owner's calls, soonest first, each person once", () => {
    const rows = comingUpRows(
      [
        { leadId: "p", name: "Priya Kaur", at: new Date("2026-10-29T14:00:00.000Z"), what: "Check-in 2 of 4", unless: true },
        { leadId: "p", name: "Priya Kaur", at: new Date("2026-10-30T14:00:00.000Z"), what: "Last check-in", unless: true },
        { leadId: "e", name: "Ethan Wu", at: new Date("2026-10-28T20:00:00.000Z"), what: "A reply to their message", unless: false },
      ],
      [{ id: "b1", leadId: "r", name: "Raj Mehta", at: new Date("2026-10-31T15:00:00.000Z") }],
      now,
      TZ,
      () => "Saturday at 11 am"
    );
    expect(rows.map((r) => [r.title, r.sub, r.when])).toEqual([
      ["Replies to Ethan", null, "Later today"],
      ["Checks in with Priya", "Check-in 2 of 4, if Priya stays quiet", "Tomorrow"],
      ["Your call with Raj", null, "Saturday at 11 am"],
    ]);
    expect(rows[2].href).toBe("/calls");
  });
});

describe("Instagram's deadline, only near the end (A-028, A-338)", () => {
  const wrote = new Date("2026-10-28T18:00:00.000Z");
  const at = (h: number) => new Date(wrote.getTime() + h * 3_600_000);
  it("says the hours left from 20 hours until the window shuts", () => {
    expect(replyWindowLeft("instagram", wrote, at(21))).toBe(3);
    expect(replyWindowLeft("messenger", wrote, at(20))).toBe(4);
    expect(windowWords(replyWindowLeft("instagram", wrote, at(21)))).toBe("3 h left to reply");
    expect(windowWords(replyWindowLeft("instagram", wrote, at(23.5)))).toBe("Under 1 h left to reply");
  });
  it("says nothing before then, after it shuts, or for other apps", () => {
    expect(replyWindowLeft("instagram", wrote, at(5))).toBeNull();
    expect(replyWindowLeft("instagram", wrote, at(24))).toBeNull();
    expect(replyWindowLeft("email", wrote, at(21))).toBeNull();
    expect(replyWindowLeft("instagram", null, at(21))).toBeNull();
    expect(windowWords(null)).toBeNull();
  });
});
