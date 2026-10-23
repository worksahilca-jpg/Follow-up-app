/**
 * Step 2 of the self-improving plan (research/product/2026-10-23-self-improving-loop.md): what the owner did with each
 * draft FollowUp wrote, and what the customer did next, with the founder's windows (3 days to reply, 14 to book).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    followUp: { findMany: vi.fn() },
    auditEvent: { findMany: vi.fn() },
    aiDecision: { findMany: vi.fn() },
    lead: { findMany: vi.fn() },
    booking: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    suppression: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));

import { editSize, outcomeOf, ownerActionOf, REPLY_WINDOW_DAYS, BOOKING_WINDOW_DAYS } from "@/lib/decisionOutcome";
import { loadDraftOutcomes, summarizeDraftOutcomes } from "@/lib/decisionOutcomeData";

const sent = new Date("2026-10-23T12:00:00Z");
const later = (days: number) => new Date(sent.getTime() + days * 24 * 60 * 60 * 1000);

describe("editSize", () => {
  it("is 0 for a draft sent as written, whatever the spacing, case or punctuation", () => {
    expect(editSize("Yes, it's still available!", "yes its still available")).toBe(0);
    expect(editSize("", "")).toBe(0);
  });

  it("is small for one word fixed, and 1 for a reply written from scratch", () => {
    expect(editSize("one two three four five six seven eight nine ten", "one two three four five six seven eight nine eleven")).toBe(0.1);
    expect(editSize("Would you like to see it this week?", "Call me tomorrow at noon please")).toBe(1);
  });
});

describe("ownerActionOf", () => {
  it("tells sent by itself, sent as written, edited, rewritten and not sent apart", () => {
    expect(ownerActionOf({ automated: true, editSize: 0 })).toBe("sent_by_itself");
    expect(ownerActionOf({ automated: false, editSize: 0 })).toBe("sent_as_written");
    expect(ownerActionOf({ automated: false, editSize: 0.2 })).toBe("edited");
    expect(ownerActionOf({ automated: false, editSize: 0.5 })).toBe("rewritten");
    expect(ownerActionOf({ dismissed: true })).toBe("not_sent");
  });
});

describe("outcomeOf", () => {
  it("uses the founder's windows: 3 days to reply, 14 to book", () => {
    expect([REPLY_WINDOW_DAYS, BOOKING_WINDOW_DAYS]).toEqual([3, 14]);
  });

  it("is waiting, never no, until the reply window closes", () => {
    expect(outcomeOf({ sentAt: sent, now: later(2) })).toMatchObject({ reply: "waiting", booking: "waiting", summary: "waiting" });
  });

  it("is a reply within 3 days, and quiet once 3 days pass with none", () => {
    expect(outcomeOf({ sentAt: sent, repliedAt: later(1), now: later(5) })).toMatchObject({ reply: "yes", booking: "waiting", summary: "replied" });
    expect(outcomeOf({ sentAt: sent, now: later(4) })).toMatchObject({ reply: "no", booking: "waiting", summary: "quiet" });
    expect(outcomeOf({ sentAt: sent, repliedAt: later(5), now: later(6) }).reply).toBe("no");
  });

  it("puts a booking within 14 days above a reply, and a no or a stop above both", () => {
    expect(outcomeOf({ sentAt: sent, repliedAt: later(1), bookedAt: later(10), now: later(20) })).toMatchObject({ booking: "yes", summary: "booked" });
    expect(outcomeOf({ sentAt: sent, bookedAt: later(15), now: later(20) })).toMatchObject({ booking: "no", summary: "quiet" });
    expect(outcomeOf({ sentAt: sent, repliedAt: later(1), saidNoAt: later(1), now: later(5) }).summary).toBe("said_no");
    expect(outcomeOf({ sentAt: sent, saidNoAt: later(1), stoppedAt: later(2), now: later(5) }).summary).toBe("stopped");
  });

  it("counts only what happened after this message", () => {
    const before = new Date(sent.getTime() - 60_000);
    expect(outcomeOf({ sentAt: sent, repliedAt: before, saidNoAt: before, stoppedAt: before, bookedAt: before, now: later(1) })).toMatchObject({
      reply: "waiting",
      booking: "waiting",
      saidNo: false,
      stopped: false,
    });
  });
});

describe("loadDraftOutcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.followUp.findMany.mockResolvedValue([
      { responseId: "r1", leadId: "l1", sentAt: sent, automated: false, editSize: 0 },
      { responseId: "r2", leadId: "l2", sentAt: sent, automated: true, editSize: 0 },
    ]);
    prisma.auditEvent.findMany.mockResolvedValue([
      { targetId: "l3", createdAt: sent, meta: { responseId: "r3" } },
      { targetId: "l4", createdAt: sent, meta: { thanksOnly: true } },
    ]);
    prisma.aiDecision.findMany.mockResolvedValue([
      { responseId: "r1", purpose: "draft_reply", modelUsed: "gpt-4o-mini-2024-07-18", lessonsHash: "h1" },
      { responseId: "r2", purpose: "draft_reply", modelUsed: "gpt-4o-mini-2024-07-18", lessonsHash: "h1" },
    ]);
    prisma.lead.findMany.mockResolvedValue([
      { id: "l1", businessId: "b1", email: "sam@example.com", phone: null, saidNoAt: null },
      { id: "l2", businessId: "b1", email: null, phone: "ig:12345", saidNoAt: null },
      { id: "l3", businessId: "b1", email: null, phone: null, saidNoAt: null },
    ]);
    prisma.booking.findMany.mockResolvedValue([{ leadId: "l1", createdAt: later(4) }]);
    prisma.message.findMany.mockResolvedValue([{ sentAt: later(1), conversation: { leadId: "l1" } }]);
    prisma.suppression.findMany.mockResolvedValue([{ businessId: "b1", channel: "instagram", address: "12345", createdAt: later(1) }]);
  });

  it("joins each draft to the AI call that wrote it, what the owner did, and what the customer did", async () => {
    const rows = await loadDraftOutcomes(later(-1), later(20));
    expect(rows.map((r) => [r.responseId, r.purpose, r.ownerAction, r.outcome.summary])).toEqual([
      ["r1", "draft_reply", "sent_as_written", "booked"],
      ["r2", "draft_reply", "sent_by_itself", "stopped"],
      ["r3", null, "not_sent", "quiet"],
    ]);
    expect(summarizeDraftOutcomes(rows)).toMatchObject({
      total: 3,
      byAction: { sent_as_written: 1, sent_by_itself: 1, not_sent: 1, edited: 0 },
      byOutcome: { booked: 1, stopped: 1, quiet: 1 },
    });
  });

  it("only drafts FollowUp wrote: sends with an AI answer id, and turned-down drafts that name one", async () => {
    await loadDraftOutcomes(later(-1), later(20));
    expect(prisma.followUp.findMany.mock.calls[0][0].where).toMatchObject({ status: "sent", responseId: { not: null } });
  });

  it("reads nothing more when there is nothing to read", async () => {
    prisma.followUp.findMany.mockResolvedValue([]);
    prisma.auditEvent.findMany.mockResolvedValue([]);
    expect(await loadDraftOutcomes(later(-1), later(20))).toEqual([]);
    expect(prisma.aiDecision.findMany).not.toHaveBeenCalled();
  });
});
