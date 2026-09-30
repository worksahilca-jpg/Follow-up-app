/**
 * The lead check's prompt counts a lead marketplace's notice of one
 * person's request as customer business (backlog b007).
 *
 * It already said "automated platform notifications" are false and that a
 * no-reply address "weighs toward false", which is exactly what a
 * Thumbtack or Zillow lead email is. These tests pin what the model is
 * told; the eval (src/lib/classifierEval.ts, the "marketplace:" cases)
 * checks what it decides. No real OpenAI call is made here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    audio = { transcriptions: { create } };
  },
}));

import { classifyAsProspect } from "@/lib/integrations/openai";

const thumbtack = { name: "Dana Whitfield", email: "no-reply@thumbtack.com" };
const business = { name: "Sparkle Cleaning", industry: "Home services (contractor, cleaning, etc.)" };
const notice = [
  {
    id: "m1",
    direction: "inbound" as const,
    channel: "email" as const,
    body: "You have a new lead!\n\nDana Whitfield wants a quote for House Cleaning.\nName: Dana Whitfield\nPhone: (555) 010-4471",
    date: new Date().toISOString(),
    opened: false,
  },
];

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  create.mockReset();
  create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ whoIsSelling: "sender wants to buy from this business", reason: "a new lead", isProspect: true }) } }],
  });
});

async function prompt(options?: Parameters<typeof classifyAsProspect>[3]) {
  await classifyAsProspect(notice, thumbtack, business, options);
  const call = create.mock.calls[0][0];
  return { system: call.messages[0].content as string, schema: call.response_format.json_schema.schema };
}

describe("first read", () => {
  it("names the marketplaces and the shapes a lead arrives in, as customer business", async () => {
    const { system } = await prompt();
    expect(system).toMatch(/One kind of platform notification IS customer business: a LEAD MARKETPLACE/);
    for (const site of ["Thumbtack", "Angi", "HomeAdvisor", "Houzz", "Yelp", "Bark", "Porch", "Zillow", "Realtor.com", "HomeStars", "Kijiji", "REALTOR.ca"]) {
      expect(system).toContain(site);
    }
    expect(system).toMatch(/'you have a new lead', a new quote, job or project request, 'a customer sent you a message'/);
    expect(system).toMatch(/answer true, with whoIsSelling "sender wants to buy from this business"/);
    expect(system).toMatch(/even though the email comes from the platform's own no-reply address/);
  });

  it("keeps the marketplace's own mail out", async () => {
    const { system } = await prompt();
    expect(system).toMatch(/The platform's OWN mail stays false: receipts, invoices and billing for leads or ads, profile-view and performance reports/);
    expect(system).toMatch(/promotions, offers to buy more leads or upgrade, and review notifications/);
  });

  it("the no-reply rule names its one exception, and the other rules are untouched", async () => {
    const { system } = await prompt();
    expect(system).toMatch(/no-reply style address weighs toward false \(except a lead marketplace passing on a person's request, above\)/);
    expect(system).toMatch(/Answer false for: automated platform notifications/);
    expect(system).toMatch(/leads-for-sale/);
    expect(system).toMatch(/a solicitation from a named person is still a solicitation/);
    expect(system).toMatch(/verdict false, always/);
  });

  it("the schema's 'wants to buy' label covers a person a marketplace passes on", async () => {
    const { schema } = await prompt();
    expect(schema.properties.whoIsSelling.description).toMatch(/so does a person whose request a lead marketplace passes on/);
  });
});

describe("second look", () => {
  it("looks for a marketplace-passed request, and no longer dismisses every notification", async () => {
    const { system } = await prompt({ secondLook: { priorReason: "an automated platform notification" } });
    expect(system).toMatch(/SECOND LOOK/);
    expect(system).toMatch(/A lead marketplace passing on one person's request .* is that person asking: it counts/);
    expect(system).toMatch(/a notification that carries no person's request/);
    expect(system).toMatch(/Answer false only if the thread is clearly a seller pitching this business/);
  });
});
