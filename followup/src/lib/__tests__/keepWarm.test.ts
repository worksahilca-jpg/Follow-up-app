import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { WARM_PATHS, keepWarm } from "@/lib/keepWarm";

const { requireCronSecret } = vi.hoisted(() => ({ requireCronSecret: vi.fn((): unknown => null) }));
vi.mock("@/lib/cronAuth", () => ({ requireCronSecret }));

const root = join(__dirname, "..", "..", "..");

afterEach(() => vi.unstubAllGlobals());

describe("keepWarm", () => {
  it("opens every page once, signed out, without following the redirect to /signin", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 307, headers: { location: "/signin" } }));
    vi.stubGlobal("fetch", fetchMock);
    const results = await keepWarm("https://www.example.test");
    expect(fetchMock).toHaveBeenCalledTimes(WARM_PATHS.length);
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      const [url, init] = call;
      expect(url.startsWith("https://www.example.test/")).toBe(true);
      expect(init.redirect).toBe("manual");
      expect(JSON.stringify(init.headers)).not.toMatch(/cookie|authorization/i);
    }
    expect(results.map((r) => r.status)).toEqual(WARM_PATHS.map(() => 307));
  });

  it("reports a page that doesn't answer and still opens the rest", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/activity")) throw new Error("timed out");
        return new Response("{}", { status: 200 });
      })
    );
    const results = await keepWarm("https://www.example.test");
    expect(results.find((r) => r.path === "/activity")?.status).toBeNull();
    expect(results.filter((r) => r.status === 200)).toHaveLength(WARM_PATHS.length - 1);
  });

  it("only names pages that exist (a renamed page would be warmed in vain)", () => {
    const pages: Record<string, string> = {
      "/dashboard": "src/app/(app)/dashboard/page.tsx",
      "/leads": "src/app/(app)/leads/page.tsx",
      "/leads/keep-warm": "src/app/(app)/leads/[id]/page.tsx",
      "/activity": "src/app/(app)/activity/page.tsx",
      "/analytics": "src/app/(app)/analytics/page.tsx",
      "/calls": "src/app/(app)/calls/page.tsx",
      "/settings": "src/app/(app)/settings/page.tsx",
      "/signin": "src/app/signin/page.tsx",
      "/api/auth/session": "src/app/api/auth/[...nextauth]/route.ts",
    };
    expect(Object.keys(pages).sort()).toEqual([...WARM_PATHS].sort());
    for (const file of Object.values(pages)) expect(existsSync(join(root, file)), file).toBe(true);
  });

  it("runs every 3 minutes", () => {
    const crons = (JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] }).crons;
    expect(crons).toContainEqual({ path: "/api/cron/keep-warm", schedule: "*/3 * * * *" });
  });
});

describe("GET /api/cron/keep-warm", () => {
  it("does nothing without the cron secret", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    requireCronSecret.mockReturnValueOnce(NextResponse.json({ success: false }, { status: 401 }));
    const { GET } = await import("@/app/api/cron/keep-warm/route");
    const res = await GET(new NextRequest("https://www.example.test/api/cron/keep-warm"));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("opens the pages on the public address", async () => {
    vi.stubEnv("NEXTAUTH_URL", "https://example.test");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.example.test");
    const fetchMock = vi.fn(async () => new Response(null, { status: 307 }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/cron/keep-warm/route");
    const res = await GET(new NextRequest("https://www.example.test/api/cron/keep-warm"));
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://www.example.test/dashboard");
  });
});
