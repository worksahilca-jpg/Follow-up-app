/**
 * Plan step 4 (A-321): "Mark replies" on Admin → Train is founder only, from this site only, and its paid half is
 * capped per day.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, startRound, markReply, tooManyRecentActions } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  startRound: vi.fn(),
  markReply: vi.fn(),
  tooManyRecentActions: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/checkerRounds", () => ({ startRound, markReply }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
// The founder list is read when the routes load, so they load after the line above.
const { POST: start } = await import("@/app/api/admin/train/mark/route");
const { POST: mark } = await import("@/app/api/admin/train/mark/reply/route");

function req(body: unknown, site = "same-origin") {
  return new NextRequest("http://localhost/api/admin/train/mark", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": site },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.OPENAI_API_KEY = "test-key";
  getSessionContext.mockResolvedValue({ userId: "u", businessId: "b", email: "founder@example.com", authTime: 0 });
  tooManyRecentActions.mockResolvedValue(false);
  startRound.mockResolvedValue({ ok: true, id: "r1", replies: 60 });
  markReply.mockResolvedValue(true);
});

describe("POST /api/admin/train/mark", () => {
  it("is a 404 for anyone but the founder, and refused from another site", async () => {
    getSessionContext.mockResolvedValueOnce({ userId: "o", businessId: "b2", email: "owner@example.com", authTime: 0 });
    expect((await start(req({ trade: "Real estate" }))).status).toBe(404);
    expect((await start(req({ trade: "Real estate" }, "cross-site"))).status).toBe(403);
    expect(startRound).not.toHaveBeenCalled();
  });

  it("writes the round and answers when the replies are ready", async () => {
    const res = await start(req({ trade: "Real estate" }));
    expect(await res.json()).toEqual({ success: true, id: "r1", replies: 60 });
    expect(startRound).toHaveBeenCalledWith("Real estate", "u");
    expect(tooManyRecentActions).toHaveBeenCalledWith("b", "admin.train.mark", { windowMinutes: 24 * 60, max: 10 });
  });

  it("stops at the day's cap, and says why a round can't start", async () => {
    tooManyRecentActions.mockResolvedValueOnce(true);
    expect((await start(req({ trade: "Real estate" }))).status).toBe(429);
    startRound.mockResolvedValueOnce({ ok: false, reason: "running" });
    const busy = await start(req({ trade: "Real estate" }));
    expect(busy.status).toBe(409);
    expect((await busy.json()).message).toBe("FollowUp is already writing replies. It takes about 2 minutes.");
  });
});

describe("POST /api/admin/train/mark/reply", () => {
  it("is a 404 for anyone but the founder, and refused from another site", async () => {
    getSessionContext.mockResolvedValueOnce({ userId: "o", businessId: "b2", email: "owner@example.com", authTime: 0 });
    expect((await mark(req({ id: "x1", verdict: "send" }))).status).toBe(404);
    expect((await mark(req({ id: "x1", verdict: "send" }, "same-site"))).status).toBe(403);
    expect(markReply).not.toHaveBeenCalled();
  });

  it("keeps the founder's answer", async () => {
    expect((await mark(req({ id: "x1", verdict: "fix", marked: ["invented"] }))).status).toBe(200);
    expect(markReply).toHaveBeenCalledWith("x1", "fix", ["invented"]);
  });

  it("asks what's wrong on a No, and says when the reply is gone", async () => {
    const empty = await mark(req({ id: "x1", verdict: "fix", marked: [] }));
    expect(empty.status).toBe(400);
    expect((await empty.json()).message).toBe("Pick what's wrong with it, or Something else.");
    markReply.mockResolvedValueOnce(false);
    expect((await mark(req({ id: "gone", verdict: "send" }))).status).toBe(404);
  });
});
