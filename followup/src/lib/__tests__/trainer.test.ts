/**
 * "Claude on the Train page" (A-298): Claude answers with words and cards, tests replies through FollowUp, saves a
 * rule only through its tools, never without the key, and remembers the talk.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { prisma, practiceReply, rules } = vi.hoisted(() => ({
  prisma: { trainerMessage: { findMany: vi.fn(), create: vi.fn() } },
  practiceReply: vi.fn(),
  rules: {
    listTrainingRules: vi.fn(),
    saveTrainingRule: vi.fn(),
    updateTrainingRule: vi.fn(async () => true),
    deleteTrainingRule: vi.fn(async () => true),
  },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/practiceReply", () => ({ practiceReply }));
vi.mock("@/lib/trainingRules", () => rules);
vi.mock("@/lib/tradePlaybooks", () => ({ playbookFor: (t: string) => `PLAN FOR ${t}` }));

import { askTrainer, trainerReady } from "@/lib/trainer";

const fetchMock = vi.fn();
const answer = (content: unknown[], stop_reason = "end_turn") => ({ ok: true, json: async () => ({ content, stop_reason }) });
const talk = {
  trade: "Real estate",
  channel: "instagram" as const,
  turns: [
    { from: "customer" as const, text: "i saw your listing" },
    { from: "followup" as const, text: "Which area are you looking in?" },
  ],
  focus: 1,
};

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.stubEnv("ANTHROPIC_MODEL", "test-model");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  prisma.trainerMessage.findMany.mockResolvedValue([]);
  prisma.trainerMessage.create.mockImplementation(async ({ data }: { data: { role: string } }) => ({ id: `m-${data.role}`, createdAt: new Date() }));
  rules.listTrainingRules.mockResolvedValue([{ id: "r0", trade: "Real estate", text: "Ask the area first.", createdAt: new Date() }]);
  rules.saveTrainingRule.mockImplementation(async (i: { text: string }) => ({ id: "r1", text: i.text }));
  practiceReply.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("trainerReady", () => {
  it("needs both the key and the model", () => {
    expect(trainerReady()).toBe(true);
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(trainerReady()).toBe(false);
  });
});

describe("askTrainer", () => {
  it("gives Claude the brief, the kind's plan, every rule with its id, and the chat with the asked-about answer marked", async () => {
    fetchMock.mockResolvedValueOnce(answer([{ type: "text", text: "Agreed." }]));
    const turn = await askTrainer({ businessId: "b", userId: "u", message: "galat hai, write me at a@b.com", talk });
    expect(turn.text).toBe("Agreed.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("test-model");
    expect(body.system[0].text).toContain("PLAN FOR Real estate");
    expect(body.system[0].text).toContain("- [r0] Ask the area first.");
    const last = body.messages[body.messages.length - 1].content as string;
    expect(last).toContain(">> [FollowUp] Which area are you looking in?");
    // His words are kept without the email address.
    const kept = prisma.trainerMessage.create.mock.calls[0][0].data;
    expect(kept.role).toBe("founder");
    expect(kept.text).not.toContain("a@b.com");
  });

  it("proposes without saving, and tests replies through FollowUp as that kind", async () => {
    practiceReply.mockResolvedValue({ reply: "Which listing caught your eye?" });
    fetchMock
      .mockResolvedValueOnce(
        answer(
          [
            { type: "tool_use", id: "t1", name: "test_reply", input: { trade: "Real estate", channel: "instagram", chat: [{ from: "customer", text: "is the 3 bed still available?" }] } },
            { type: "tool_use", id: "t2", name: "propose_rule", input: { trade: "Real estate", text: "When a customer mentions a listing, ask which one.", replaces_id: "r0" } },
          ],
          "tool_use"
        )
      )
      .mockResolvedValueOnce(answer([{ type: "text", text: "Here's what I'd change." }]));
    const turn = await askTrainer({ businessId: "b", userId: "u", message: "fix it", talk });
    expect(practiceReply).toHaveBeenCalledWith("b", "there", [{ from: "customer", text: "is the 3 bed still available?" }], null, "instagram", false, { industry: "Real estate" });
    expect(rules.saveTrainingRule).not.toHaveBeenCalled();
    expect(turn.cards).toEqual([
      { kind: "test", trade: "Real estate", customer: "is the 3 bed still available?", reply: "Which listing caught your eye?" },
      { kind: "proposal", trade: "Real estate", text: "When a customer mentions a listing, ask which one.", replacesId: "r0", replacesText: "Ask the area first." },
    ]);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body);
    const results = second.messages[second.messages.length - 1].content;
    expect(results.map((r: { tool_use_id: string }) => r.tool_use_id)).toEqual(["t1", "t2"]);
  });

  it("saves, changes and removes only known rules for known kinds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        answer(
          [
            { type: "tool_use", id: "a", name: "save_rule", input: { trade: "Real estate", text: "Offer a viewing." } },
            { type: "tool_use", id: "b", name: "save_rule", input: { trade: "Spaceships", text: "Fly." } },
            { type: "tool_use", id: "c", name: "change_rule", input: { id: "nope", text: "x" } },
            { type: "tool_use", id: "d", name: "remove_rule", input: { id: "r0" } },
          ],
          "tool_use"
        )
      )
      .mockResolvedValueOnce(answer([{ type: "text", text: "Done." }]));
    const turn = await askTrainer({ businessId: "b", userId: "u", message: "haan save karo", talk });
    expect(rules.saveTrainingRule).toHaveBeenCalledTimes(1);
    expect(rules.updateTrainingRule).not.toHaveBeenCalled();
    expect(rules.deleteTrainingRule).toHaveBeenCalledWith("r0");
    expect(turn.cards.map((c) => c.kind)).toEqual(["saved", "removed"]);
    const results = JSON.parse(fetchMock.mock.calls[1][1].body).messages.at(-1).content;
    expect(results.filter((r: { is_error?: boolean }) => r.is_error)).toHaveLength(2);
  });

  it("stops testing after six in one answer", async () => {
    practiceReply.mockResolvedValue({ reply: "ok" });
    const use = (id: string) => ({ type: "tool_use", id, name: "test_reply", input: { trade: "Legal", channel: "email", chat: [{ from: "customer", text: "hi" }] } });
    fetchMock
      .mockResolvedValueOnce(answer(["1", "2", "3", "4", "5", "6", "7", "8"].map(use), "tool_use"))
      .mockResolvedValueOnce(answer([{ type: "text", text: "Tested." }]));
    await askTrainer({ businessId: "b", userId: "u", message: "test", talk });
    expect(practiceReply).toHaveBeenCalledTimes(6);
  });

  it("remembers the talk: earlier messages and cards go back to Claude, starting with him", async () => {
    prisma.trainerMessage.findMany.mockResolvedValue([
      { id: "2", role: "claude", text: "Saved it.", cards: [{ kind: "saved", id: "r0", trade: "Real estate", text: "Ask the area first." }], createdAt: new Date() },
      { id: "1", role: "founder", text: "save", cards: null, createdAt: new Date() },
    ]);
    fetchMock.mockResolvedValueOnce(answer([{ type: "text", text: "Hi again." }]));
    await askTrainer({ businessId: "b", userId: "u", message: "next one", talk });
    const msgs = JSON.parse(fetchMock.mock.calls[0][1].body).messages;
    expect(msgs.map((m: { role: string }) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[1].content).toContain("(saved r0 for Real estate: Ask the area first.)");
  });

  it("throws when Claude can't be reached, with his message already kept", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 529, json: async () => ({}) });
    await expect(askTrainer({ businessId: "b", userId: "u", message: "hello", talk })).rejects.toThrow();
    expect(prisma.trainerMessage.create).toHaveBeenCalledTimes(1);
  });
});
