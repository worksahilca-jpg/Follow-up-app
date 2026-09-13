/**
 * Access control for the cross-tenant /admin dashboard (src/lib/platformAdmin.ts) —
 * the part of this feature that must never regress. Two things get tested:
 *  1. isPlatformAdmin() — the pure allowlist check, including the
 *     fail-CLOSED behavior (empty/unset env denies everyone, the opposite
 *     of ALLOWED_EMAILS's semantics).
 *  2. requirePlatformAdmin() — the actual guard /admin's layout runs: an
 *     allowed email is let through silently, anyone else gets Next's
 *     notFound() (a real 404), never a distinguishable "not authorized"
 *     response.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

// Next's real notFound() throws a special digest error that its own
// rendering machinery catches further up the tree — mocked here as "throws
// something," so a caller that doesn't handle it (correctly) still sees
// the request short-circuit, without pulling in Next's router internals.
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

describe("isPlatformAdmin", () => {
  const ORIGINAL_ENV = process.env.PLATFORM_ADMIN_EMAILS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL_ENV;
  });

  it("denies everyone when the env var is unset — fails CLOSED, not open", async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    const { isPlatformAdmin } = await import("@/lib/platformAdmin");
    expect(isPlatformAdmin("founder@example.com")).toBe(false);
  });

  it("denies everyone when the env var is set but empty", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "";
    const { isPlatformAdmin } = await import("@/lib/platformAdmin");
    expect(isPlatformAdmin("founder@example.com")).toBe(false);
  });

  it("allows an exact, case-insensitive match once configured", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "Founder@Example.com, other@example.com";
    const { isPlatformAdmin } = await import("@/lib/platformAdmin");
    expect(isPlatformAdmin("founder@example.com")).toBe(true);
    expect(isPlatformAdmin("FOUNDER@EXAMPLE.COM")).toBe(true);
  });

  it("denies an email not on the list, even with the list configured", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
    const { isPlatformAdmin } = await import("@/lib/platformAdmin");
    expect(isPlatformAdmin("someone-else@example.com")).toBe(false);
  });

  it("denies a null/undefined email", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
    const { isPlatformAdmin } = await import("@/lib/platformAdmin");
    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  it("a business-level TeamRole ADMIN with no matching entry still gets nothing — the two allowlists are independent", async () => {
    // isPlatformAdmin only ever looks at PLATFORM_ADMIN_EMAILS; it never
    // takes a TeamRole/business context as input at all, so there's no way
    // for a business's own ADMIN role to leak into this check.
    process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
    const { isPlatformAdmin } = await import("@/lib/platformAdmin");
    expect(isPlatformAdmin("business-admin@somecompany.com")).toBe(false);
  });
});

describe("requirePlatformAdmin", () => {
  const ORIGINAL_ENV = process.env.PLATFORM_ADMIN_EMAILS;

  beforeEach(() => {
    vi.resetModules();
    getServerSession.mockReset();
    notFound.mockClear();
    process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
  });

  afterEach(() => {
    process.env.PLATFORM_ADMIN_EMAILS = ORIGINAL_ENV;
  });

  it("lets an allowed email through without calling notFound()", async () => {
    getServerSession.mockResolvedValue({ user: { email: "founder@example.com" } });
    const { requirePlatformAdmin } = await import("@/lib/platformAdmin");
    await expect(requirePlatformAdmin()).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("404s a signed-in, non-admin email — not a 401/403 that would confirm the route exists", async () => {
    getServerSession.mockResolvedValue({ user: { email: "not-the-founder@example.com" } });
    const { requirePlatformAdmin } = await import("@/lib/platformAdmin");
    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("404s when there's no session at all", async () => {
    getServerSession.mockResolvedValue(null);
    const { requirePlatformAdmin } = await import("@/lib/platformAdmin");
    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("404s everyone, including an otherwise-plausible email, while PLATFORM_ADMIN_EMAILS is unset", async () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    getServerSession.mockResolvedValue({ user: { email: "founder@example.com" } });
    const { requirePlatformAdmin } = await import("@/lib/platformAdmin");
    await expect(requirePlatformAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
