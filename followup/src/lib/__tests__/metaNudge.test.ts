/**
 * The Instagram and Messenger next-day follow-up (A-304): the plan's first follow-up goes inside Meta's 24-hour
 * window, aimed at 20 hours after the customer's last message, inside the send hours, never later than 23 hours and
 * never sooner than 4 hours after our reply. Times below are Toronto (EDT, UTC−4 in October 2026).
 */
import { describe, it, expect } from "vitest";
import { followUpState, metaNudgeAt, stepHint, type TimelineMessage } from "@/lib/followUpPlans";
import { metaNudgeHoldReason } from "@/lib/automation";
import { encodeQuickReplyPayload } from "@/lib/quickReplies";

const H = 3_600_000;
const D = 24 * H;
const TZ = "America/Toronto";
/** Toronto wall-clock time on a day in October 2026, as epoch ms. */
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour + 4, minute);
const t = (direction: "inbound" | "outbound", ms: number, quickReplyPayload: string | null = null): TimelineMessage => ({ direction, at: ms, trigger: null, quickReplyPayload });
const toronto = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, day: "numeric", hour: "numeric", minute: "2-digit", hour12: false }).format(new Date(ms));

describe("when it goes", () => {
  it("20 hours after their message, when that is inside the send hours", () => {
    // They wrote at 3pm, we answered at 3:05pm: the next day at 11am.
    expect(metaNudgeAt(at(14, 15), at(14, 15, 5), TZ)).toBe(at(15, 11));
  });

  it("when 20 hours lands at night, the last evening hour before it", () => {
    // They wrote at 1am, we answered at 8:05am: 20 hours is 9pm, after the send hours. 7pm the same day instead.
    expect(toronto(metaNudgeAt(at(14, 1), at(14, 8, 5), TZ)!)).toBe(toronto(at(14, 19)));
  });

  it("first thing in the morning when our reply was late in the evening", () => {
    // They wrote at 10am, we answered at 8pm: 6am is too early, 8am is still inside their 24 hours.
    expect(metaNudgeAt(at(14, 10), at(14, 20), TZ)).toBe(at(15, 8));
  });

  it("never sooner than 4 hours after our reply, and none when we answered too late in their window", () => {
    const n = metaNudgeAt(at(14, 1), at(14, 15), TZ)!;
    expect(n).toBeGreaterThanOrEqual(at(14, 19));
    expect(metaNudgeAt(at(14, 10), at(15, 7), TZ)).toBeNull();
  });

  it("never past 23 hours, so the hourly run still sends it inside the window", () => {
    for (let h = 0; h < 24; h++) {
      const theirs = at(14, h);
      const n = metaNudgeAt(theirs, theirs + 5 * 60_000, TZ);
      if (n !== null) {
        expect(n - theirs).toBeLessThanOrEqual(23 * H);
        // Inside the send hours, and still inside them an hour later, when the run comes round.
        const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(new Date(n))) % 24;
        expect(hour).toBeGreaterThanOrEqual(8);
        expect(hour).toBeLessThan(20);
      }
    }
  });
});

describe("in the plan", () => {
  const thread = [t("inbound", at(14, 15)), t("outbound", at(14, 15, 5))];

  it("an Instagram customer's first follow-up is due inside Meta's window, not a day after our reply", () => {
    const dm = followUpState(thread, at(14, 15, 5), {}, { metaDm: true }, at(15, 9), 45, TZ)!;
    expect(dm.dueAt).toBe(at(15, 11));
    expect(dm.step).toBe(0);
    expect(dm.kind).toBe("open");
    const email = followUpState(thread, at(14, 15, 5), {}, {}, at(15, 9), 45, TZ)!;
    expect(email.dueAt).toBe(at(14, 15, 5) + D);
  });

  it("then the plan carries on as drawn: the next one on day 3", () => {
    const after = [...thread, t("outbound", at(15, 11))];
    const s = followUpState(after, at(15, 11), {}, { metaDm: true }, at(15, 12), 45, TZ)!;
    expect(s.step).toBe(1);
    expect(s.dueAt).toBe(at(14, 15, 5) + 3 * D);
  });

  it("not after they tapped Not now, and not when they wrote last", () => {
    const notNow = [t("inbound", at(14, 15), encodeQuickReplyPayload({ touch: "t1", question: "q", answer: "not now", exit: true })), t("outbound", at(14, 15, 5))];
    const s = followUpState(notNow, at(14, 15, 5), {}, { metaDm: true }, at(15, 9), 45, TZ)!;
    expect(s.dueAt).not.toBe(at(15, 11));
    expect(followUpState([t("inbound", at(14, 15))], at(14, 15), {}, { metaDm: true }, at(15, 9), 45, TZ)).toBeNull();
  });

  it("the reply writer is told it is less than a day, not 0 days", () => {
    expect(stepHint({ step: 0, total: 5, kind: "open", final: false }, 0)).toContain("less than a day ago");
  });
});

describe("why it waits for the owner", () => {
  it("says when Instagram closes the chat, in the owner's time", () => {
    const now = new Date(at(15, 11));
    // Their message was 20 hours ago: the chat closes at 3pm.
    expect(metaNudgeHoldReason("Priya", "instagram", 20, TZ, now)).toBe(
      "Priya went quiet on Instagram after your reply, and Instagram closes the chat at 3:00 PM. Send this before then; after it, only you can write"
    );
    expect(metaNudgeHoldReason("Sam", "messenger", null, TZ, now)).toBe("Sam went quiet on Messenger after your reply");
  });
});
