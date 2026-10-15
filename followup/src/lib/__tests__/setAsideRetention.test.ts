/**
 * Security pass 2026-09-25 F3 (fixed 2026-09-26): a set-aside WhatsApp
 * chat — the owner's family, friends, bank — kept its whole thread in
 * plain JSON forever. After 30 quiet days the messages go; the row stays.
 * Instagram and Messenger set-aside chats too, since 2026-10-15 ("do not pick any private thing").
 */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn(async () => ({ count: 4 })) }));
vi.mock("@/lib/db", () => ({ prisma: { filteredEmail: { updateMany } } }));
vi.mock("@/lib/inbound/twilioMessage", () => ({ processTwilioInbound: vi.fn() }));
vi.mock("@/lib/inbound/meta", () => ({ processMetaEnvelope: vi.fn() }));
vi.mock("@/lib/inbound/whatsappCloud", () => ({ processWhatsAppCloudEnvelope: vi.fn() }));
vi.mock("@/lib/inbound/leadForm", () => ({ processLeadFormSubmission: vi.fn() }));

import { pruneSetAsideThreads } from "@/lib/inboundEvents";

describe("pruneSetAsideThreads", () => {
  it("clears WhatsApp, Instagram and Messenger chats quiet for 30 days, never a mailbox row, and keeps the rows", async () => {
    const now = new Date("2026-09-26T00:00:00.000Z");
    const result = await pruneSetAsideThreads(now);

    expect(result).toEqual({ cleared: 4 });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        provider: { in: ["whatsapp", "instagram", "messenger"] },
        threadPayload: { not: Prisma.DbNull },
        lastMessageAt: { lt: new Date("2026-08-27T00:00:00.000Z") },
      },
      data: { threadPayload: Prisma.DbNull },
    });
  });
});
