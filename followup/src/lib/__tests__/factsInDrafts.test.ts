/**
 * What FollowUp knows reaches the draft, and the checks after it read it as
 * the owner's own words (A-096): a figure from it is grounded, not invented,
 * and the risk judge is told so. Without facts, every prompt and check is
 * exactly what it was before.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";

const create = vi.fn();
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  TRANSCRIBE_MODEL: "test-transcribe",
  getClient: () => ({ chat: { completions: { create } } }),
}));
const { factRows } = vi.hoisted(() => ({ factRows: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { businessFact: { findMany: factRows }, user: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://app.followup.test" }));

import { assessSendRisk, generateFollowUpMessage } from "@/lib/integrations/openai";
import { checkUnreviewedDraft } from "@/lib/unreviewedDraftCheck";

let n = 0;
function msg(direction: "inbound" | "outbound", body: string): Message {
  n += 1;
  return { id: `m${n}`, direction, channel: "email", body, date: new Date(Date.UTC(2026, 9, 1, 10, n)).toISOString() };
}
const thread = [msg("inbound", "Hi, I'm thinking of selling my condo this spring. What's your commission?")];
const FACTS = [{ label: "Commission", value: "2.5%" }];

beforeEach(() => {
  vi.clearAllMocks();
  factRows.mockResolvedValue([]);
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ subject: "Selling your condo", body: "My commission is 2.5%." }) } }] });
});

describe("the draft", () => {
  it("is told what the business has said before, as data, and to use it word for word", async () => {
    await generateFollowUpMessage({ name: "Ivy Sohal", conversation: thread, facts: FACTS });
    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toContain("<business_facts>\nCommission: 2.5%\n</business_facts>");
    expect(system).toMatch(/neither the conversation nor WHAT THIS BUSINESS HAS TOLD CUSTOMERS/);
  });

  it("is told nothing extra when there is nothing known", async () => {
    await generateFollowUpMessage({ name: "Ivy Sohal", conversation: thread });
    expect(create.mock.calls[0][0].messages[0].content).not.toContain("<business_facts>");
  });
});

describe("the risk judge", () => {
  it("sees the facts as the owner's own statements", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ riskLevel: "low", reason: "", topic: "price" }) } }] });
    await assessSendRisk({ conversation: thread, facts: FACTS }, "My commission is 2.5%.");
    const [system, user] = create.mock.calls[0][0].messages.map((m: { content: string }) => m.content);
    expect(system).toMatch(/business's own statement, not a fabrication/);
    expect(user).toContain("<business_facts>\nCommission: 2.5%\n</business_facts>");
  });

  it("is asked exactly as before without facts", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ riskLevel: "low", reason: "", topic: "other" }) } }] });
    await assessSendRisk({ conversation: thread }, "Thanks, I'll confirm my commission.");
    const [system, user] = create.mock.calls[0][0].messages.map((m: { content: string }) => m.content);
    expect(system).not.toContain("business_facts");
    expect(user).not.toContain("business_facts");
  });
});

describe("the made-up-number check before an unreviewed send", () => {
  it("holds a figure nobody wrote", async () => {
    expect(await checkUnreviewedDraft({ text: "My commission is 2.5%.", conversation: thread, businessId: "biz1", leadId: "lead1" })).toBe("digits");
  });

  it("passes a figure the business has told customers before, read for this business only", async () => {
    factRows.mockResolvedValue(FACTS);
    expect(await checkUnreviewedDraft({ text: "My commission is 2.5%.", conversation: thread, businessId: "biz1", leadId: "lead1" })).toBeNull();
    expect(factRows.mock.calls[0][0].where).toEqual({ businessId: "biz1" });
  });

  it("still holds a different figure", async () => {
    factRows.mockResolvedValue(FACTS);
    expect(await checkUnreviewedDraft({ text: "My commission is 3%.", conversation: thread, businessId: "biz1", leadId: "lead1" })).toBe("digits");
  });
});
