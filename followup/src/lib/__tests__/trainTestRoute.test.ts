/**
 * A-319: "Test them" on Admin → Train is founder only, from this site only, and capped per day.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, runLessonTest, tooManyRecentActions } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  runLessonTest: vi.fn(),
  tooManyRecentActions: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/lessonTest", () => ({ runLessonTest }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
// The founder list is read when the route loads, so it loads after the line above.
const { POST } = await import("@/app/api/admin/train/test/route");

function req(body: unknown, site = "same-origin") {
  return new NextRequest("http://localhost/api/admin/train/test", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": site },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/train/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    getSessionContext.mockResolvedValue({ userId: "u", businessId: "b", email: "founder@example.com", authTime: 0 });
    tooManyRecentActions.mockResolvedValue(false);
    runLessonTest.mockResolvedValue({ ok: true, id: "t1" });
  });

  it("is a 404 for anyone but the founder, and refused from another site", async () => {
    getSessionContext.mockResolvedValueOnce({ userId: "o", businessId: "b2", email: "owner@example.com", authTime: 0 });
    expect((await POST(req({ trade: "Real estate" }))).status).toBe(404);
    expect((await POST(req({ trade: "Real estate" }, "cross-site"))).status).toBe(403);
    expect(runLessonTest).not.toHaveBeenCalled();
  });

  it("runs the test for the kind and answers when it has finished", async () => {
    const res = await POST(req({ trade: "Real estate" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, id: "t1" });
    expect(runLessonTest).toHaveBeenCalledWith("Real estate", "u");
  });

  it("says in plain words why a test can't run", async () => {
    runLessonTest.mockResolvedValueOnce({ ok: false, reason: "running" });
    const busy = await POST(req({ trade: "Real estate" }));
    expect(busy.status).toBe(409);
    expect((await busy.json()).message).toBe("A test is already running. It takes about 3 minutes.");

    runLessonTest.mockResolvedValueOnce({ ok: false, reason: "failed", message: "FollowUp couldn't write 2 of the 120 replies. Test again." });
    const failed = await POST(req({ trade: "Real estate" }));
    expect(failed.status).toBe(502);
    expect((await failed.json()).message).toBe("FollowUp couldn't write 2 of the 120 replies. Test again.");
  });

  it("never runs without a way to write replies, past the daily cap, or for a kind that doesn't exist", async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await POST(req({ trade: "Real estate" }))).status).toBe(503);
    process.env.OPENAI_API_KEY = "test-key";
    tooManyRecentActions.mockResolvedValueOnce(true);
    expect((await POST(req({ trade: "Real estate" }))).status).toBe(429);
    expect(tooManyRecentActions).toHaveBeenCalledWith("b", "admin.train.test", { windowMinutes: 24 * 60, max: 20 });
    expect((await POST(req({ trade: "Not a kind" }))).status).toBe(400);
    expect(runLessonTest).not.toHaveBeenCalled();
  });
});
