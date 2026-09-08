/**
 * Task #68: captureDirectReply() (src/lib/instagram.ts) is what turns a
 * Meta webhook "echo" — a reply sent outside FollowUp, most commonly
 * Meta's own free Business AI answering a DM — into a real outbound
 * Message instead of being silently dropped (the old behavior). Three
 * guarantees:
 *  - it's recorded with the right source label, not mistaken for a
 *    FollowUp-sent message;
 *  - it's idempotent on Meta's own message id, since webhooks redeliver;
 *  - it bumps the lead's lastContacted, so the silence automation
 *    doesn't also fire on a lead that was just genuinely answered.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { findFirst: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn(), create: vi.fn() },
    lead: { update: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { captureDirectReply } from "@/lib/instagram";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
  p.conversation.findFirst.mockResolvedValue(null);
  p.conversation.create.mockResolvedValue({ id: "conv1" });
  p.message.upsert.mockResolvedValue({});
  p.message.create.mockResolvedValue({});
  p.lead.update.mockResolvedValue({});
});

describe("captureDirectReply", () => {
  it("records the message with the right source label and channel", async () => {
    const sentAt = new Date("2026-09-08T12:00:00Z");
    await captureDirectReply("lead1", "instagram", "We can help with that!", "instagram_direct", "mid_123", sentAt);

    expect(p.conversation.create).toHaveBeenCalledWith({ data: { leadId: "lead1", channel: "instagram" } });
    expect(p.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { externalId: "mid_123" },
        create: expect.objectContaining({
          conversationId: "conv1",
          direction: "outbound",
          body: "We can help with that!",
          source: "instagram_direct",
          externalId: "mid_123",
          sentAt,
        }),
      })
    );
  });

  it("reuses an existing conversation instead of creating a duplicate", async () => {
    p.conversation.findFirst.mockResolvedValue({ id: "existing-conv" });
    await captureDirectReply("lead1", "messenger", "Thanks for reaching out", "messenger_direct", "mid_456", new Date());
    expect(p.conversation.create).not.toHaveBeenCalled();
    expect(p.message.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ conversationId: "existing-conv" }) }));
  });

  it("is idempotent on Meta's message id — a redelivered webhook doesn't create a duplicate row", async () => {
    // upsert's own "where: externalId" is what guarantees this at the DB
    // level; here we just confirm the same mid is always used as the key
    // regardless of how many times capture is called.
    await captureDirectReply("lead1", "instagram", "Hello", "instagram_direct", "mid_dup", new Date());
    await captureDirectReply("lead1", "instagram", "Hello", "instagram_direct", "mid_dup", new Date());
    expect(p.message.upsert).toHaveBeenCalledTimes(2);
    expect(p.message.upsert.mock.calls[0][0].where).toEqual({ externalId: "mid_dup" });
    expect(p.message.upsert.mock.calls[1][0].where).toEqual({ externalId: "mid_dup" });
  });

  it("falls back to a plain create when Meta sends no message id", async () => {
    await captureDirectReply("lead1", "messenger", "No id on this one", "messenger_direct", undefined, new Date());
    expect(p.message.upsert).not.toHaveBeenCalled();
    expect(p.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ direction: "outbound", source: "messenger_direct" }) })
    );
  });

  it("bumps the lead's lastContacted to the message's real timestamp", async () => {
    const sentAt = new Date("2026-09-08T09:30:00Z");
    await captureDirectReply("lead1", "instagram", "hi", "instagram_direct", "mid_789", sentAt);
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { lastContacted: sentAt } });
  });
});
