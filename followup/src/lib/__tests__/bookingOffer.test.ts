/**
 * The booking link in a reply (A-263): only when FollowUp offered to meet
 * and the customer said yes; the draft that carries it is held with a
 * reason the card can say.
 */
import { describe, it, expect } from "vitest";
import { bookingLinkPromptBlock, bookingLinkReason, carriesBookingLink, isBookingLinkReason, saidYesToMeeting } from "@/lib/bookingOffer";
import { plainHoldReason } from "@/lib/holdReasons";
import type { Message } from "@/lib/types";

const m = (direction: "inbound" | "outbound", body: string, trigger: string | null = null): Message =>
  ({ id: `${direction}-${body.length}`, direction, body, date: "2026-10-15T14:00:00.000Z", trigger } as unknown as Message);

describe("they said yes to meeting", () => {
  it("after an offer to see the home, visit, call or meet", () => {
    expect(saidYesToMeeting([m("inbound", "Is 12 Elm still available?"), m("outbound", "It is. Would you like to see it this week?"), m("inbound", "Yes, I'd love to see it. Weekends are easier for us.")])).toBe(true);
    expect(saidYesToMeeting([m("outbound", "Happy to come by and take a look at the house. Would that help?"), m("inbound", "Sure, that works.")])).toBe(true);
    expect(saidYesToMeeting([m("outbound", "Shall we hop on a call?"), m("inbound", "ok")])).toBe(true);
  });

  it("not on a no, a maybe, a yes to something else, or when nothing was offered", () => {
    expect(saidYesToMeeting([m("outbound", "Would you like to see it this week?"), m("inbound", "Not yet, we'll talk to the bank first.")])).toBe(false);
    expect(saidYesToMeeting([m("outbound", "Would you like to see it this week?"), m("inbound", "Maybe later, not sure about our dates.")])).toBe(false);
    expect(saidYesToMeeting([m("outbound", "The price is $879k. Does that fit?"), m("inbound", "Yes, that works.")])).toBe(false);
    expect(saidYesToMeeting([m("outbound", "We can see it on Saturday."), m("inbound", "Yes please")])).toBe(false);
    expect(saidYesToMeeting([m("outbound", "Would you like to see it?"), m("inbound", "Yes"), m("outbound", "Great, here are times.")])).toBe(false);
  });

  it("ignores the instant acknowledgement when looking for the offer", () => {
    expect(saidYesToMeeting([m("outbound", "Would you like to see it this week?"), m("outbound", "Got your message, back shortly.", "instant_ack"), m("inbound", "Yes!")])).toBe(true);
  });
});

describe("the draft that carries the link", () => {
  it("is known by the customer's own booking page, and held with the card's reason", () => {
    expect(carriesBookingLink("Pick a time here: https://followupbase.io/book/lead1", "lead1")).toBe(true);
    expect(carriesBookingLink("Pick a time here: https://followupbase.io/book/lead2", "lead1")).toBe(false);
    expect(bookingLinkReason("Raj")).toBe("FollowUp added your booking link because Raj said yes to meeting. Raj picks a time from your free hours");
    expect(isBookingLinkReason(bookingLinkReason("Raj"))).toBe(true);
    expect(isBookingLinkReason("nobody picked up the call")).toBe(false);
    // Said in its own words on the card, not as the generic "it says what's available" check.
    expect(plainHoldReason(bookingLinkReason("Raj"), { firstName: "Raj", topic: "other" })).toBe("FollowUp added your booking link because Raj said yes to meeting. Raj picks a time from your free hours.");
  });

  it("tells the writer its one job, with the link unchanged", () => {
    const block = bookingLinkPromptBlock("https://followupbase.io/book/lead1");
    expect(block).toContain("https://followupbase.io/book/lead1 .");
    expect(block).toMatch(/ask no other question/);
    expect(bookingLinkPromptBlock(null)).toBe("");
  });
});
