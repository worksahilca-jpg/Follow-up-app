/**
 * /api/admin/qualification-eval: about fifty paid model calls a run, so it
 * runs only for a platform admin, only on POST, and never from another site
 * (the same locks as /api/admin/classifier-eval, backlog b004).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const { runQualificationEval } = vi.hoisted(() => ({
  runQualificationEval: vi.fn(async () => ({ cases: 1, items: { total: 4, right: 4, madeUp: 0, missed: 0 }, errors: 0, failures: [] })),
}));
vi.mock("@/lib/qualificationEval", () => ({ runQualificationEval }));

const ADMIN = { user: { email: "founder@example.com" } };
const request = (secFetchSite?: string) =>
  new NextRequest("https://app.example.com/api/admin/qualification-eval", { method: "POST", headers: secFetchSite ? { "sec-fetch-site": secFetchSite } : {} });

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/admin/qualification-eval/route");
}

describe("/api/admin/qualification-eval", () => {
  beforeEach(() => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@example.com");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    getServerSession.mockReset();
    runQualificationEval.mockClear();
  });

  it("runs for a platform admin on a same-origin POST", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await loadRoute();
    const res = await POST(request("same-origin"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true });
    expect(runQualificationEval).toHaveBeenCalledTimes(1);
  });

  it("is not a success when anything was made up", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    runQualificationEval.mockResolvedValueOnce({ cases: 1, items: { total: 4, right: 3, madeUp: 1, missed: 0 }, errors: 0, failures: [] });
    const { POST } = await loadRoute();
    expect(await (await POST(request())).json()).toMatchObject({ success: false });
  });

  it("answers 404 to anyone else, and never runs", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@somebusiness.com" } });
    const { POST, GET } = await loadRoute();
    expect((await POST(request("same-origin"))).status).toBe(404);
    expect((await GET()).status).toBe(404);
    expect(runQualificationEval).not.toHaveBeenCalled();
  });

  it("refuses a request from another site, and a GET never runs it", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST, GET } = await loadRoute();
    expect((await POST(request("cross-site"))).status).toBe(403);
    expect((await GET()).status).toBe(405);
    expect(runQualificationEval).not.toHaveBeenCalled();
  });
});
