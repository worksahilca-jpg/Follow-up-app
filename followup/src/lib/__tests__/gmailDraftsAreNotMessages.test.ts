/**
 * A reply the owner started in Gmail and never sent is not a message.
 *
 * Gmail's threads.get returns a thread's drafts among its messages
 * (labelled DRAFT), and Gmail saves a draft seconds after the owner starts
 * typing. The sync stored it like any other message from the owner: as the
 * business answering. The customer then read as answered, so the 3-hour
 * first-reply rule, the unanswered rule and Today's queue all let go of
 * exactly the lead the owner had started to answer and walked away from.
 * Each save of a draft is a new message id, so the half-written reply was
 * stored again at every sync while it sat there.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { threadsGet, threadsList, prismaMock, acknowledgeNewLead } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  threadsList: vi.fn(),
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
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));

import { fetchSalesConversations } from "@/lib/integrations/gmail";

function gmailMessage(id: string, from: string, at: Date, text: string, labelIds: string[] = ["INBOX"]) {
  return {
    id,
    labelIds,
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

const janeWrote = new Date(Date.now() - 60 * 60_000);
const draftSaved = new Date(Date.now() - 30 * 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "");

  threadsList.mockResolvedValue({ data: { threads: [{ id: "thread-1" }] } });
  threadsGet.mockResolvedValue({
    data: {
      id: "thread-1",
      messages: [
        gmailMessage("m1", "Jane Doe <jane@example.com>", janeWrote, "Could you quote a kitchen reno?"),
        gmailMessage("r-draft-7", "Sam <info@samsplumbing.ca>", draftSaved, "Hi Jane, it would be around $", ["DRAFT"]),
      ],
    },
  });
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accountEmail: "info@samsplumbing.ca",
    watchExpiration: null,
    user: { email: "sam.smith@gmail.com" },
  });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
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
});

describe("an unsent Gmail draft in a customer's thread", () => {
  it("is not stored, and does not count as the business answering", async () => {
    const leads = await fetchSalesConversations("biz1");

    expect(leads.map((l) => l.id)).toEqual(["lead1"]);
    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create);
    expect(stored.map((m: { externalId: string }) => m.externalId)).toEqual(["m1"]);
    // The customer's own message is still the newest: they are waiting.
    expect(prismaMock.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastContacted: janeWrote }) }));
    expect(acknowledgeNewLead).toHaveBeenCalledWith("lead1", expect.objectContaining({ hasHumanReply: false }));
  });

  it("a sent reply (no DRAFT label) still counts, as before", async () => {
    threadsGet.mockResolvedValue({
      data: {
        id: "thread-1",
        messages: [
          gmailMessage("m1", "Jane Doe <jane@example.com>", janeWrote, "Could you quote a kitchen reno?"),
          gmailMessage("m2", "Sam <info@samsplumbing.ca>", draftSaved, "Hi Jane, around $18k.", ["SENT"]),
        ],
      },
    });
    await fetchSalesConversations("biz1");
    const stored = prismaMock.message.upsert.mock.calls.map((c) => c[0].create);
    expect(stored.map((m: { direction: string }) => m.direction)).toEqual(["inbound", "outbound"]);
  });
});
