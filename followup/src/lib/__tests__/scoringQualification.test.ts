/**
 * The checklist inside the reply step (src/lib/scoring.ts, A-246): a
 * realtor's customer is read when they write, the reply may ask about the
 * next round (one or two things), the ready moment is stamped once, a
 * customer with an agent stops being followed up, and nothing about it can
 * hold up or change a reply for any other line of work.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  lead: null as Record<string, unknown> | null,
  update: vi.fn(),
  updateMany: vi.fn(),
  notify: vi.fn(),
  booking: vi.fn(),
  extract: vi.fn(),
  generate: vi.fn(),
  draftDm: vi.fn(),
  pushNote: vi.fn(),
  moveTier: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(async () => h.lead), update: h.update, updateMany: h.updateMany },
    notification: { create: h.notify },
    booking: { findFirst: h.booking },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn(async () => false) }));
vi.mock("@/lib/billing", () => ({ checkAiEligibility: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/lib/integrations/openai", () => ({
  scoreLead: vi.fn(async () => ({ score: 50, reason: "Asked about a listing", factors: [], saysNo: false, asksIfAutomated: false, onlyThanks: false })),
  generateFollowUpMessage: h.generate,
  extractQualificationFacts: h.extract,
}));
vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: vi.fn(async (_n: string, _b: string, body: string) => body),
  latestInboundText: (c: { direction: string; body: string }[]) => [...c].reverse().find((m) => m.direction === "inbound")?.body ?? null,
}));
vi.mock("@/lib/dmDrafting", () => ({ draftDm: h.draftDm }));
vi.mock("@/lib/voice", () => ({ getVoiceSamples: vi.fn(async () => []) }));
vi.mock("@/lib/leadLanguage", () => ({ detectLeadLanguage: vi.fn(async () => null), leadLanguageOf: () => null }));
vi.mock("@/lib/slack", () => ({ notifySlack: vi.fn(), escapeSlackText: (s: string) => s }));
vi.mock("@/lib/businessFacts", () => ({ draftingContext: vi.fn(async () => ({ trade: "Real estate", facts: [] })), getBusinessFacts: vi.fn(async () => []) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/pendingApprovals", () => ({ heldSince: vi.fn(async () => true) }));
vi.mock("@/lib/crm/notes", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/crm/notes")>()), pushCrmNote: h.pushNote }));
vi.mock("@/lib/crm/stages", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/crm/stages")>()), moveLeadForTier: h.moveTier }));

import { scoreAndDraftForLead } from "@/lib/scoring";

function message(direction: "inbound" | "outbound", body: string, minute: number) {
  return {
    id: `m${minute}`,
    direction,
    body,
    sentAt: new Date(Date.UTC(2026, 9, 9, 10, minute)),
    opened: false,
    source: null,
    trigger: null,
    quickReplyPayload: null,
    deliveryStatus: null,
  };
}

function setLead(
  opts: {
    industry?: string;
    messages?: ReturnType<typeof message>[];
    qualification?: unknown;
    qualifiedAt?: Date | null;
    assignedToId?: string | null;
    crm?: { provider: string; id: string };
    channel?: string;
    dmContactAskedAt?: Date | null;
    dmEmail?: string | null;
  } = {}
) {
  h.lead = {
    id: "lead1",
    businessId: "biz1",
    name: "Nadia Khan",
    dealValue: 0,
    lastContacted: null,
    createdAt: new Date(Date.UTC(2026, 9, 9, 9)),
    priority: "NONE",
    automationTier: "ASSISTED",
    assignedToId: opts.assignedToId === undefined ? "owner1" : opts.assignedToId,
    language: null,
    qualification: opts.qualification ?? null,
    qualifiedAt: opts.qualifiedAt ?? null,
    email: null,
    crmProvider: opts.crm?.provider ?? null,
    crmId: opts.crm?.id ?? null,
    dmEmail: opts.dmEmail ?? null,
    dmContactAskedAt: opts.dmContactAskedAt ?? null,
    business: { tier: "pro", name: "Maple Realty", industry: opts.industry ?? "Real estate", timezone: "America/Toronto" },
    conversations: [
      {
        channel: opts.channel ?? "email",
        messages: opts.messages ?? [message("inbound", "Is the 3 bed on Elm St still for sale? We're hoping to move in about 2 months.", 1)],
      },
    ],
  };
}

const updateData = () => h.update.mock.calls[0][0].data as Record<string, unknown>;
const said = (key: string, value: string, quote: string, bucket = "") => ({ key, known: true, value, quote, bucket });

const FIRST = [
  said("side", "Buying", "still for sale", "buy"),
  said("area", "Elm St", "the 3 bed on Elm St"),
  said("timing", "In about 2 months", "move in about 2 months", "soon"),
];
// The approved drawing's buyer, after three rounds.
const READY_THREAD = [
  message("inbound", "Is the 3 bed on Elm St still for sale? We're hoping to move in about 2 months.", 1),
  message("outbound", "It is. Have you been pre-approved yet, and what price range should I keep an eye on?", 2),
  message("inbound", "Yes, pre-approved up to 900k", 3),
  message("outbound", "Perfect. Are you working with an agent yet? If not, I'd be happy to show it to you.", 4),
  message("inbound", "No agent. Saturday morning works", 5),
];
const READY = [
  ...FIRST,
  said("financing", "Pre-approved up to $900k", "pre-approved up to 900k", "sorted"),
  said("budget", "Up to $900k", "pre-approved up to 900k"),
  said("agent", "No agent yet", "No agent.", "none"),
  said("viewing", "Saturday morning", "Saturday morning works"),
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  h.updateMany.mockResolvedValue({ count: 1 });
  h.generate.mockResolvedValue({ subject: "The 3 bed", body: "Yes, it's available." });
  h.booking.mockResolvedValue(null);
  h.extract.mockResolvedValue(FIRST);
});

describe("a realtor's customer who just wrote", () => {
  it("is read, saved with their words, and the reply asks the next round — the meeting and the agent, in one sentence — once", async () => {
    setLead();
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(h.extract).toHaveBeenCalledTimes(1);
    expect(h.generate.mock.calls[0][0].qualify.ask).toBe(
      "whether they would like to see the home or have a quick call about it, as an open question; never suggest a day, a time, or weekday versus weekend yourself, and whether they have been seeing homes with an agent so far, or just on their own"
    );
    expect(updateData().qualification).toEqual({
      v: 2,
      template: "realtor",
      items: [
        { key: "side", value: "Buying", quote: "still for sale", bucket: "buy" },
        { key: "area", value: "Elm St", quote: "the 3 bed on Elm St" },
        { key: "timing", value: "In about 2 months", quote: "move in about 2 months", bucket: "soon" },
      ],
      offered: ["viewing", "agent"],
    });
    expect(updateData().saidNoAt).toBeNull();
    expect(h.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { qualifiedAt: expect.any(Date) } }));
  });

  it("never stores a quote that isn't really theirs", async () => {
    setLead();
    h.extract.mockResolvedValue([said("budget", "Up to $950k", "we can do 950")]);
    await scoreAndDraftForLead("lead1");
    expect((updateData().qualification as { items: unknown[] }).items).toEqual([]);
  });

  it("becomes ready once, with one bell — not a second one for going hot", async () => {
    setLead({ messages: READY_THREAD });
    h.extract.mockResolvedValue(READY);
    const { scoreLead } = await import("@/lib/integrations/openai");
    vi.mocked(scoreLead).mockResolvedValueOnce({ score: 90, reason: "Ready to view", factors: [], saysNo: false, asksIfAutomated: false, onlyThanks: false } as never);
    await scoreAndDraftForLead("lead1");
    expect(h.generate.mock.calls[0][0].qualify).toBeNull();
    expect((updateData().qualification as { tier?: string }).tier).toBe("ready");
    expect(h.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", qualifiedAt: null }, data: { qualifiedAt: expect.any(Date) } });
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify.mock.calls[0][0].data.message).toBe("Nadia Khan is ready — Pre-approved up to $900k · In about 2 months · Elm St · No agent yet");
  });

  // A-237: the ready card goes into the owner's CRM too, once, with the customer's own words.
  it("puts the ready card into the CRM the customer came from, once", async () => {
    h.extract.mockResolvedValue(READY);
    setLead({ messages: READY_THREAD, crm: { provider: "followupboss", id: "fub-42" } });
    await scoreAndDraftForLead("lead1");
    expect(h.pushNote).toHaveBeenCalledTimes(1);
    expect(h.pushNote).toHaveBeenCalledWith(
      { id: "lead1", businessId: "biz1", crmProvider: "followupboss", crmId: "fub-42" },
      [
        "FollowUp: Nadia Khan looks ready to talk.",
        'Area: Elm St ("the 3 bed on Elm St")',
        'When: In about 2 months ("move in about 2 months")',
        'Viewing: Saturday morning ("Saturday morning works")',
        'Agent: No agent yet ("No agent.")',
        'Money: Pre-approved up to $900k ("pre-approved up to 900k")',
        'Price range: Up to $900k ("pre-approved up to 900k")',
      ].join("\n")
    );

    // A second pass that lost the race to stamp it pushes nothing.
    vi.clearAllMocks();
    h.updateMany.mockResolvedValue({ count: 0 });
    setLead({ messages: READY_THREAD, crm: { provider: "followupboss", id: "fub-42" } });
    await scoreAndDraftForLead("lead1");
    expect(h.pushNote).not.toHaveBeenCalled();
  });

  it("moves them to the owner's stage for their new tier in that CRM, with the reason (A-303)", async () => {
    h.extract.mockResolvedValue(READY);
    setLead({ messages: READY_THREAD, crm: { provider: "followupboss", id: "fub-42" } });
    await scoreAndDraftForLead("lead1");
    expect(h.moveTier).toHaveBeenCalledTimes(1);
    const [who, tier, why] = h.moveTier.mock.calls[0];
    expect(who).toMatchObject({ id: "lead1", businessId: "biz1", crmProvider: "followupboss", crmId: "fub-42" });
    expect(tier).toBe("ready");
    expect(why).toBe("They said: “Saturday morning works”");
  });

  it("pushes nothing for a customer who isn't in a CRM", async () => {
    setLead({ messages: READY_THREAD });
    h.extract.mockResolvedValue(READY);
    await scoreAndDraftForLead("lead1");
    expect(h.pushNote).not.toHaveBeenCalled();
    expect(h.moveTier).not.toHaveBeenCalled();
  });

  it("is not stamped ready again once it has been", async () => {
    setLead({
      messages: READY_THREAD,
      qualifiedAt: new Date(Date.UTC(2026, 9, 9, 9, 30)),
      qualification: { v: 2, template: "realtor", items: [], tier: "ready" },
    });
    h.extract.mockResolvedValue(READY);
    await scoreAndDraftForLead("lead1");
    expect(h.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { qualifiedAt: expect.any(Date) } }));
  });

  it("stops following up a customer who already has an agent, and asks them nothing more", async () => {
    setLead({
      messages: [
        message("inbound", "Is the 3 bed on Elm St still for sale? We're hoping to move in about 2 months.", 1),
        message("outbound", "It is. Are you working with an agent yet?", 2),
        message("inbound", "Thanks, but I'm already working with an agent.", 3),
      ],
    });
    h.extract.mockResolvedValue([...FIRST, said("agent", "Has an agent", "I'm already working with an agent", "has")]);
    await scoreAndDraftForLead("lead1");
    expect((updateData().qualification as { tier?: string }).tier).toBe("agent");
    expect(updateData().saidNoAt).toBeInstanceOf(Date);
    expect(h.generate.mock.calls[0][0].qualify).toBeNull();
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("still gets a reply when the reader fails — and asks buying or selling, knowing nothing", async () => {
    setLead();
    h.extract.mockRejectedValue(new Error("model down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(updateData().suggestedMessage).toBe("Yes, it's available.");
    expect(h.generate.mock.calls[0][0].qualify.ask).toBe("whether they are looking to buy, sell, or both, and roughly when they are hoping to move");
  });

  it("counts a booked call as the viewing", async () => {
    setLead();
    h.booking.mockResolvedValue({ scheduledAt: new Date("2026-10-11T14:30:00Z") });
    await scoreAndDraftForLead("lead1");
    const items = (updateData().qualification as { items: { key: string; value: string }[] }).items;
    expect(items.find((i) => i.key === "viewing")?.value).toBe("Booked call, Sun, Oct 11, 10:30 AM");
    expect(h.booking.mock.calls[0][0].where).toMatchObject({ leadId: "lead1", businessId: "biz1", status: "confirmed" });
  });
});

describe("everything else stays as it was", () => {
  it("a business without a checklist is never read, asked or stored", async () => {
    setLead({ industry: "Plumbing" });
    await scoreAndDraftForLead("lead1");
    expect(h.extract).not.toHaveBeenCalled();
    expect(h.booking).not.toHaveBeenCalled();
    expect(h.generate.mock.calls[0][0].qualify).toBeNull();
    expect(updateData()).not.toHaveProperty("qualification");
  });

  it("a pass where the business spoke last reads nothing and asks nothing", async () => {
    setLead({
      messages: [message("inbound", "Is the 3 bed on Elm St still for sale?", 1), message("outbound", "On it!", 2)],
    });
    await scoreAndDraftForLead("lead1");
    expect(h.extract).not.toHaveBeenCalled();
    expect(h.generate.mock.calls[0][0].qualify).toBeNull();
  });
});

// A-238: an Instagram or Messenger customer is asked once for the best email
// and mobile, in a reply after the first, in place of that reply's qualifying question.
describe("asking a DM customer how to reach them", () => {
  const secondDm = [
    message("inbound", "Is the 3 bed on King St still available?", 1),
    message("outbound", "Yes, it is! Would you like to see it?", 2),
    message("inbound", "Maybe, we're moving in March", 3),
  ];
  const dmAsk = () => h.draftDm.mock.calls[0][7] as { ask: string } | null;
  const QUALIFYING = "whether they are looking to buy, sell, or both, and roughly when they are hoping to move";

  beforeEach(() => {
    h.draftDm.mockResolvedValue({ body: "Great. What's the best email and mobile to reach you?", quickReplies: { question: "reply", buttons: [] }, shapeFailed: null });
  });

  it("asks once, in the second reply, and keeps the qualifying question for later", async () => {
    setLead({ channel: "instagram", messages: secondDm });
    await scoreAndDraftForLead("lead1");
    expect(dmAsk()?.ask).toMatch(/email address and mobile number/);
    expect(updateData().dmContactAskedAt).toBeInstanceOf(Date);
    expect((updateData().qualification as { offered?: string[] }).offered ?? []).toEqual([]);
  });

  it("never in the first reply", async () => {
    setLead({ channel: "instagram", messages: [message("inbound", "Is the 3 bed on King St still available?", 1)] });
    await scoreAndDraftForLead("lead1");
    expect(dmAsk()?.ask).toBe(QUALIFYING);
    expect(updateData()).not.toHaveProperty("dmContactAskedAt");
  });

  it("never twice, and never once they gave an email", async () => {
    setLead({ channel: "instagram", messages: secondDm, dmContactAskedAt: new Date() });
    await scoreAndDraftForLead("lead1");
    expect(dmAsk()?.ask).toBe(QUALIFYING);
    vi.clearAllMocks();
    setLead({ channel: "instagram", messages: secondDm, dmEmail: "nadia@x.com" });
    await scoreAndDraftForLead("lead1");
    expect(updateData()).not.toHaveProperty("dmContactAskedAt");
  });

  it("never by email", async () => {
    setLead({ channel: "email", messages: secondDm });
    await scoreAndDraftForLead("lead1");
    expect(h.draftDm).not.toHaveBeenCalled();
    expect(updateData()).not.toHaveProperty("dmContactAskedAt");
  });
});
