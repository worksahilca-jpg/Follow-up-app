/**
 * Guarantees of the session lifecycle (src/lib/auth.ts):
 *  - authTime is only stamped on an actual sign-in round trip through
 *    Google's own login screen, never on an ordinary request that's just
 *    reusing an existing cookie.
 *  - A user removed from their team (businessId set null) is stripped of
 *    data access within one revalidation interval, rather than keeping
 *    the old token's claim for the rest of its now-7-day life.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    invite: { findFirst: vi.fn(), delete: vi.fn() },
    business: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const jwt = authOptions.callbacks!.jwt as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const session = authOptions.callbacks!.session as any;

beforeEach(() => {
  p.user.findUnique.mockReset();
});

describe("jwt callback", () => {
  it("stamps authTime only when a real sign-in just happened (`user` present)", async () => {
    const before = Date.now();
    const token = await jwt({
      token: { businessId: "biz1", userId: "u1", checkedAt: Date.now() },
      user: { email: "a@b.com" },
    });
    expect(token.authTime).toBeGreaterThanOrEqual(before);
  });

  it("never touches authTime on an ordinary request reusing an existing token", async () => {
    const token = await jwt({
      token: { businessId: "biz1", userId: "u1", authTime: 123, checkedAt: Date.now() },
    });
    expect(token.authTime).toBe(123);
  });

  it("resolves businessId for a token that never got one yet", async () => {
    p.user.findUnique.mockResolvedValueOnce({ id: "u1", businessId: "biz1" });
    const token = await jwt({ token: { email: "a@b.com" } });
    expect(token.businessId).toBe("biz1");
    expect(token.userId).toBe("u1");
    expect(typeof token.checkedAt).toBe("number");
  });

  it("leaves a token checked moments ago alone — no DB hit", async () => {
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: Date.now() } });
    expect(p.user.findUnique).not.toHaveBeenCalled();
    expect(token.businessId).toBe("biz1");
  });

  it("strips businessId/userId once revalidation finds the user was removed from their team", async () => {
    p.user.findUnique.mockResolvedValueOnce({ businessId: null });
    const staleCheckedAt = Date.now() - 10 * 60 * 1000; // well past the 5-minute interval
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: staleCheckedAt } });
    expect(token.businessId).toBeUndefined();
    expect(token.userId).toBeUndefined();
  });

  it("refreshes businessId on revalidation when it simply changed", async () => {
    p.user.findUnique.mockResolvedValueOnce({ businessId: "biz2" });
    const staleCheckedAt = Date.now() - 10 * 60 * 1000;
    const token = await jwt({ token: { businessId: "biz1", userId: "u1", checkedAt: staleCheckedAt } });
    expect(token.businessId).toBe("biz2");
    expect(token.userId).toBe("u1");
  });
});

describe("session callback", () => {
  it("carries authTime onto the session even with no user object yet", async () => {
    const result = await session({ session: {}, token: { authTime: 555 } });
    expect(result.authTime).toBe(555);
  });

  it("defaults authTime to 0 for a token that predates this feature", async () => {
    const result = await session({ session: { user: {} }, token: { userId: "u1", businessId: "biz1" } });
    expect(result.authTime).toBe(0);
  });
});
