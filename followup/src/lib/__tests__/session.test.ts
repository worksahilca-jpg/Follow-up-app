/**
 * Guarantee: hasRecentAuth() only says yes for a session that actually,
 * recently went through Google's own login screen — not merely "the
 * cookie hasn't expired yet." Backs the step-up gate in src/lib/reauth.ts.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { hasRecentAuth, type SessionContext } from "@/lib/session";

function ctx(authTime: number): SessionContext {
  return { userId: "u1", businessId: "biz1", email: "a@b.com", authTime };
}

describe("hasRecentAuth", () => {
  it("is true immediately after a real sign-in", () => {
    expect(hasRecentAuth(ctx(Date.now()))).toBe(true);
  });

  it("is false once the step-up window has passed", () => {
    expect(hasRecentAuth(ctx(Date.now() - 6 * 60 * 1000))).toBe(false);
  });

  it("is false for a session whose token predates authTime entirely (defaults to 0)", () => {
    expect(hasRecentAuth(ctx(0))).toBe(false);
  });
});
