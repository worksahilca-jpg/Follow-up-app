/**
 * Security audit 2026-09-26, A-1: the /admin layout is not a security
 * boundary.
 *
 * In the App Router a page renders alongside its layout, and a client-side
 * navigation (an RSC request whose `Next-Router-State-Tree` header says the
 * /admin layout is already mounted) renders ONLY the changed segment — the
 * layout, and the requirePlatformAdmin() inside it, never runs. Reproduced
 * against `next dev` on 2026-09-26: an unauthenticated RSC request for
 * /admin/office answered 200 and executed OfficePage's queries, while a
 * plain GET of the same URL answered 404.
 *
 * So every page under src/app/admin must prove the caller itself, and the
 * cross-tenant data functions must too. Two tests:
 *  1. getFloor() — the office's cross-tenant read — refuses before it
 *     queries anything.
 *  2. A source scan: every page.tsx under src/app/admin calls
 *     requirePlatformAdmin() (or getPlatformAdminData(), which does), so
 *     the next admin page added cannot rely on the layout alone.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

const { prisma } = vi.hoisted(() => ({
  prisma: {
    agentRole: { findMany: vi.fn().mockResolvedValue([]) },
    agentRun: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/office/runner", () => ({ startOfUtcDay: (d: Date) => d }));

describe("getFloor (the office's cross-tenant read)", () => {
  beforeEach(() => {
    vi.resetModules();
    getServerSession.mockReset();
    notFound.mockClear();
    prisma.agentRole.findMany.mockClear();
    prisma.agentRun.findMany.mockClear();
    process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
  });

  it("refuses a request with no session before querying anything", async () => {
    getServerSession.mockResolvedValue(null);
    const { getFloor } = await import("@/lib/office/floor");
    await expect(getFloor()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.agentRole.findMany).not.toHaveBeenCalled();
    expect(prisma.agentRun.findMany).not.toHaveBeenCalled();
  });

  it("refuses a signed-in user who is not a platform admin", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@somebusiness.com" } });
    const { getFloor } = await import("@/lib/office/floor");
    await expect(getFloor()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(prisma.agentRole.findMany).not.toHaveBeenCalled();
  });

  it("answers the platform admin", async () => {
    getServerSession.mockResolvedValue({ user: { email: "founder@example.com" } });
    const { getFloor } = await import("@/lib/office/floor");
    await expect(getFloor()).resolves.toMatchObject({ desks: [], recent: [] });
  });
});

describe("every /admin page proves the caller itself", () => {
  const adminDir = path.resolve(__dirname, "../../app/admin");

  function pages(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return pages(full);
      return name === "page.tsx" ? [full] : [];
    });
  }

  const found = pages(adminDir);

  it("finds the admin pages (guards against the scan silently matching nothing)", () => {
    expect(found.length).toBeGreaterThanOrEqual(2);
  });

  it.each(found.map((p) => [path.relative(adminDir, p), p]))("%s calls a platform-admin guard", (_rel, file) => {
    const src = readFileSync(file, "utf8");
    expect(/requirePlatformAdmin\(\)|getPlatformAdminData\(\)/.test(src)).toBe(true);
  });
});
