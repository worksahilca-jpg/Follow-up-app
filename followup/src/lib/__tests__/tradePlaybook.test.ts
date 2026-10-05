/**
 * A realtor's replies follow a realtor's playbook (founder, 2026-10-04:
 * "a realtor's account should be a realtor assistant"). Only real estate
 * has one for now; every other trade writes exactly as before.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  TRANSCRIBE_MODEL: "test-transcribe",
  getClient: () => ({ chat: { completions: { create } } }),
}));
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { generateFollowUpMessage } from "@/lib/integrations/openai";
import { playbookFor, businessTrade } from "@/lib/tradePlaybooks";

const conversation = [
  { id: "m1", direction: "inbound", body: "Hi, is the 3-bedroom on Maple St still available? Could I see it Saturday?", date: new Date().toISOString(), channel: "email" },
] as never;

function systemPrompt(): string {
  return create.mock.calls[0][0].messages[0].content as string;
}

beforeEach(() => {
  create.mockReset();
  findUnique.mockReset();
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ subject: "Maple St", body: "Yes, happy to show it." }) } }] });
});

describe("the playbook", () => {
  it("exists for real estate, and says the things a good agent never does", () => {
    const p = playbookFor("Real estate");
    expect(p).toMatch(/REAL ESTATE AGENT/);
    expect(p).toMatch(/never pick a day or time yourself/);
    expect(p).toMatch(/never give a value, range or opinion/);
    expect(p).toMatch(/those always win/);
  });

  it("is nothing for a trade without one, or no trade at all", () => {
    expect(playbookFor("Legal")).toBe("");
    expect(playbookFor("Other")).toBe("");
    expect(playbookFor(null)).toBe("");
  });
});

describe("the reply writer", () => {
  it("gets the realtor playbook for a real estate business", async () => {
    await generateFollowUpMessage({ name: "Priya Sharma", conversation, trade: "Real estate" });
    expect(systemPrompt()).toContain("THIS BUSINESS IS A REAL ESTATE AGENT");
  });

  it("writes exactly as before for every other business", async () => {
    await generateFollowUpMessage({ name: "Priya Sharma", conversation, trade: "Legal" });
    const withOther = systemPrompt();
    create.mockClear();
    await generateFollowUpMessage({ name: "Priya Sharma", conversation });
    expect(withOther).toBe(systemPrompt());
    expect(withOther).not.toContain("REAL ESTATE AGENT");
  });
});

describe("reading the trade", () => {
  it("is the business's industry", async () => {
    findUnique.mockResolvedValue({ industry: "Real estate" });
    expect(await businessTrade("biz1")).toBe("Real estate");
  });

  it("never loses a draft over it: a failed read is no trade", async () => {
    findUnique.mockRejectedValue(new Error("db blip"));
    expect(await businessTrade("biz1")).toBeNull();
  });
});

describe("rules every business gets (founder's live test, 2026-10-05)", () => {
  it("never claims something is available, and answers every question", async () => {
    await generateFollowUpMessage({ name: "Priya Sharma", conversation, trade: "Other" });
    const prompt = systemPrompt();
    expect(prompt).toMatch(/Never say that something is or isn't available/);
    expect(prompt).toMatch(/address every one of them/);
  });
});

