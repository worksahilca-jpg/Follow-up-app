/**
 * The business's own people are never its customers.
 *
 * The Gmail sync knew one address as "us": the connected inbox. Sam signs
 * in to FollowUp as sam.smith@gmail.com and connects info@samsplumbing.ca.
 * When Sam forwarded a customer's email to info@ from his phone, or a
 * teammate wrote to the shared inbox, that sender was the thread's first
 * non-inbox address, so they became a new customer: scored, drafted for,
 * sent the instant acknowledgement, and followed up on. And a teammate's
 * reply to a real customer was stored as the customer writing again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { threadsGet, threadsList, prismaMock, classifyWithSecondLook, acknowledgeNewLead } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  threadsList: vi.fn(),
  classifyWithSecondLook: vi.fn(),
  acknowledgeNewLead: vi.fn(async () => undefined),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn(), findFirst: vi.fn(async () => null) },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { threads: { get: threadsGet, list: threadsList } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

import { fetchSalesConversations } from "@/lib/integrations/gmail";
import { ownAddressSet } from "@/lib/ownSenders";

function gmailMessage(id: string, from: string, at: Date, text: string) {
  return {
    id,
    internalDate: String(at.getTime()),
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: from },
        { name: "Subject", value: "Kitchen quote" },
        { name: "Message-ID", value: `<${id}@mail>` },
      ],
      body: { data: Buffer.from(text).toString("base64") },
    },
  };
}

const t0 = new Date(Date.now() - 60 * 60_000);
const t1 = new Date(Date.now() - 30 * 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  threadsList.mockResolvedValue({ data: { threads: [{ id: "thread-1" }] } });
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accountEmail: "info@samsplumbing.ca",
    watchExpiration: null,
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({
    name: "Sam's Plumbing",
    industry: "Plumbing",
    users: [{ email: "Sam.Smith@gmail.com" }, { email: "dana@samsplumbing.ca" }],
  });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv1", leadId: "lead1" });
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "lead1",
    company: null,
    dealValue: 0,
    score: 0,
    scoreReason: null,
    nextFollowUp: null,
    notes: null,
    automationTier: "ASSISTED",
    ...data,
  }));
  classifyWithSecondLook.mockResolvedValue({ isProspect: true, reason: "asks for a quote" });
});

describe("the Gmail sync and the business's own people", () => {
  it("the owner forwarding a customer's email from his personal address is not a new customer", async () => {
    threadsGet.mockResolvedValue({
      data: {
        id: "thread-1",
        messages: [gmailMessage("m1", "Sam Smith <sam.smith@gmail.com>", t0, "Fwd: can you quote a kitchen reno?")],
      },
    });
    const leads = await fetchSalesConversations("biz1");
    expect(leads).toEqual([]);
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("a teammate writing to the shared inbox is not a new customer", async () => {
    threadsGet.mockResolvedValue({
      data: { id: "thread-1", messages: [gmailMessage("m1", "Dana <dana@samsplumbing.ca>", t0, "Can you call the Hendersons back?")] },
    });
    await fetchSalesConversations("biz1");
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });

  it("a teammate's reply to a customer is the business answering, not the customer writing again", async () => {
    threadsGet.mockResolvedValue({
      data: {
        id: "thread-1",
        messages: [
          gmailMessage("m1", "Jane Doe <jane@example.com>", t0, "Could you quote a kitchen reno?"),
          gmailMessage("m2", "Dana <dana@samsplumbing.ca>", t1, "Hi Jane, Sam will send it today."),
        ],
      },
    });
    await fetchSalesConversations("biz1");
    expect(prismaMock.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: "jane@example.com" }) }));
    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create);
    expect(stored.map((m: { direction: string }) => m.direction)).toEqual(["inbound", "outbound"]);
    // Already answered by a person, so no "we got your message" on top.
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead1", expect.objectContaining({ hasHumanReply: true }));
  });

  // Plus the owner's own corrections (src/lib/senderVerdicts.ts) — never the team's addresses.
  it("the classifier still gets only the business's name and trade", async () => {
    threadsGet.mockResolvedValue({
      data: { id: "thread-1", messages: [gmailMessage("m1", "Jane Doe <jane@example.com>", t0, "Could you quote a kitchen reno?")] },
    });
    await fetchSalesConversations("biz1");
    expect(classifyWithSecondLook.mock.calls[0][2]).toEqual({ name: "Sam's Plumbing", industry: "Plumbing", corrections: [] });
  });
});

/**
 * The business's OTHER connected inboxes are the business too.
 *
 * Each admin can connect their own inbox, and it need not be the address
 * they sign in with: Jo signs in as jo@samsplumbing.ca and connected
 * jo.bookings@gmail.com. Read through info@, mail from Jo's inbox was a
 * stranger's: her reply on a customer's thread was stored as the customer
 * writing again (so the thread read as waiting on the business, and a
 * reply was drafted to Jo's own words), and a lead she forwarded to info@
 * became a customer called Jo, acknowledged and followed up on.
 */
describe("the Gmail sync and the business's other connected inboxes", () => {
  beforeEach(() => {
    prismaMock.business.findUnique.mockResolvedValue({
      name: "Sam's Plumbing",
      industry: "Plumbing",
      users: [
        { email: "sam.smith@gmail.com", integrations: [{ accountEmail: "info@samsplumbing.ca" }] },
        { email: "jo@samsplumbing.ca", integrations: [{ accountEmail: "Jo.Bookings@gmail.com" }, { accountEmail: null }] },
      ],
    });
  });

  it("a teammate's reply from her own connected inbox is the business answering", async () => {
    threadsGet.mockResolvedValue({
      data: {
        id: "thread-1",
        messages: [
          gmailMessage("m1", "Jane Doe <jane@example.com>", t0, "Could you quote a kitchen reno?"),
          gmailMessage("m2", "Jo <jo.bookings@gmail.com>", t1, "Hi Jane, I'll come by Thursday to measure."),
        ],
      },
    });
    await fetchSalesConversations("biz1");
    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create);
    expect(stored.map((m: { direction: string }) => m.direction)).toEqual(["inbound", "outbound"]);
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead1", expect.objectContaining({ hasHumanReply: true }));
  });

  it("a lead forwarded from a teammate's connected inbox is not a customer called Jo", async () => {
    threadsGet.mockResolvedValue({
      data: { id: "thread-1", messages: [gmailMessage("m1", "Jo <jo.bookings@gmail.com>", t0, "Fwd: quote request for a bathroom")] },
    });
    await fetchSalesConversations("biz1");
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });
});

describe("ownAddressSet", () => {
  it("holds the inbox and every team address, lower-cased, and skips blanks", () => {
    const own = ownAddressSet("Info@SamsPlumbing.ca", ["Sam.Smith@gmail.com", null, "", "Dana <dana@samsplumbing.ca>"]);
    expect([...own].sort()).toEqual(["dana@samsplumbing.ca", "info@samsplumbing.ca", "sam.smith@gmail.com"]);
  });
});
