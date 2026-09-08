/**
 * createInboundMessageIfNew() (src/lib/instagram.ts) — the fix for
 * research/audit/2026-09-08-newer-surface-audit.md finding #3: Meta
 * redelivers webhook events aggressively, and the primary Instagram/
 * Messenger/Lead-Ads inbound paths had no idempotency key, unlike
 * captureDirectReply()'s upsert-by-externalId for the is_echo branch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { message: { create } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));

import { createInboundMessageIfNew } from "@/lib/instagram";

beforeEach(() => {
  create.mockReset();
});

describe("createInboundMessageIfNew", () => {
  it("creates the message and returns true on a genuinely new externalId", async () => {
    create.mockResolvedValue({});
    const result = await createInboundMessageIfNew("conv1", "hi there", new Date(), "mid_123");
    expect(result).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: { conversationId: "conv1", direction: "inbound", body: "hi there", sentAt: expect.any(Date), externalId: "mid_123" },
    });
  });

  it("returns false without throwing on a redelivered externalId (unique constraint violation)", async () => {
    create.mockRejectedValue({ code: "P2002", meta: { target: ["externalId"] } });
    const result = await createInboundMessageIfNew("conv1", "hi there", new Date(), "mid_dup");
    expect(result).toBe(false);
  });

  it("re-throws a real error that isn't a unique-constraint violation", async () => {
    create.mockRejectedValue(new Error("connection reset"));
    await expect(createInboundMessageIfNew("conv1", "hi there", new Date(), "mid_x")).rejects.toThrow("connection reset");
  });

  it("always creates when no externalId is available — never collides with itself", async () => {
    create.mockResolvedValue({});
    const result = await createInboundMessageIfNew("conv1", "hi there", new Date(), undefined);
    expect(result).toBe(true);
    expect(create).toHaveBeenCalledWith({
      data: { conversationId: "conv1", direction: "inbound", body: "hi there", sentAt: expect.any(Date), externalId: undefined },
    });
  });
});
