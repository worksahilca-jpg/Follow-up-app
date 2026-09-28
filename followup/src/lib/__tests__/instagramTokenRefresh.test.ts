/**
 * Instagram tokens last 60 days; nothing renewed them, so the first
 * connected accounts would have stopped capturing DMs in late November
 * (open-items check, 2026-09-28).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany, updateMany } = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findMany, updateMany } } }));

import { refreshAllInstagramTokens, refreshInstagramToken } from "@/lib/instagramTokenRefresh";

beforeEach(() => {
  vi.restoreAllMocks();
  findMany.mockReset();
  updateMany.mockReset().mockResolvedValue({ count: 1 });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

const ok = (token: string) => new Response(JSON.stringify({ access_token: token, token_type: "bearer", expires_in: 5184000 }), { status: 200 });
const refused = (message: string, code: number) => new Response(JSON.stringify({ error: { message, code } }), { status: 400 });

describe("refreshInstagramToken", () => {
  it("asks Meta for a renewal with the refresh grant", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(ok("IGAA-new"));
    expect(await refreshInstagramToken("IGAA-old")).toEqual({ ok: true, token: "IGAA-new" });
    const url = String(fetchSpy.mock.calls[0][0]);
    expect(url).toContain("https://graph.instagram.com/refresh_access_token?");
    expect(url).toContain("grant_type=ig_refresh_token");
  });

  it("falls back to POST when GET is refused, as the connect-time exchange needed", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(refused("Unsupported request - method type: get", 100))
      .mockResolvedValueOnce(ok("IGAA-new"));
    expect(await refreshInstagramToken("IGAA-old")).toEqual({ ok: true, token: "IGAA-new" });
  });

  it("reports Meta's reason without the token when both are refused", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(refused("Error validating access token", 190));
    const r = await refreshInstagramToken("IGAA-secret-token");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain("[190]");
      expect(r.reason).not.toContain("IGAA-secret-token");
    }
  });
});

describe("refreshAllInstagramTokens", () => {
  it("stores the renewed token, only onto the same account", async () => {
    findMany.mockResolvedValue([{ id: "b1", instagramUserId: "ig1", instagramAccessToken: "IGAA-old" }]);
    vi.spyOn(global, "fetch").mockResolvedValue(ok("IGAA-new"));
    expect(await refreshAllInstagramTokens()).toEqual({ checked: 1, refreshed: 1, refused: 0 });
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "b1", instagramUserId: "ig1" }, data: { instagramAccessToken: "IGAA-new" } });
  });

  it("leaves a refused token exactly as it is", async () => {
    findMany.mockResolvedValue([{ id: "b1", instagramUserId: "ig1", instagramAccessToken: "IGAA-old" }]);
    vi.spyOn(global, "fetch").mockResolvedValue(refused("Error validating access token", 190));
    expect(await refreshAllInstagramTokens()).toEqual({ checked: 1, refreshed: 0, refused: 1 });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
