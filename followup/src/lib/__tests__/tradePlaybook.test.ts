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
import { draftDm } from "@/lib/dmDrafting";

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

  it("reads \"how much do you charge\" as the agent's fee, and saves the showing for a named home (2026-10-11)", () => {
    const p = playbookFor("Real estate");
    expect(p).toMatch(/ask about the agent's own fee, not a home's price/);
    expect(p).toMatch(/answer with the commission or fee in WHAT THIS BUSINESS HAS TOLD CUSTOMERS/);
    expect(p).toMatch(/Offer a showing only once they have named a specific home or listing/);
  });

  // The trust research (A-247): Ontario needs a verifiable basis for a
  // ranking, and another agent's client is dealt with through that agent.
  it("never brags, never names a past client, and lets an agent's client go with a warm close", () => {
    const p = playbookFor("Real estate");
    expect(p).toMatch(/Never call the agent a top, #1, award-winning or best agent/);
    expect(p).toMatch(/never name a past client, a sold address or a sale price/);
    expect(p).toMatch(/already have an agent .* short, warm close/);
    expect(p).toMatch(/no attempt to win them back/);
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

describe("the DM writer (founder's Instagram test, 2026-10-11)", () => {
  const dmThread = [
    { id: "d1", direction: "inbound", body: "Hi, how much do you charge and are you free?", date: new Date().toISOString(), channel: "instagram" },
  ] as never;

  beforeEach(() => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ body: "I'll confirm my fee and when I'm free. Which area are you looking in?", buttons: [] }) } }],
    });
  });

  it("gets the realtor playbook too, which it never did", async () => {
    await draftDm("Priya Sharma", dmThread, [], undefined, undefined, undefined, [], null, "Real estate");
    expect(systemPrompt()).toContain("THIS BUSINESS IS A REAL ESTATE AGENT");
  });

  it("answers every question they asked before asking its own, and never hands their words back as a verdict", async () => {
    await draftDm("Priya Sharma", dmThread, [], undefined);
    const prompt = systemPrompt();
    expect(prompt).toMatch(/their questions come first/);
    expect(prompt).toMatch(/cover every one, briefly and in the order asked/);
    expect(prompt).toMatch(/Never hand their own words back as a one-line verdict/);
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

