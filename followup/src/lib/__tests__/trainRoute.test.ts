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
    saveTalkExample: vi.fn<(input: unknown, userId: unknown) => Promise<{ id: string; conversationId: string }>>(async () => ({ id: "e1", conversationId: "c1" })),
    deleteExample: vi.fn(async () => true),
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

  it("talk: FollowUp answers as the chosen kind of business", async () => {
    process.env.OPENAI_API_KEY = "test";
    practiceReply.mockResolvedValue({ reply: "Hi! Yes it is.", verdict: { sends: true, reason: null }, qualification: null, buttons: [], contactAsked: false });
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(req({ action: "talk", trade: "Legal", channel: "messenger", turns: [{ from: "customer", text: "Do you do wills?" }] }));
    expect(res.status).toBe(200);
    const [, , turns, , channel, , opts] = practiceReply.mock.calls[0];
    expect(turns).toEqual([{ from: "customer", text: "Do you do wills?" }]);
    expect(channel).toBe("messenger");
    expect(opts).toEqual({ industry: "Legal" });
    delete process.env.OPENAI_API_KEY;
  });

  it("talk: refuses when the last message isn't the customer's", async () => {
    process.env.OPENAI_API_KEY = "test";
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(req({ action: "talk", trade: "Legal", channel: "email", turns: [{ from: "followup", text: "Hi" }] }));
    expect(res.status).toBe(400);
    expect(practiceReply).not.toHaveBeenCalled();
    delete process.env.OPENAI_API_KEY;
  });

  it("teach: keeps a taught reply with FollowUp's own answer beside it", async () => {
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(
      req({
        action: "teach",
        trade: "Real estate",
        channel: "instagram",
        context: [{ from: "customer", text: "hi" }, { from: "followup", text: "hello" }],
        customerSaid: "not sure yet",
        followUpReply: "When can we call?",
        taught: "No rush at all.",
      })
    );
    expect(res.status).toBe(200);
    const [input, userId] = training.saveTalkExample.mock.calls[0] as [{ context: { from: string }[]; taught: string; followUpReply: string }, string];
    expect(input.context.map((t: { from: string }) => t.from)).toEqual(["customer", "agent"]);
    expect(input.taught).toBe("No rush at all.");
    expect(input.followUpReply).toBe("When can we call?");
    expect(userId).toBe("u");
  });

  it("teach: an empty taught reply is refused, not saved as Good", async () => {
    const { POST } = await import("@/app/api/admin/train/route");
    const res = await POST(
      req({ action: "teach", trade: "Legal", channel: "email", context: [], customerSaid: "hi", followUpReply: "hello", taught: "   " })
    );
    expect(res.status).toBe(400);
    expect(training.saveTalkExample).not.toHaveBeenCalled();
  });

  it("untrain removes one example", async () => {
    const { POST } = await import("@/app/api/admin/train/route");
    expect((await POST(req({ action: "untrain", id: "e1" }))).status).toBe(200);
    expect(training.deleteExample).toHaveBeenCalledWith("e1");
  });
});
