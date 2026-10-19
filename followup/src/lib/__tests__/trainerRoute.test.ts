import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, askTrainer, trainerReady, tooManyRecentActions } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  askTrainer: vi.fn(),
  trainerReady: vi.fn(() => true),
  tooManyRecentActions: vi.fn(async () => false),
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/trainer", () => ({ askTrainer, trainerReady }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";

const ask = { action: "ask", message: "too cold", trade: "Real estate", channel: "instagram", turns: [{ from: "customer", text: "hi" }, { from: "followup", text: "Hello" }], focus: 1 };
function req(body: unknown, site = "same-origin") {
  return new NextRequest("http://localhost/api/admin/trainer", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": site },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/trainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trainerReady.mockReturnValue(true);
    getSessionContext.mockResolvedValue({ userId: "u", businessId: "b", email: "founder@example.com", authTime: 0 });
  });

  it("is a 404 for anyone but the founder, and refuses another site", async () => {
    const { POST } = await import("@/app/api/admin/trainer/route");
    getSessionContext.mockResolvedValueOnce({ userId: "u", businessId: "b", email: "owner@example.com", authTime: 0 });
    expect((await POST(req(ask))).status).toBe(404);
    expect((await POST(req(ask, "cross-site"))).status).toBe(403);
    expect(askTrainer).not.toHaveBeenCalled();
  });

  it("says so when Claude isn't set up", async () => {
    trainerReady.mockReturnValue(false);
    const { POST } = await import("@/app/api/admin/trainer/route");
    expect((await POST(req(ask))).status).toBe(503);
    expect(askTrainer).not.toHaveBeenCalled();
  });

  it("asks Claude about the chat, with the answer he pointed at", async () => {
    askTrainer.mockResolvedValue({ id: "m", role: "claude", text: "Agreed.", cards: [], when: "" });
    const { POST } = await import("@/app/api/admin/trainer/route");
    const res = await POST(req(ask));
    expect(res.status).toBe(200);
    expect((await res.json()).turn.text).toBe("Agreed.");
    expect(askTrainer.mock.calls[0][0]).toMatchObject({ businessId: "b", userId: "u", message: "too cold", talk: { trade: "Real estate", channel: "instagram", focus: 1 } });
    expect(tooManyRecentActions).toHaveBeenCalledWith("b", "admin.trainer.ask", expect.anything());
  });

  it("drops a pointer past the end of the chat, and says plainly when Claude fails", async () => {
    askTrainer.mockRejectedValue(new Error("down"));
    const { POST } = await import("@/app/api/admin/trainer/route");
    const res = await POST(req({ ...ask, focus: 9 }));
    expect(res.status).toBe(502);
    expect(askTrainer.mock.calls[0][0].talk.focus).toBeNull();
  });
});
