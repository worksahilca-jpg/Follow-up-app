import { describe, it, expect, vi, beforeEach } from "vitest";

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
