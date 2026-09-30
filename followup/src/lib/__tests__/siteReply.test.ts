/**
 * "Reply on {site}" (backlog b018, design brain A-075): which customers get
 * it, where "Open {site}" goes, and that such a draft never joins a
 * "Send all". FollowUp can't send inside a lead site, so a Send there
 * could only fail.
 */
import { describe, it, expect } from "vitest";
import { siteReplyFor, siteReplyFrom } from "@/lib/siteReply";
import { isSafeToSendInBulk } from "@/lib/approvalGroups";
import type { Message } from "@/lib/types";

const inbound = (body: string, id = "m1"): Message => ({ id, direction: "inbound", channel: "email", body, date: "2026-09-30T14:14:00Z" });

describe("siteReplyFor", () => {
  it("is the site card for a customer a lead site passed on, with no email", () => {
    const lead = {
      email: "",
      viaSite: "Thumbtack",
      viaSiteUrl: "https://www.thumbtack.com/pro-inbox/messages/1",
      conversation: [inbound("Name: Dana Whitfield\nPhone: (555) 010-4471\nDetails: deep clean")],
    };
    expect(siteReplyFor(lead)).toEqual({
      name: "Thumbtack",
      url: "https://www.thumbtack.com/pro-inbox/messages/1",
      phone: "(555) 010-4471",
    });
  });

  it("falls back to the site itself when the notice had no link, and reads the newest message for the number", () => {
    const lead = {
      email: "",
      viaSite: "HomeStars",
      viaSiteUrl: null,
      conversation: [inbound("Phone: (555) 010-1111", "old"), inbound("New message, no number", "new")],
    };
    expect(siteReplyFor(lead)).toEqual({ name: "HomeStars", url: "https://www.homestars.com/", phone: null });
  });

  it("is nothing for a normal customer, or once FollowUp has their email", () => {
    expect(siteReplyFor({ email: "jane@example.com", viaSite: null, viaSiteUrl: null, conversation: [] })).toBeNull();
    expect(siteReplyFor({ email: "dana@example.com", viaSite: "Thumbtack", viaSiteUrl: null, conversation: [] })).toBeNull();
    expect(siteReplyFrom({ email: null, viaSite: null }, "Phone: 555 010 2222")).toBeNull();
  });
});

describe("a lead-site draft in Today", () => {
  const routine = { reason: "Your account holds every automated message for your OK.", draftRiskLevel: "low", draftMessage: "Thanks, got it." };

  it("is never in a \"Send all\"", () => {
    expect(isSafeToSendInBulk({ ...routine, site: null })).toBe(isSafeToSendInBulk(routine));
    expect(isSafeToSendInBulk({ ...routine, site: { name: "Kijiji", url: "https://www.kijiji.ca/", phone: null } })).toBe(false);
  });
});
