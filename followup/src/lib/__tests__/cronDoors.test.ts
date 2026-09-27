/**
 * Every /api/cron/* door goes through the one shared check
 * (src/lib/cronAuth.ts: constant-time compare, fails closed without
 * CRON_SECRET, reports the probe to Sentry).
 *
 * /api/cron/office kept its own inline `auth !== \`Bearer ${secret}\``
 * copy after the others were centralised (audit 2026-09-16, L-1). The
 * sweep below makes the next new cron route fail CI if it does the same.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const h = vi.hoisted(() => ({
  syncRoles: vi.fn(async () => undefined),
  findMany: vi.fn(async () => []),
  runShift: vi.fn(),
  recordAuthFailure: vi.fn(),
}));
vi.mock("@/lib/office/roles", () => ({ syncRoles: h.syncRoles }));
vi.mock("@/lib/office/runner", () => ({ runShift: h.runShift }));
vi.mock("@/lib/db", () => ({ prisma: { agentRole: { findMany: h.findMany } } }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: h.recordAuthFailure }));

import { GET as officeGET } from "@/app/api/cron/office/route";
import type { NextRequest } from "next/server";

const cronDir = join(__dirname, "..", "..", "app", "api", "cron");

describe("every cron route uses the shared secret check", () => {
  const routes = readdirSync(cronDir).filter((d) => !d.startsWith("_"));
  it.each(routes)("%s", (dir) => {
    const src = readFileSync(join(cronDir, dir, "route.ts"), "utf8");
    expect(src).toContain("requireCronSecret(");
    // No hand-rolled comparison of the header against the secret.
    expect(src).not.toMatch(/!==\s*`Bearer/);
    expect(src).not.toMatch(/===\s*`Bearer/);
  });
});

function req(authorization?: string): NextRequest {
  return new Request("https://followupbase.io/api/cron/office", {
    headers: authorization ? { authorization } : {},
  }) as unknown as NextRequest;
}

describe("/api/cron/office door", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.findMany.mockResolvedValue([]);
  });

  it("refuses everyone when CRON_SECRET is unset, and reports it", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await officeGET(req("Bearer "));
    expect(res.status).toBe(401);
    expect(h.syncRoles).not.toHaveBeenCalled();
    expect(h.recordAuthFailure).toHaveBeenCalledWith("cron_secret", { route: "office" });
  });

  it("refuses a wrong secret before doing any work", async () => {
    vi.stubEnv("CRON_SECRET", "right-secret");
    const res = await officeGET(req("Bearer wrong-secret"));
    expect(res.status).toBe(401);
    expect(h.syncRoles).not.toHaveBeenCalled();
  });

  it("runs for the right secret", async () => {
    vi.stubEnv("CRON_SECRET", "right-secret");
    const res = await officeGET(req("Bearer right-secret"));
    expect(res.status).toBe(200);
    expect(h.syncRoles).toHaveBeenCalled();
  });
});
