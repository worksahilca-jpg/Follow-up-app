/**
 * Guarantee: the step-up gate lets a recently-reauthenticated caller
 * through untouched, and otherwise answers with a 401 the client
 * recognizes (code: "REAUTH_REQUIRED") rather than a generic failure.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { requireRecentAuth } from "@/lib/reauth";
import type { SessionContext } from "@/lib/session";

function ctx(authTime: number): SessionContext {
  return { userId: "u1", businessId: "biz1", email: "a@b.com", authTime };
}

describe("requireRecentAuth", () => {
  it("lets a just-reauthenticated caller through (returns null)", () => {
    expect(requireRecentAuth(ctx(Date.now()))).toBeNull();
  });

  it("blocks a stale session with a 401 carrying REAUTH_REQUIRED", async () => {
    const res = requireRecentAuth(ctx(Date.now() - 10 * 60 * 1000));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    const body = await res!.json();
    expect(body).toEqual({ success: false, code: "REAUTH_REQUIRED", message: expect.any(String) });
  });
});
