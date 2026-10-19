/**
 * A realtor's replies follow a realtor's playbook (founder, 2026-10-04:
 * "a realtor's account should be a realtor assistant"). Since A-296
 * (2026-10-19) every kind of business has a plan, and a kind without its
 * own gets the general one: no business answers without a plan again.
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
import { playbookFor, firstAskFor, businessTrade } from "@/lib/tradePlaybooks";
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

  // The founder's Talk test, 2026-10-18: "i saw your listing" got "Which area in Toronto are you looking in?".
  it("talks about the listing they saw instead of asking which area", () => {
    const p = playbookFor("Real estate");
    expect(p).toMatch(/saw a listing, post or ad of yours without saying which, they have already picked a home/);
    expect(p).toMatch(/never ask which area they are looking in/);
    expect(p).toMatch(/Ask which one caught their eye, and whether they would like to see it or have a quick call first/);
  });

  // R-135 / A-296: a business set to anything but real estate got no plan at all.
  it("gives every other kind its own plan: a goal, three steps of two things, the meeting by step 2", () => {
    const kinds: [string, RegExp, RegExp][] = [
      ["Mortgage brokerage", /A MORTGAGE BROKER/, /Never quote a rate/],
      ["Home services (contractor, cleaning, etc.)", /A HOME SERVICES BUSINESS/, /Never give a price before the job has been seen/],
      ["Dental / medical clinic", /A HEALTH OR DENTAL CLINIC/, /Never ask about symptoms or health details in a message/],
      ["Legal", /A LAWYER OR LAW FIRM/, /Never give legal advice/],
      ["Marketing agency", /A MARKETING AGENCY/, /Never promise results or numbers/],
    ];
    for (const [kind, who, never] of kinds) {
      const p = playbookFor(kind);
      expect(p).toMatch(who);
      expect(p).toMatch(never);
      expect(p).toMatch(/Step 1: .*Step 2: .*Step 3: /);
      expect(p).toMatch(/asks about two things together, joined with "and", with a single question mark/);
      expect(p).toMatch(/never ask the same thing twice in other words/);
      expect(p).toMatch(/never suggest a day or time yourself/);
      expect(p).toMatch(/those always win/);
    }
    expect(playbookFor("Legal")).toMatch(/Every conversation works toward a consultation/);
    expect(playbookFor("Dental / medical clinic")).toMatch(/call the clinic now, or emergency services/);
  });

  it("gives the general plan to \"Other\", no kind, or a kind it doesn't know", () => {
    const general = playbookFor("Other");
    expect(general).toMatch(/A SMALL BUSINESS/);
    expect(general).toMatch(/Never guess what the business offers/);
    expect(playbookFor(null)).toBe(general);
    expect(playbookFor("Bakery")).toBe(general);
  });

  it("names the first question of each plan for the instant reply", () => {
    expect(firstAskFor("Real estate")).toMatch(/^whether they are looking to buy, sell or rent, and roughly when/);
    expect(firstAskFor("Legal")).toBe("what kind of matter it is, and whether there is a date coming up");
    expect(firstAskFor(null)).toBe("what they are looking for, and when they need it");
  });
});

describe("the reply writer", () => {
  it("gets the realtor playbook for a real estate business", async () => {
    await generateFollowUpMessage({ name: "Priya Sharma", conversation, trade: "Real estate" });
    expect(systemPrompt()).toContain("THIS BUSINESS IS A REAL ESTATE AGENT");
  });

  it("gets the plan for its own kind, never the realtor's", async () => {
    await generateFollowUpMessage({ name: "Priya Sharma", conversation, trade: "Legal" });
    const legal = systemPrompt();
    expect(legal).toContain("THIS BUSINESS IS A LAWYER OR LAW FIRM");
    expect(legal).not.toContain("REAL ESTATE AGENT");
    create.mockClear();
    await generateFollowUpMessage({ name: "Priya Sharma", conversation });
    expect(systemPrompt()).toContain("THIS BUSINESS IS A SMALL BUSINESS");
  });

  // R-135: replies with no welcome, and "I'll check" when nothing was asked.
  it("opens warmly and only promises to check what was actually asked", async () => {
    await generateFollowUpMessage({ name: "Priya Sharma", conversation, trade: "Real estate" });
    const prompt = systemPrompt();
    expect(prompt).toMatch(/Sound glad they wrote: open with a few warm words that react to what they just said/);
    expect(prompt).toMatch(/never reuse an opener the business already sent in this conversation/);
    expect(prompt).toMatch(/Only say you'll check or confirm something when their message actually asked about it/);
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
    expect(prompt).toMatch(/"I saw your listing" or "I'm interested in buying" asks nothing/);
    expect(prompt).toMatch(/joins the two things in WHAT TO LEARN NEXT or in the business's plan below/);
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

