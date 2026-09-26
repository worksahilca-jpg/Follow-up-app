/**
 * Security audit 2026-09-26, A-10.
 *
 * Conversation.externalId (the Gmail thread id / Outlook conversation id)
 * is unique across every business, and the import looked it up by that id
 * alone. If another business already held a conversation with the same id,
 * the import treated it as its own: it skipped classification ("already
 * known") and upserted this mailbox's messages into THAT business's
 * conversation — one tenant's mail on another tenant's lead.
 *
 * Harness copied from gmailThreadRace.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { threadsGet, prismaMock } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  prismaMock: {
    integration: { findFirst: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn() },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { threads: { get: threadsGet } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { importGmailThread } from "@/lib/integrations/gmail";

const myLead = {
  id: "lead-mine",
  name: "Jane Doe",
  email: "jane@example.com",
  company: null,
  source: "Gmail",
  dealValue: 0,
  score: 0,
  scoreReason: null,
  lastContacted: new Date(),
  nextFollowUp: null,
  notes: null,
  automationTier: "HOLD",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "");

  threadsGet.mockResolvedValue({
    data: {
      id: "thread-1",
      messages: [
        {
          id: "msg-1",
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: "Jane Doe <jane@example.com>" },
              { name: "Date", value: new Date().toUTCString() },
              { name: "Subject", value: "Quote" },
              { name: "Message-ID", value: "<jane-1@example.com>" },
            ],
            body: { data: Buffer.from("Private: my address is 12 Elm St").toString("base64") },
          },
        },
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
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sam's Plumbing", industry: "Plumbing" });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockResolvedValue(myLead);
  prismaMock.conversation.create.mockResolvedValue({ id: "conv-mine", leadId: "lead-mine" });
  prismaMock.message.upsert.mockResolvedValue({});
});

describe("a thread id another business already holds", () => {
  it("is skipped before any lead or message is written", async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({
      id: "conv-theirs",
      leadId: "lead-theirs",
      lead: { businessId: "biz-other" },
    });

    const result = await importGmailThread("biz-mine", "thread-1");

    expect(result).toBeNull();
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(prismaMock.message.upsert).not.toHaveBeenCalled();
  });

  it("is skipped when the other business's row only appears between the two reads", async () => {
    prismaMock.conversation.findUnique
      .mockResolvedValueOnce(null) // the known-thread check
      .mockResolvedValueOnce({ id: "conv-theirs", leadId: "lead-theirs" }); // the read before creating
    // The owner lookup for lead-theirs (the lead lookup by email uses findUnique too).
    prismaMock.lead.findUnique.mockImplementation(async (args: { where: { id?: string } }) =>
      args.where.id === "lead-theirs" ? { businessId: "biz-other" } : null
    );

    const result = await importGmailThread("biz-mine", "thread-1");

    expect(result).toBeNull();
    expect(prismaMock.message.upsert).not.toHaveBeenCalled();
  });

  it("still imports normally when the conversation is this business's own", async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    const result = await importGmailThread("biz-mine", "thread-1");
    expect(result?.id).toBe("lead-mine");
    expect(prismaMock.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ conversationId: "conv-mine" }) })
    );
  });
});
