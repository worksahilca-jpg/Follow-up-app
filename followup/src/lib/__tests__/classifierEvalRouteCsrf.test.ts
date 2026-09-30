/**
 * Backlog b004: the admin-only lead check (/api/admin/classifier-eval,
 * 100-200 paid model calls a run) could be started by another site while a
 * platform admin was signed in. It was a GET, and a top-level GET
 * navigation (a link, a redirect, window.open) carries the SameSite=Lax
 * session cookie.
 *
 * Pinned here: opening the URL never runs the check, a request a browser
 * marks as coming from another site never runs it, and a same-origin POST
 * from the admin still does.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

const { runClassifierEval } = vi.hoisted(() => ({
  runClassifierEval: vi.fn(async () => ({ total: 1, passed: 1, failed: 0, errors: 0, failures: [] })),
}));
vi.mock("@/lib/classifierEval", () => ({ runClassifierEval }));

const ROUTE_URL = "https://app.example.com/api/admin/classifier-eval";
const ADMIN = { user: { email: "founder@example.com" } };

function request(method: "GET" | "POST", secFetchSite?: string): NextRequest {
  return new NextRequest(ROUTE_URL, { method, headers: secFetchSite ? { "sec-fetch-site": secFetchSite } : {} });
}

async function loadRoute() {
  // platformAdmin.ts reads PLATFORM_ADMIN_EMAILS once, at import.
  vi.resetModules();
  return import("@/app/api/admin/classifier-eval/route");
}

describe("/api/admin/classifier-eval cannot be started by another site (b004)", () => {
  beforeEach(() => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@example.com");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    getServerSession.mockReset();
    runClassifierEval.mockClear();
  });

  it("a GET from a signed-in admin (the cross-site link or redirect) does not run the check", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(runClassifierEval).not.toHaveBeenCalled();
  });

  it("a GET from anyone else still answers 404, so the route doesn't confirm it exists", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@somebusiness.com" } });
    const { GET } = await loadRoute();
    expect((await GET()).status).toBe(404);
    expect(runClassifierEval).not.toHaveBeenCalled();
  });

  it.each(["cross-site", "same-site"])("a POST the browser marks %s is refused even with an admin session", async (site) => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await loadRoute();
    const res = await POST(request("POST", site));
    expect(res.status).toBe(403);
    expect(runClassifierEval).not.toHaveBeenCalled();
  });

  it("a POST with no session (what a cross-site POST looks like: no Lax cookie) is a 404", async () => {
    getServerSession.mockResolvedValue(null);
    const { POST } = await loadRoute();
    expect((await POST(request("POST", "cross-site"))).status).toBe(404);
    expect(runClassifierEval).not.toHaveBeenCalled();
  });

  it("a POST from a signed-in non-admin is a 404 and runs nothing", async () => {
    getServerSession.mockResolvedValue({ user: { email: "owner@somebusiness.com" } });
    const { POST } = await loadRoute();
    expect((await POST(request("POST", "same-origin"))).status).toBe(404);
    expect(runClassifierEval).not.toHaveBeenCalled();
  });

  it("a same-origin POST from the admin runs the check", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await loadRoute();
    const res = await POST(request("POST", "same-origin"));
    expect(res.status).toBe(200);
    expect(runClassifierEval).toHaveBeenCalledTimes(1);
    expect(await res.json()).toMatchObject({ success: true, passed: 1 });
  });

  it("a POST with no Sec-Fetch-Site header (a non-browser client) from the admin runs the check", async () => {
    getServerSession.mockResolvedValue(ADMIN);
    const { POST } = await loadRoute();
    expect((await POST(request("POST"))).status).toBe(200);
    expect(runClassifierEval).toHaveBeenCalledTimes(1);
  });
});
