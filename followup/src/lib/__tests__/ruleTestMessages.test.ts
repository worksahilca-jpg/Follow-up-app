/**
 * Plan step 3: messages written for each waiting rule, so the lesson test shows whether the rule does its job. Written
 * once per wording and kept, so every test of the same wording uses the same messages.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { create, prisma } = vi.hoisted(() => ({
  create: vi.fn(),
  prisma: { trainingRule: { updateMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma }));
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  getClient: () => ({ chat: { completions: { create } } }),
  withAiContext: (_ctx: unknown, run: () => unknown) => run(),
}));

import { casesForRule, MAX_TARGETED_RULES, parseWritten, storedFor, targetedCases, type RuleTestMessage } from "@/lib/ruleTestMessages";

const RULE = "When someone asks about a showing time, say the owner will confirm it.";
const written = {
  messages: [
    { text: "Can I see the Elm St semi Sunday at 2?", asks: ["whether they can see it Sunday at 2"] },
    { text: "Is the King St condo free to view after work Thursday?", asks: ["whether they can view it Thursday after work"] },
  ],
  reworded: { text: "Would Sunday 2pm work for a look at the semi on Elm?", asks: ["whether Sunday 2pm works"] },
};
const answer = (body: unknown) => ({ id: "chatcmpl-1", choices: [{ message: { content: JSON.stringify(body) } }] });

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue(answer(written));
  prisma.trainingRule.updateMany.mockResolvedValue({ count: 1 });
});

describe("parseWritten", () => {
  it("takes two messages and the first one reworded, with what each asks", () => {
    const out = parseWritten(written)!;
    expect(out.map((m) => m.reworded)).toEqual([false, false, true]);
    expect(out[0]).toEqual({ text: "Can I see the Elm St semi Sunday at 2?", asks: ["whether they can see it Sunday at 2"], reworded: false });
  });

  it("refuses an answer that is missing a message, or the reworded one", () => {
    expect(parseWritten({ ...written, messages: written.messages.slice(0, 1) })).toBeNull();
    expect(parseWritten({ messages: written.messages })).toBeNull();
    expect(parseWritten({ ...written, messages: [{ text: " ", asks: [] }, written.messages[1]] })).toBeNull();
  });
});

describe("storedFor", () => {
  it("keeps the messages only for the wording they were written for", () => {
    const messages: RuleTestMessage[] = parseWritten(written)!;
    expect(storedFor({ version: 2, messages }, 2)).toEqual(messages);
    expect(storedFor({ version: 1, messages }, 2)).toBeNull();
    expect(storedFor(null, 1)).toBeNull();
  });
});

describe("casesForRule", () => {
  it("names each message after its rule, tells them apart, and reads each against the rule", () => {
    const cases = casesForRule(RULE, parseWritten(written)!);
    expect(cases.map((c) => c.name)).toEqual([
      "“When someone asks about a showing time, say the owner will…” · message 1",
      "“When someone asks about a showing time, say the owner will…” · message 2",
      "“When someone asks about a showing time, say the owner will…” · message 1, reworded",
    ]);
    expect(cases[0]).toMatchObject({ lines: [["in", "Can I see the Elm St semi Sunday at 2?"]], asks: ["whether they can see it Sunday at 2"], rule: RULE });
  });
});

describe("targetedCases", () => {
  const rule = (id: string, testMessages: unknown = null) => ({ id, text: RULE, version: 1, testMessages });

  it("writes messages for a rule once and keeps them on that wording", async () => {
    const cases = await targetedCases("Real estate", [rule("r1")]);
    expect(cases).toHaveLength(3);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].messages[1].content).toBe(`KIND OF BUSINESS: Real estate\nRULE: ${RULE}`);
    expect(prisma.trainingRule.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", version: 1 },
      data: { testMessages: { version: 1, messages: parseWritten(written) } },
    });
  });

  it("reuses the kept messages, so every test of the same wording asks the same things", async () => {
    const cases = await targetedCases("Real estate", [rule("r1", { version: 1, messages: parseWritten(written) })]);
    expect(cases).toHaveLength(3);
    expect(create).not.toHaveBeenCalled();
  });

  it("writes for at most a few rules, and a rule whose messages can't be written never stops the test", async () => {
    create.mockResolvedValueOnce(answer({ messages: [] }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rules = Array.from({ length: MAX_TARGETED_RULES + 2 }, (_, i) => rule(`r${i}`));
    const cases = await targetedCases("Real estate", rules);
    expect(create).toHaveBeenCalledTimes(MAX_TARGETED_RULES);
    expect(cases).toHaveLength((MAX_TARGETED_RULES - 1) * 3);
  });
});
