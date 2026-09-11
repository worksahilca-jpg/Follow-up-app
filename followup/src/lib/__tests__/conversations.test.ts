/**
 * findOrCreateConversation() (src/lib/conversations.ts) is the shared
 * find-or-create every inbound/outbound channel route now goes through,
 * replacing each route's own copy of the same racy "find one, create it
 * if it's not there" logic. The guarantee this covers: when two callers
 * both find nothing and both try to create, the loser's create() fails
 * with P2002 (the partial unique index added by the
 * 20260911060000_conversation_leadid_channel_unique migration) and this
 * function recovers by re-fetching the winner's row instead of throwing
 * or ending up with two conversations for the same lead+channel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    conversation: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { findOrCreateConversation } from "@/lib/conversations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findOrCreateConversation", () => {
  it("returns the existing conversation without creating one", async () => {
    p.conversation.findFirst.mockResolvedValue({ id: "existing-conv" });

    const result = await findOrCreateConversation("lead1", "instagram");

    expect(result).toEqual({ id: "existing-conv" });
    expect(p.conversation.create).not.toHaveBeenCalled();
  });

  it("creates a new conversation when none exists yet", async () => {
    p.conversation.findFirst.mockResolvedValue(null);
    p.conversation.create.mockResolvedValue({ id: "new-conv" });

    const result = await findOrCreateConversation("lead1", "whatsapp");

    expect(result).toEqual({ id: "new-conv" });
    expect(p.conversation.create).toHaveBeenCalledWith({ data: { leadId: "lead1", channel: "whatsapp" } });
  });

  it("passes through extra fields (e.g. emailProvider) on create", async () => {
    p.conversation.findFirst.mockResolvedValue(null);
    p.conversation.create.mockResolvedValue({ id: "new-conv" });

    await findOrCreateConversation("lead1", "email", { emailProvider: "outlook" });

    expect(p.conversation.create).toHaveBeenCalledWith({
      data: { leadId: "lead1", channel: "email", emailProvider: "outlook" },
    });
  });

  it("recovers the winner's row when create() loses a concurrent race (P2002)", async () => {
    p.conversation.findFirst
      .mockResolvedValueOnce(null) // first check: nothing there yet
      .mockResolvedValueOnce({ id: "winner-conv" }); // re-fetch after losing the race
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    p.conversation.create.mockRejectedValue(conflict);

    const result = await findOrCreateConversation("lead1", "text");

    expect(result).toEqual({ id: "winner-conv" });
    expect(p.conversation.findFirst).toHaveBeenCalledTimes(2);
  });

  it("rethrows a create() failure that isn't a unique-constraint conflict", async () => {
    p.conversation.findFirst.mockResolvedValue(null);
    p.conversation.create.mockRejectedValue(new Error("connection lost"));

    await expect(findOrCreateConversation("lead1", "call")).rejects.toThrow("connection lost");
  });
});
