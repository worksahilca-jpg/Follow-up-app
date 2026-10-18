import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, practiceReply, training } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  practiceReply: vi.fn(),
  training: {
    readConversation: vi.fn(() => ({ speakers: ["A", "B"], agent: "B", turns: [], examples: 1 })),
    saveConversation: vi.fn(),
    deleteConversation: vi.fn(),
    nextToScore: vi.fn(),
    getExample: vi.fn(),
    saveFollowUpReply: vi.fn(),
    setVerdict: vi.fn(),
    clearVerdicts: vi.fn(),
    VERDICTS: ["followup", "same", "agent"],
  },
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/practiceReply", () => ({ practiceReply }));
vi.mock("@/lib/training", () => training);
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn().mockResolvedValue(false) }));

process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";

function req(body: unknown, site = "same-origin") {
  return new NextRequest("http://localhost/api/admin/train", {
    method: "POST",
    headers: { "content-type": "application/json", "sec-fetch-site": site },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/train", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionContext.mockResolvedValue({ userId: "u", businessId: "b", email: "founder@example.com", authTime: 0 });
  });

  it("is a 404 for anyone but the founder", async () => {
    getSessionContext.mockResolvedValue({ userId: "u", businessId: "b", email: "owner@example.com", authTime: 0 });
    const { POST } = await import("@/app/api/admin/train/route");
    expect((await POST(req({ action: "read", raw: "A: hi\nB: yo" }))).status).toBe(404);
    expect(training.readConversation).not.toHaveBeenCalled();
  });

  it("refuses another site", async () => {
    const { POST } = await import("@/app/api/admin/train/route");
    expect((await POST(req({ action: "reset" }, "cross-site"))).status).toBe(403);
    expect(training.clearVerdicts).not.toHaveBeenCalled();
  });

  it("will not save without a kind of business it knows", async () => {
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(req({ action: "save", raw: "A: hi\nB: yo", agent: "B", trade: "Spaceships", channel: "text", permission: true }));
    expect(res.status).toBe(400);
    expect(training.saveConversation).not.toHaveBeenCalled();
  });

  it("will not save without the permission box", async () => {
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(req({ action: "save", raw: "A: hi\nB: yo", agent: "B", trade: "Legal", channel: "text", permission: false }));
    expect(res.status).toBe(400);
    expect(training.saveConversation).not.toHaveBeenCalled();
  });

  it("replays a moment as that kind of business, with that example kept out of its own prompt, WhatsApp in the email shape", async () => {
    process.env.OPENAI_API_KEY = "test";
    training.nextToScore.mockResolvedValue({
      id: "ex1",
      trade: "Legal",
      channel: "whatsapp",
      context: [{ from: "customer", text: "hi" }, { from: "agent", text: "hello" }],
      customerSaid: "price?",
      reply: "r",
      followUpReply: null,
    });
    practiceReply.mockResolvedValue({ reply: "FollowUp's answer" });
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(req({ action: "score" }));
    expect(res.status).toBe(200);
    const [, , turns, , channel, , opts] = practiceReply.mock.calls[0];
    expect(turns.map((t: { from: string }) => t.from)).toEqual(["customer", "followup", "customer"]);
    expect(channel).toBe("email");
    expect(opts).toEqual({ excludeTrainingId: "ex1", industry: "Legal" });
    expect(training.saveFollowUpReply).toHaveBeenCalledWith("ex1", "FollowUp's answer");
    delete process.env.OPENAI_API_KEY;
  });
});
