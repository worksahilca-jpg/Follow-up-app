/**
 * recordAudit says whether the row was written (daily-path sweep
 * 2026-09-25 #5). It still never throws — most callers only want a record
 * of what happened — but an "ai.hold" row is what puts a draft in front of
 * the owner, so that caller needs to know when it did not stick.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { auditEvent: { create } } }));
vi.mock("next/headers", () => ({
  headers: async () => {
    throw new Error("not in a request");
  },
}));

import { recordAudit } from "@/lib/audit";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recordAudit", () => {
  it("resolves true when the row is written", async () => {
    create.mockResolvedValue({});
    await expect(recordAudit({ businessId: "biz1" }, "ai.hold", { targetType: "lead", targetId: "l1" })).resolves.toBe(true);
  });

  it("resolves false, without throwing, when the write fails", async () => {
    create.mockRejectedValue(new Error("connection reset"));
    await expect(recordAudit({ businessId: "biz1" }, "ai.hold", { targetType: "lead", targetId: "l1" })).resolves.toBe(false);
  });
});
