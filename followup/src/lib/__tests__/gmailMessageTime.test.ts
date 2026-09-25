/**
 * A Gmail message's time comes from Gmail, not from the sender
 * (daily-path sweep 2026-09-25 #8). The Date header is whatever the
 * sending machine wrote: a future date pinned a thread's "newest" message
 * and the lead's last contact ahead of now.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { gmailMessageTime } from "@/lib/integrations/gmail";

const now = new Date("2026-09-25T20:00:00Z");

describe("gmailMessageTime", () => {
  it("uses Gmail's receive time over the sender's Date header", () => {
    const received = new Date("2026-09-25T19:58:00Z").getTime();
    expect(gmailMessageTime(String(received), "Wed, 1 Jan 2031 00:00:00 +0000", now).getTime()).toBe(received);
  });

  it("never dates a message in the future, even from the header", () => {
    expect(gmailMessageTime(undefined, "Wed, 1 Jan 2031 00:00:00 +0000", now)).toEqual(now);
  });

  it("falls back to the header when Gmail gives no receive time", () => {
    expect(gmailMessageTime(null, "Thu, 25 Sep 2026 18:00:00 +0000", now)).toEqual(new Date("2026-09-25T18:00:00Z"));
  });

  it("treats an unreadable header as now rather than an Invalid Date", () => {
    expect(gmailMessageTime(undefined, "not a date", now)).toEqual(now);
    expect(gmailMessageTime("garbage", undefined, now)).toEqual(now);
  });
});
