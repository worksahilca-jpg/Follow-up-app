/**
 * A-238 (founder, 2026-10-12): an Instagram or Messenger customer is asked
 * once for their email and mobile; what they type is kept; past Meta's
 * 24 hours a follow-up goes to that email, never after a STOP in the DM and
 * never to an address another customer of the business already has; and
 * their answer to that email lands on the same customer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    message: { findFirst: vi.fn() },
    conversation: { findFirst: vi.fn(async () => null) },
    suppression: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { findEmail, findLeadByAnyEmail, findPhone, rememberDmContact, shouldAskForContact } from "@/lib/dmContact";
import { detectAutomatedReplyChannel } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  vi.resetAllMocks();
  p.message.findFirst.mockResolvedValue(null);
  p.suppression.findUnique.mockResolvedValue(null);
  p.lead.findFirst.mockResolvedValue(null);
  p.lead.findUnique.mockResolvedValue(null);
  p.lead.updateMany.mockResolvedValue({ count: 1 });
});

describe("findEmail", () => {
  it("reads the address out of a sentence, lower-cased", () => {
    expect(findEmail("sure it's Maya.Singh@Gmail.com thanks")).toBe("maya.singh@gmail.com");
  });
  it("finds nothing in words without one", () => {
    expect(findEmail("you can reach me here, or at maya at gmail")).toBeNull();
  });
});

describe("findPhone", () => {
  it.each([
    ["416-555-1234", "416-555-1234"],
    ["call me at (416) 555 1234 after 5", "(416) 555 1234"],
    ["+1 416 555 1234", "+1 416 555 1234"],
    ["my cell 4165551234", "4165551234"],
    ["+91 98765 43210", "+91 98765 43210"],
  ])("reads %s", (text, expected) => {
    expect(findPhone(text)).toBe(expected);
  });

  it.each([
    "budget is 600000-700000",
    "pre-approved for 650k",
    "moving 2026-10-12",
    "0000000000",
    "MLS W12345678",
  ])("does not read %s as a phone number", (text) => {
    expect(findPhone(text)).toBeNull();
  });
});

describe("shouldAskForContact", () => {
  const answered = [{ direction: "inbound" as const }, { direction: "outbound" as const }, { direction: "inbound" as const }];
  const none = { email: null, dmEmail: null, dmContactAskedAt: null };

  it("asks a DM customer who has been answered once and gave nothing yet", () => {
    expect(shouldAskForContact(none, answered)).toBe(true);
  });
  it("never in the very first reply", () => {
    expect(shouldAskForContact(none, [{ direction: "inbound" }])).toBe(false);
  });
  it("never twice", () => {
    expect(shouldAskForContact({ ...none, dmContactAskedAt: new Date() }, answered)).toBe(false);
  });
  it("never when their email is already known", () => {
    expect(shouldAskForContact({ ...none, dmEmail: "a@b.co" }, answered)).toBe(false);
    expect(shouldAskForContact({ ...none, email: "a@b.co" }, answered)).toBe(false);
  });
});

describe("rememberDmContact", () => {
  it("keeps the email only for a customer with no email, and the mobile, both scoped to the business", async () => {
    await rememberDmContact("biz1", "lead1", "sure, maya@x.com or 416-555-1234");
    expect(p.lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", businessId: "biz1", email: null }, data: { dmEmail: "maya@x.com" } });
    expect(p.lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", businessId: "biz1" }, data: { dmPhone: "416-555-1234" } });
  });
  it("writes nothing when they gave neither", async () => {
    await rememberDmContact("biz1", "lead1", "is it still available?");
    expect(p.lead.updateMany).not.toHaveBeenCalled();
  });
});

describe("findLeadByAnyEmail", () => {
  it("matches the customer whose email it is first", async () => {
    p.lead.findUnique.mockResolvedValue({ id: "emailLead", lastContacted: null });
    expect(await findLeadByAnyEmail("biz1", "maya@x.com")).toEqual({ id: "emailLead", lastContacted: null });
    expect(p.lead.findFirst).not.toHaveBeenCalled();
  });
  it("else the Instagram customer who gave it in a DM, in the same business", async () => {
    p.lead.findFirst.mockResolvedValue({ id: "igLead", lastContacted: null });
    expect(await findLeadByAnyEmail("biz1", "maya@x.com")).toEqual({ id: "igLead", lastContacted: null });
    expect(p.lead.findFirst.mock.calls[0][0].where).toEqual({ businessId: "biz1", email: null, dmEmail: "maya@x.com" });
  });
});

describe("detectAutomatedReplyChannel with an email given in the DM", () => {
  const ig = { id: "lead1", businessId: "biz1", email: null, phone: "ig:123", dmEmail: "maya@x.com" };
  const hoursAgo = (h: number) => ({ sentAt: new Date(Date.now() - h * 3_600_000) });
  // First read: the channel of the newest inbound message. Second: Meta's window clock.
  const lastInstagram = (h: number) => {
    p.message.findFirst.mockResolvedValueOnce({ conversation: { channel: "instagram" } }).mockResolvedValueOnce(hoursAgo(h));
  };

  it("stays on Instagram inside the 24 hours", async () => {
    lastInstagram(3);
    expect(await detectAutomatedReplyChannel(ig)).toBe("instagram");
  });
  it("moves to their email once the 24 hours have passed", async () => {
    lastInstagram(30);
    expect(await detectAutomatedReplyChannel(ig)).toBe("email");
  });
  it("never after a STOP in the DM", async () => {
    lastInstagram(30);
    p.suppression.findUnique.mockResolvedValue({ id: "s1" });
    expect(await detectAutomatedReplyChannel(ig)).toBe("instagram");
  });
  it("never when another customer of the business already has that email", async () => {
    lastInstagram(30);
    p.lead.findFirst.mockResolvedValue({ id: "otherLead" });
    expect(await detectAutomatedReplyChannel(ig)).toBe("instagram");
  });
  it("answers by email once they have written back by email", async () => {
    p.message.findFirst.mockResolvedValueOnce({ conversation: { channel: "email" } });
    expect(await detectAutomatedReplyChannel(ig)).toBe("email");
  });
  it("is unchanged for a caller that doesn't pass the business", async () => {
    lastInstagram(30);
    expect(await detectAutomatedReplyChannel({ id: "lead1", email: null, phone: "ig:123", dmEmail: "maya@x.com" })).toBe("instagram");
  });
});
