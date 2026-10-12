/**
 * The checklist inside the reply step (src/lib/scoring.ts): a realtor's
 * customer is read when they write, the reply may ask about one missing
 * thing, the ready moment is stamped once, and nothing about it can hold
 * up or change a reply for any other line of work.
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
        messages: opts.messages ?? [
          message("inbound", "We need 3 bedrooms, near a good school. Our lease ends in March.", 1),
        ],
      },
    ],
  };
}

const updateData = () => h.update.mock.calls[0][0].data as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  h.updateMany.mockResolvedValue({ count: 1 });
  h.generate.mockResolvedValue({ subject: "The 3 bed", body: "Yes, it's available." });
  h.booking.mockResolvedValue(null);
  h.extract.mockResolvedValue([
    { key: "want", known: true, value: "3 bedrooms near a school", quote: "We need 3 bedrooms, near a good school." },
    { key: "timing", known: true, value: "Moving in March", quote: "Our lease ends in March." },
    { key: "budget", known: false, value: "", quote: "" },
    { key: "viewing", known: false, value: "", quote: "" },
  ]);
});

describe("a realtor's customer who just wrote", () => {
  it("is read, saved with their words, and the reply may ask about the budget next — once", async () => {
    setLead();
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(h.extract).toHaveBeenCalledTimes(1);
    expect(h.generate.mock.calls[0][0].qualify.key).toBe("budget");
    expect(updateData().qualification).toEqual({
      v: 1,
      template: "realtor",
      items: [
        { key: "want", value: "3 bedrooms near a school", quote: "We need 3 bedrooms, near a good school." },
        { key: "timing", value: "Moving in March", quote: "Our lease ends in March." },
      ],
      offered: ["budget"],
    });
    expect(h.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { qualifiedAt: expect.any(Date) } }));
  });

  it("never stores a quote that isn't really theirs", async () => {
    setLead();
    h.extract.mockResolvedValue([{ key: "budget", known: true, value: "Up to $900k", quote: "we can do 900" }]);
    await scoreAndDraftForLead("lead1");
    expect((updateData().qualification as { items: unknown[] }).items).toEqual([]);
  });

  it("becomes ready once, with one bell — not a second one for going hot", async () => {
    setLead({
      messages: [
        message("inbound", "We need 3 bedrooms, near a good school. Our lease ends in March.", 1),
        message("outbound", "Great! Which days suit you for a viewing?", 2),
        message("inbound", "We're pre-approved up to 650. Saturday 10:30 works!", 3),
      ],
    });
    h.extract.mockResolvedValue([
      { key: "want", known: true, value: "3 bedrooms near a school", quote: "We need 3 bedrooms, near a good school." },
      { key: "timing", known: true, value: "Moving in March", quote: "Our lease ends in March." },
      { key: "budget", known: true, value: "Pre-approved to $650k", quote: "pre-approved up to 650" },
      { key: "viewing", known: true, value: "Saturday at 10:30 AM", quote: "Saturday 10:30 works!" },
    ]);
    const { scoreLead } = await import("@/lib/integrations/openai");
    vi.mocked(scoreLead).mockResolvedValueOnce({ score: 90, reason: "Ready to view", factors: [], saysNo: false, asksIfAutomated: false, onlyThanks: false } as never);
    await scoreAndDraftForLead("lead1");
    expect(h.generate.mock.calls[0][0].qualify).toBeNull();
    expect(h.updateMany).toHaveBeenCalledWith({ where: { id: "lead1", qualifiedAt: null }, data: { qualifiedAt: expect.any(Date) } });
    expect(h.notify).toHaveBeenCalledTimes(1);
    expect(h.notify.mock.calls[0][0].data.message).toBe(
      "Nadia Khan is ready — Pre-approved to $650k · Moving in March · 3 bedrooms near a school"
    );
  });

  // A-237: the ready card goes into the owner's CRM too, once, with the customer's own words.
  it("puts the ready card into the CRM the customer came from, once", async () => {
    const ready = [
      message("inbound", "We need 3 bedrooms, near a good school. Our lease ends in March.", 1),
      message("outbound", "Great! Which days suit you for a viewing?", 2),
      message("inbound", "We're pre-approved up to 650. Saturday 10:30 works!", 3),
    ];
    h.extract.mockResolvedValue([
      { key: "want", known: true, value: "3 bedrooms near a school", quote: "We need 3 bedrooms, near a good school." },
      { key: "timing", known: true, value: "Moving in March", quote: "Our lease ends in March." },
      { key: "budget", known: true, value: "Pre-approved to $650k", quote: "pre-approved up to 650" },
      { key: "viewing", known: true, value: "Saturday at 10:30 AM", quote: "Saturday 10:30 works!" },
    ]);
    setLead({ messages: ready, crm: { provider: "followupboss", id: "fub-42" } });
    await scoreAndDraftForLead("lead1");
    expect(h.pushNote).toHaveBeenCalledTimes(1);
    expect(h.pushNote).toHaveBeenCalledWith(
      "biz1",
      "followupboss",
      "fub-42",
      [
        "FollowUp: Nadia Khan looks ready to talk.",
        'What they want: 3 bedrooms near a school ("We need 3 bedrooms, near a good school.")',
        'When: Moving in March ("Our lease ends in March.")',
        'Budget: Pre-approved to $650k ("pre-approved up to 650")',
        'Viewing: Saturday at 10:30 AM ("Saturday 10:30 works!")',
      ].join("\n")
    );

    // A second pass that lost the race to stamp it pushes nothing.
    vi.clearAllMocks();
    h.updateMany.mockResolvedValue({ count: 0 });
    setLead({ messages: ready, crm: { provider: "followupboss", id: "fub-42" } });
    await scoreAndDraftForLead("lead1");
    expect(h.pushNote).not.toHaveBeenCalled();
  });

  it("pushes nothing for a customer who isn't in a CRM", async () => {
    setLead({
      messages: [
        message("inbound", "We need 3 bedrooms, near a good school. Our lease ends in March.", 1),
        message("outbound", "Great! Which days suit you for a viewing?", 2),
        message("inbound", "We're pre-approved up to 650. Saturday 10:30 works!", 3),
      ],
    });
    h.extract.mockResolvedValue([
      { key: "want", known: true, value: "3 bedrooms near a school", quote: "We need 3 bedrooms, near a good school." },
      { key: "timing", known: true, value: "Moving in March", quote: "Our lease ends in March." },
      { key: "budget", known: true, value: "Pre-approved to $650k", quote: "pre-approved up to 650" },
      { key: "viewing", known: true, value: "Saturday at 10:30 AM", quote: "Saturday 10:30 works!" },
    ]);
    await scoreAndDraftForLead("lead1");
    expect(h.pushNote).not.toHaveBeenCalled();
  });

  it("is not stamped ready again once it has been", async () => {
    setLead({
      qualifiedAt: new Date(Date.UTC(2026, 9, 9, 9, 30)),
      qualification: {
        v: 1,
        template: "realtor",
        items: [
          { key: "want", value: "3 bedrooms near a school", quote: "We need 3 bedrooms, near a good school." },
          { key: "timing", value: "Moving in March", quote: "Our lease ends in March." },
          { key: "budget", value: "Pre-approved to $650k", quote: "pre-approved up to 650" },
          { key: "viewing", value: "Saturday at 10:30 AM", quote: "Saturday 10:30 works!" },
        ],
      },
    });
    await scoreAndDraftForLead("lead1");
    expect(h.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: { qualifiedAt: expect.any(Date) } }));
  });

  it("still gets a reply when the reader fails", async () => {
    setLead();
    h.extract.mockRejectedValue(new Error("model down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await scoreAndDraftForLead("lead1")).toBe(true);
    expect(updateData().suggestedMessage).toBe("Yes, it's available.");
    expect(h.generate.mock.calls[0][0].qualify.key).toBe("want");
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
      messages: [message("inbound", "We need 3 bedrooms, near a good school.", 1), message("outbound", "On it!", 2)],
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
  const dmAsk = () => h.draftDm.mock.calls[0][7] as { ask: string; key?: string } | null;

  beforeEach(() => {
    h.draftDm.mockResolvedValue({ body: "Great. What's the best email and mobile to reach you?", quickReplies: { question: "reply", buttons: [] }, shapeFailed: null });
  });

  it("asks once, in the second reply, and keeps the qualifying question for later", async () => {
    setLead({ channel: "instagram", messages: secondDm });
    await scoreAndDraftForLead("lead1");
    expect(dmAsk()?.ask).toMatch(/email address and mobile number/);
    expect(dmAsk()?.key).toBeUndefined();
    expect(updateData().dmContactAskedAt).toBeInstanceOf(Date);
    expect((updateData().qualification as { offered?: string[] }).offered ?? []).toEqual([]);
  });

  it("never in the first reply", async () => {
    setLead({ channel: "instagram", messages: [message("inbound", "Is the 3 bed on King St still available?", 1)] });
    await scoreAndDraftForLead("lead1");
    expect(dmAsk()?.key).toBe("want");
    expect(updateData()).not.toHaveProperty("dmContactAskedAt");
  });

  it("never twice, and never once they gave an email", async () => {
    setLead({ channel: "instagram", messages: secondDm, dmContactAskedAt: new Date() });
    await scoreAndDraftForLead("lead1");
    expect(dmAsk()?.key).toBe("want");
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
