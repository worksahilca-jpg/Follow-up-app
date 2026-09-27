import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const { recordAuthFailure } = vi.hoisted(() => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure }));

import { requireCronSecret } from "@/lib/cronAuth";

function fakeRequest(authHeader: string | null): Request {
  return new Request("https://followupbase.io/api/cron/automation", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

beforeEach(() => {
  vi.unstubAllEnvs();
  recordAuthFailure.mockReset();
});

describe("requireCronSecret", () => {
  it("passes a correctly-authenticated request through (returns null)", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(requireCronSecret(fakeRequest("Bearer s3cr3t") as any, "automation")).toBeNull();
    expect(recordAuthFailure).not.toHaveBeenCalled();
  });

  it("rejects and reports a wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = requireCronSecret(fakeRequest("Bearer wrong") as any, "gmail-sync");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledWith("cron_secret", { route: "gmail-sync" });
  });

  it("fails closed when CRON_SECRET was never configured, even with no header at all", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = requireCronSecret(fakeRequest(null) as any, "weekly-digest");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});

// Audit 2026-09-26 A-3: /api/cron/office carried its own inline copy of
// this check with a plain `!==` and no failure report. Every cron route
// must go through the shared guard, so the next one added cannot drift.
describe("every /api/cron route uses requireCronSecret", () => {
  const cronDir = path.resolve(__dirname, "../../app/api/cron");
  const routes = readdirSync(cronDir).map((name) => [name, path.join(cronDir, name, "route.ts")] as const);

  it("finds the cron routes (guards against the scan silently matching nothing)", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  it.each(routes)("%s calls requireCronSecret", (_name, file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toMatch(/requireCronSecret\(request,/);
    expect(src).not.toMatch(/auth !== `Bearer/);
  });
});

describe("/api/cron/office", () => {
  it("refuses and reports a wrong bearer without starting a shift", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    const syncRoles = vi.fn();
    vi.doMock("@/lib/office/roles", () => ({ syncRoles }));
    vi.doMock("@/lib/office/runner", () => ({ runShift: vi.fn() }));
    vi.doMock("@/lib/db", () => ({ prisma: {} }));
    const { GET } = await import("@/app/api/cron/office/route");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await GET(fakeRequest("Bearer s3cr3t-but-longer") as any);
    expect(res.status).toBe(401);
    expect(recordAuthFailure).toHaveBeenCalledWith("cron_secret", { route: "office" });
    expect(syncRoles).not.toHaveBeenCalled();
  });
});
